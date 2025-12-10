import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Validación básica
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Conexión a MySQL
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'gersa1234',
      database: process.env.DB_NAME || 'sicap',
    });

    // Buscar usuario con la contraseña exacta (texto plano)
    const [users] = await connection.execute(
      `SELECT su.*, ut.Type 
       FROM systemusers su
       INNER JOIN userstypes ut ON su.UserTypeID = ut.UserTypeID
       WHERE su.UserName = ? AND su.Password = ?`,
      [username, password]
    );

    const userArray = users as any[];
    
    if (userArray.length === 0) {
      await connection.end();
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const user = userArray[0];

    // Crear datos de usuario para la sesión
    const userData = {
      SystemUserID: user.SystemUserID,
      UserName: user.UserName,
      UserTypeID: user.UserTypeID,
      UserType: user.Type
    };


    // app/api/auth/login/route.ts
return NextResponse.json({
  success: true,
  user: userData,
  redirectTo: user.UserTypeID === 1 
    ? '/system-admin-dashboard' 
    : '/administrative-personnel-dashboard'
});
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}