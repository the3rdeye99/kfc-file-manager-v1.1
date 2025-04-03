'use server';

import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function deleteUser(userId: string) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }

    const auth = getAdminAuth();
    
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

export async function signup(email: string, password: string, username: string) {
  try {
    const auth = getAdminAuth();
    
    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      emailVerified: false,
      displayName: username
    });

    // Set custom claims for the user (viewer role)
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'viewer',
      username: username
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function updateUser(userId: string, displayName: string) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }

    const auth = getAdminAuth();
    
    // Verify the session cookie and get the user
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    
    // Check if the user is an admin
    if (!decodedClaims.email?.includes('admin')) {
      throw new Error('Unauthorized: Only admins can update users');
    }

    // Update the user in Firebase Auth
    await auth.updateUser(userId, {
      displayName
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update user' 
    };
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      return null;
    }
    
    const auth = getAdminAuth();
    const decodedClaims = await auth.verifySessionCookie(sessionCookie);
    
    return {
      uid: decodedClaims.uid,
      email: decodedClaims.email,
      role: decodedClaims.email?.includes('admin') ? 'admin' : 'viewer',
      displayName: decodedClaims.displayName || ''
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
} 