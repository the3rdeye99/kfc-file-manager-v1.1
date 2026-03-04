import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function GET() {
  try {
    const auth = getAdminAuth();
    const users = await auth.listUsers();
    
    // Map users to include role from custom claims
    const usersWithRoles = users.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.customClaims?.role || 'viewer'
    }));
    
    return NextResponse.json(usersWithRoles);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 