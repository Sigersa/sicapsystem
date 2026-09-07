import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket } from 'mysql2';

interface User extends RowDataPacket {
  SystemUserID: number;
  UserName: string;
  EmployeeID: number | null;
  FirstName?: string;
  LastName?: string;
  EmployeeType?: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    // Verificar permisos (solo ejecutivos pueden ver empleados)
    if (![4].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    // Consulta mejorada para obtener todos los usuarios de tipo empleado (UserTypeID = 3)
    const [rows] = await connection.query<User[]>(`
      SELECT 
        su.SystemUserID,
        su.UserName,
        su.EmployeeID,
        e.EmployeeType,
        e.Status as EmployeeStatus,
        bp.FirstName,
        bp.LastName
      FROM systemusers su
      INNER JOIN employees e ON e.EmployeeID = su.EmployeeID 
      LEFT JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID
      WHERE su.UserTypeID = 3
        AND e.Status = 1
      ORDER BY bp.FirstName ASC, bp.LastName ASC
    `);

    // Transformar los datos para que coincidan con la interfaz SystemUser del frontend
    const users = Array.isArray(rows)
      ? rows.map((user) => {
          // Construir el nombre completo
          let fullName = user.UserName || '';
          if (user.FirstName && user.LastName) {
            fullName = `${user.FirstName} ${user.LastName}`;
          } else if (user.FirstName) {
            fullName = user.FirstName;
          } else if (user.LastName) {
            fullName = user.LastName;
          }

          return {
            SystemUserID: user.SystemUserID,
            UserName: fullName || user.UserName || 'Usuario sin nombre',
            EmployeeID: user.EmployeeID,
            EmployeeType: user.EmployeeType || 'Empleado',
            Status: user.EmployeeStatus || 1,
            Email: user.Email || ''
          };
        })
      : [];

    return NextResponse.json(users);
    
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al obtener usuarios',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}