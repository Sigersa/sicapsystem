import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada' },
        { status: 401 }
      );
    }

    connection = await getConnection();

    // CORREGIDO: Unir correctamente usando EmployeeID
    const [rows] = await connection.execute(
      `SELECT 
         su.SystemUserID,
         su.UserName,
         su.CreationDate,
         su.UserTypeID,
         su.EmployeeID,
         bp.FirstName,
         bp.LastName,
         bp.MiddleName,
         pi.Email
       FROM sessions s
       INNER JOIN systemusers su ON su.SystemUserID = s.SystemUserID 
       LEFT JOIN employees e ON e.EmployeeID = su.EmployeeID
       LEFT JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID
       LEFT JOIN basepersonnelpersonalinfo pi ON bp.BasePersonnelID = pi.BasePersonnelID
       WHERE s.SessionID = ? AND s.ExpiresAt > NOW()`,
      [sessionId]
    );

    const users = rows as any[];
    
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada' },
        { status: 401 }
      );
    }

    const userData = users[0];

    // Construir el nombre completo considerando valores nulos
    const firstName = userData.FirstName || '';
    const lastName = userData.LastName || '';
    const middleName = userData.MiddleName || '';
    
    let fullName = '';
    if (firstName && lastName) {
      fullName = middleName ? `${firstName} ${lastName} ${middleName}` : `${firstName} ${lastName}`;
    } else {
      fullName = userData.UserName;
    }

    return NextResponse.json({
      success: true,
      user: {
        SystemUserID: userData.SystemUserID,
        UserName: userData.UserName,
        EmployeeID: userData.EmployeeID,
        FirstName: userData.FirstName,
        LastName: userData.LastName,
        MiddleName: userData.MiddleName,
        FullName: fullName.trim(),
        Email: userData.Email,
        UserTypeID: userData.UserTypeID,
        CreationDate: userData.CreationDate
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