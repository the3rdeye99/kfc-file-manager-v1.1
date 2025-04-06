'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there's a session cookie
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/check-session');
        if (!response.ok) {
          // If the session is invalid, sign out the user
          await signOut(auth);
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // If there's an error checking the session, sign out the user
        await signOut(auth);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Check the session on mount
    checkSession();

    // Set up a heartbeat to check session validity
    const heartbeatInterval = setInterval(checkSession, 30000); // Check every 30 seconds

    // Track tab visibility and inactivity
    let inactivityTimer: NodeJS.Timeout | null = null;
    let lastActivityTime = Date.now();
    const INACTIVITY_TIMEOUT = 60000; // 60 seconds

    // Function to reset the inactivity timer
    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      
      inactivityTimer = setTimeout(async () => {
        // If we've been inactive for 60 seconds, sign out
        await signOut(auth);
        await fetch('/api/auth/session', { method: 'DELETE' });
        setUser(null);
      }, INACTIVITY_TIMEOUT);
      
      lastActivityTime = Date.now();
    };

    // Function to handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // When tab becomes hidden, start the inactivity timer
        resetInactivityTimer();
      } else {
        // When tab becomes visible again, check if it was hidden for more than 60 seconds
        const timeHidden = Date.now() - lastActivityTime;
        if (timeHidden > INACTIVITY_TIMEOUT) {
          // If hidden for more than 60 seconds, sign out
          signOut(auth).catch(error => {
            console.error('Error during automatic sign-out:', error);
          });
          
          // Also clear the session cookie
          fetch('/api/auth/session', { method: 'DELETE' }).catch(error => {
            console.error('Error clearing session cookie:', error);
          });
          
          setUser(null);
        } else {
          // If not hidden for too long, reset the timer
          resetInactivityTimer();
        }
      }
    };
    
    // Add visibility change event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add event listeners for user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer);
    });
    
    // Initialize the inactivity timer
    resetInactivityTimer();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get the ID token
        const idToken = await user.getIdToken();
        
        // Send the token to your backend to create a session
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        if (!response.ok) {
          console.error('Failed to create session');
          // If we can't create a session, sign out the user
          await signOut(auth);
          setUser(null);
        } else {
          setUser(user);
        }
      } else {
        // Clear the session cookie when user logs out
        await fetch('/api/auth/session', { method: 'DELETE' });
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearInterval(heartbeatInterval);
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext); 