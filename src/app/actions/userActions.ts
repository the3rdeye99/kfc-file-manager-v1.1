'use server';

import { initAdmin } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function deleteUser(userId: string) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }

    const auth = await initAdmin();
    
    // Verify the session cookie and get the user
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    
    // Check if the user is an admin
    if (!decodedClaims.email?.includes('admin')) {
      throw new Error('Unauthorized: Only admins can delete users');
    }

    // Delete the user from Firebase Auth
    await auth.deleteUser(userId);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete user' 
    };
  }
}

export async function signup(email: string, password: string) {
  try {
    const auth = await initAdmin();
    
    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
    });

    // Set custom claims for the user (viewer role)
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'viewer'
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    throw error;
  }
} 