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

    // Track tab visibility
    let tabClosed = false;
    
    // Function to handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // When tab becomes hidden, mark it as potentially closed
        tabClosed = true;
      } else if (tabClosed) {
        // If tab was previously marked as closed and is now visible again,
        // it means the user reopened the tab, so sign them out
        signOut(auth).catch(error => {
          console.error('Error during automatic sign-out:', error);
        });
        
        // Also clear the session cookie
        fetch('/api/auth/session', { method: 'DELETE' }).catch(error => {
          console.error('Error clearing session cookie:', error);
        });
        
        setUser(null);
        tabClosed = false;
      }
    };
    
    // Add visibility change event listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add beforeunload event listener for more reliable detection
    const handleBeforeUnload = () => {
      // Use sendBeacon for more reliable sending during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/auth/session', '');
      } else {
        // Fallback for browsers that don't support sendBeacon
        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/api/auth/session', false);
        xhr.send();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);

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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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