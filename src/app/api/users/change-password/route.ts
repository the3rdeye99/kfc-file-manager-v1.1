import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update the user's password
    await getAuth().updateUser(userId, {
      password: newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
} 