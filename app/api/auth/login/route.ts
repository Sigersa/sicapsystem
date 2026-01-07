import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getConnection } from '@/lib/db';

const SESSION_DURATION_MINUTES = 15;

export async function POST(request: NextRequest) {
  let connection;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [rows]: any = await connection.execute(
      `SELECT SystemUserID, UserName, Password, UserTypeID
       FROM systemusers 
       WHERE UserName = ?`,
      [username.trim()]
    );


    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const user = rows[0];

    const isValid = user.Password.startsWith('$2')
      ? await bcrypt.compare(password, user.Password)
      : password === user.Password;

    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const sessionId = crypto.randomUUID();

    await connection.execute(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [sessionId, user.SystemUserID, SESSION_DURATION_MINUTES]
    );

    const redirectTo =
      user.UserTypeID === 1
        ? '/system-admin-dashboard'
        : '/administrative-personnel-dashboard';

    const response = NextResponse.json(
      { success: true, redirectTo },
      { status: 200 }
    );

    response.cookies.set({
      name: 'session',
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * SESSION_DURATION_MINUTES,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}
