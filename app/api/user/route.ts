import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  let connection;

  try {
    // Obtener el SystemUserID de las cookies
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado - Sesión no encontrada' },
        { status: 401 }
      );
    }

    connection = await getConnection();

    // Buscar el usuario principal y sus detalles
    const [userRows] = await connection.execute(
      `SELECT 
         su.SystemUserID,
         su.UserName,
         su.CreationDate,
         su.UserTypeID,
         ud.FirstName,
         ud.LastName,
         ud.MiddleName,
         ud.Email
       FROM systemusers su
       LEFT JOIN userdetails ud ON su.SystemUserID = ud.SystemUserID
       WHERE su.SystemUserID = ?`,
      [userId]
    );

    const users = userRows as any[];
    
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const userData = users[0];

    return NextResponse.json({
      success: true,
      user: {
        SystemUserID: userData.SystemUserID,
        UserName: userData.UserName,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        MiddleName: userData.MiddleName,
        FullName: `${userData.FirstName || ''} ${userData.LastName || ''}`.trim() || userData.UserName,
        Email: userData.Email,
        UserTypeID: userData.UserTypeID,
        CreationDate: userData.CreationDate
      }
    });

  } catch (error) {
    console.error('Error al obtener datos del usuario: ', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}