import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket } from 'mysql2';

interface Employee extends RowDataPacket {
  EmployeeID: number;
  EmployeeType: string;
  Status: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    connection = await getConnection();

    const [employees] = await connection.query<Employee[]>(`
      SELECT EmployeeID, EmployeeType, Status 
      FROM employees 
      ORDER BY EmployeeID ASC
    `);

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error en GET /api/executive-manager/employees:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al obtener empleados',
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