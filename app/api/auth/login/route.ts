import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool, { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
  let connection;

  try {
    const { username, password } = await request.json();

    console.log('=== LOGIN DEBUG ===');
    console.log('Username recibido:', username);
    console.log('Password recibido (longitud):', password?.length);

    // Validación básica
    if (!username || !password) {
      console.log('Faltan campos requeridos');
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const cleanUsername = username.toString().trim();
    const cleanPassword = password.toString().trim();

    console.log('Username limpio:', cleanUsername);
    console.log('Password limpio (longitud):', cleanPassword.length);

    connection = await getConnection();

    // Buscar usuario
    const [rows] = await connection.execute(
      `SELECT su.SystemUserID, su.UserName, su.Password, su.UserTypeID, ut.Type 
       FROM systemusers su
       INNER JOIN userstypes ut ON su.UserTypeID = ut.UserTypeID
       WHERE su.UserName = ?`,
      [cleanUsername]
    );

    const users = rows as any[];
    
    console.log('Usuarios encontrados:', users.length);
    
    if (users.length === 0) {
      console.log('Usuario no existe en la base de datos');
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    const user = users[0];
    
    console.log('Usuario encontrado:', user.UserName);
    console.log('Hash en BD:', user.Password);
    console.log('Longitud del hash:', user.Password?.length);
    console.log('Es hash bcrypt?:', user.Password?.startsWith('$2'));

    // Verificar contraseña
    let isValidPassword = false;
    
    try {
      // Si el password en BD parece ser un hash bcrypt
      if (user.Password && user.Password.startsWith('$2')) {
        isValidPassword = await bcrypt.compare(cleanPassword, user.Password);
        console.log('Resultado de bcrypt.compare:', isValidPassword);
      } else {
        // Si no es un hash bcrypt, comparar directamente (solo para desarrollo)
        console.warn('ADVERTENCIA: Password no está hasheado con bcrypt');
        console.log('Comparando texto plano');
        isValidPassword = cleanPassword === user.Password;
        console.log('Resultado comparación texto plano:', isValidPassword);
      }
    } catch (bcryptError: any) {
      console.error('Error en bcrypt.compare:', bcryptError.message);
      return NextResponse.json(
        { error: 'Error al verificar la contraseña' },
        { status: 500 }
      );
    }

    if (!isValidPassword) {
      console.log('Contraseña incorrecta');
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    console.log('✅ Login exitoso para:', cleanUsername);

    // Determinar redirección según el tipo de usuario
    const redirectTo = 
      user.UserTypeID === 1 
        ? '/system-admin-dashboard' 
        : '/administrative-personnel-dashboard';

    // Crear respuesta y configurar cookie
    const response = NextResponse.json({
      success: true,
      user: {
        SystemUserID: user.SystemUserID,
        UserName: user.UserName,
        UserTypeID: user.UserTypeID,
        UserType: user.Type
      },
      redirectTo: redirectTo
    });

    // Guardar user_id en cookie (seguro, httpOnly)
    response.cookies.set({
      name: 'user_id',
      value: user.SystemUserID.toString(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/'
    });

    return response;

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor: ' + error.message },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
      console.log('Conexión liberada');
    }
  }
}