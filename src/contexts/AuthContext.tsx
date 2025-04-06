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
    const heartbeatInterval = setInterval(checkSession, 60000); // Check every minute

    // Function to clear session when tab is closed
    const clearSessionOnTabClose = () => {
      // Use sendBeacon for more reliable delivery during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/auth/session', '');
      } else {
        // Fallback for browsers that don't support sendBeacon
        const xhr = new XMLHttpRequest();
        xhr.open('DELETE', '/api/auth/session', false); // false makes it synchronous
        xhr.send();
      }
    };

    // Add multiple event listeners to catch tab close in different browsers
    window.addEventListener('beforeunload', clearSessionOnTabClose);
    window.addEventListener('unload', clearSessionOnTabClose);
    window.addEventListener('pagehide', clearSessionOnTabClose);
    
    // Also use the Page Visibility API as a backup
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // When tab becomes hidden, start a timer
        const hiddenTime = Date.now();
        
        // When tab becomes visible again, check if it was hidden for more than 5 seconds
        const handleVisibilityChangeBack = () => {
          const visibleTime = Date.now();
          const timeHidden = visibleTime - hiddenTime;
          
          // If tab was hidden for more than 5 seconds, consider it a tab close/reopen
          if (timeHidden > 5000) {
            // Clear the session cookie
            fetch('/api/auth/session', { method: 'DELETE' }).catch(error => {
              console.error('Error clearing session cookie:', error);
            });
          }
          
          // Remove the event listener
          document.removeEventListener('visibilitychange', handleVisibilityChangeBack);
        };
        
        // Add event listener for when tab becomes visible again
        document.addEventListener('visibilitychange', handleVisibilityChangeBack);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

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
      window.removeEventListener('beforeunload', clearSessionOnTabClose);
      window.removeEventListener('unload', clearSessionOnTabClose);
      window.removeEventListener('pagehide', clearSessionOnTabClose);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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