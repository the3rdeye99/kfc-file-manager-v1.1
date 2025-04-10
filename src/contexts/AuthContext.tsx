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
        console.log('Checking session...');
        const response = await fetch('/api/auth/check-session');
        if (!response.ok) {
          console.log('Session check failed, signing out user');
          await signOut(auth);
          setUser(null);
        } else {
          console.log('Session check passed');
        }
      } catch (error) {
        console.error('Error checking session:', error);
        await signOut(auth);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Check the session on mount
    checkSession();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      
      if (user) {
        try {
          // Get the ID token
          const idToken = await user.getIdToken();
          console.log('Got ID token, creating session...');
          
          // Send the token to your backend to create a session
          const response = await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });

          if (!response.ok) {
            console.error('Failed to create session:', await response.text());
            await signOut(auth);
            setUser(null);
          } else {
            console.log('Session created successfully');
            setUser(user);
          }
        } catch (error) {
          console.error('Error creating session:', error);
          await signOut(auth);
          setUser(null);
        }
      } else {
        try {
          console.log('Clearing session...');
          // Clear the session cookie when user logs out
          await fetch('/api/auth/session', { method: 'DELETE' });
          setUser(null);
        } catch (error) {
          console.error('Error clearing session:', error);
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', userCredential.user.email);
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
      console.log('Logging out...');
      await signOut(auth);
      console.log('Logout successful');
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