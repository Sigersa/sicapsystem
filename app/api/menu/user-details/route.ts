import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  let connection;

  try {
    const session = request.cookies.get("session")?.value;

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    connection = await getConnection();

    const [rows] = await connection.execute(
      `SELECT 
         su.SystemUserID,
         su.UserName,
         su.CreationDate,
         su.UserTypeID,
         ud.FirstName,
         ud.LastName,
         ud.MiddleName,
         ud.Email
       FROM sessions s
       INNER JOIN systemusers su
       ON su.SystemUserID = s.SystemUserID 
       LEFT JOIN userdetails ud ON su.SystemUserID = ud.SystemUserID
       WHERE s.SessionID = ? AND s.ExpiresAt > NOW()`,
      [session]
    );

    const users = rows as any[];
    
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada' },
        { status: 401 }
      );
    }

    const user = users[0];

    return NextResponse.json({
      success: true,
      user: {
        SystemUserID: user.SystemUserID,
        UserName: user.UserName,
        FirstName: user.FirstName,
        LastName: user.LastName,
        MiddleName: user.MiddleName,
        FullName: `${user.FirstName || ''} ${user.LastName || ''}`.trim() || user.UserName,
        Email: user.Email,
        UserTypeID: user.UserTypeID,
        CreationDate: user.CreationDate
      }
    },
    { status: 200 }
  );

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}