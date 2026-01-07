import { NextRequest, NextResponse } from 'next/server';
import { validateAndRenewSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.cookies.get('session')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { valid: false },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { valid: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      valid: true,
      role: user.UserTypeID,
      user: {
        SystemUserID: user.SystemUserID,
        UserName: user.UserName
      }
    });

  } catch (error) {
    console.error('Validate session error:', error);
    return NextResponse.json(
      { valid: false },
      { status: 500 }
    );
  }
}
