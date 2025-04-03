import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin-server';

export async function POST(request: Request) {
  try {
    const { uid, newPassword } = await request.json();
    
    const auth = getAdminAuth();
    await auth.updateUser(uid, { password: newPassword });
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
} 