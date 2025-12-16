import { NextRequest, NextResponse } from 'next/server';
import pool, { getConnection } from "@/lib/db";
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
      let connection;

  try {
    const { username, password } = await request.json();

    // Validación básica
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Buscar usuario con la contraseña exacta (texto plano)
    const [users] = await connection.execute(
      `SELECT su.*, ut.Type 
       FROM systemusers su
       INNER JOIN userstypes ut ON su.UserTypeID = ut.UserTypeID
       WHERE su.UserName = ?`,
      [username]
    );

    const userArray = users as any[];
    
    if (userArray.length === 0) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const user = userArray[0];

    const isValidPassword = await bcrypt.compare(password, user.Password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // app/api/auth/login/route.ts
return NextResponse.json({
  success: true,
  user: {
      SystemUserID: user.SystemUserID,
      UserName: user.UserName,
      UserTypeID: user.UserTypeID,
      UserType: user.Type
  },
  redirectTo: user.UserTypeID === 1 
    ? '/system-admin-dashboard' 
    : '/administrative-personnel-dashboard'
});
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}