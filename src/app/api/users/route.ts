import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function GET() {
  try {
    const auth = getAdminAuth();
    const users = await auth.listUsers();
    
    return NextResponse.json(users.users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 