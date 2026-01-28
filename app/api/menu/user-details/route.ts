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

    // Consulta actualizada para usar las nuevas tablas
    const [rows] = await connection.execute(
      `SELECT 
         su.SystemUserID,
         su.UserName,
         su.CreationDate,
         su.UserTypeID,
         bp.FirstName,
         bp.LastName,
         bp.MiddleName,
         pi.Email
       FROM sessions s
       INNER JOIN systemusers su ON su.SystemUserID = s.SystemUserID 
       LEFT JOIN basepersonnel bp ON su.SystemUserID = bp.BasePersonnelID
       LEFT JOIN basepersonnelpersonalinfo pi ON bp.BasePersonnelID = pi.BasePersonnelID
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

    // Construir el nombre completo considerando valores nulos
    const firstName = user.FirstName || '';
    const lastName = user.LastName || '';
    const middleName = user.MiddleName || '';
    
    let fullName = '';
    if (firstName && lastName) {
      fullName = middleName ? `${firstName} ${lastName} ${middleName}` : `${firstName} ${lastName}`;
    } else {
      fullName = user.UserName;
    }

    return NextResponse.json({
      success: true,
      user: {
        SystemUserID: user.SystemUserID,
        UserName: user.UserName,
        FirstName: user.FirstName,
        LastName: user.LastName,
        MiddleName: user.MiddleName,
        FullName: fullName.trim(),
        Email: user.Email,
        UserTypeID: user.UserTypeID,
        CreationDate: user.CreationDate
      }
    },
    { status: 200 });

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