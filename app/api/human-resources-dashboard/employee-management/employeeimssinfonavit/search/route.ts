import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
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

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const term = searchParams.get("term");

    if (!term) {
      return NextResponse.json(
        { success: false, message: 'Término de búsqueda requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [rows] = await connection.execute(
      `SELECT 
        e.EmployeeID,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        bp.Area,
        pj.NameProject,
        COALESCE(bc.SalaryIMSS, pc.SalaryIMSS) as SalaryIMSS,
        COALESCE(bpi.NCI, ppi.NCI) as NCI,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          WHEN pp.EmployeeID IS NOT NULL THEN 'PROJECT'
          ELSE 'NO ESPECIFICADO'
        END as tipo
      FROM employees e
      LEFT JOIN basepersonnel bp ON e.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      LEFT JOIN projectpersonnel pp ON e.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      WHERE e.EmployeeID = ? OR 
            bp.FirstName LIKE ? OR 
            bp.LastName LIKE ? OR
            pp.FirstName LIKE ? OR
            pp.LastName LIKE ?
      LIMIT 10`,
      [term, `%${term}%`, `%${term}%`, `%${term}%`, `%${term}%`]
    );

    return NextResponse.json({
      success: true,
      employees: rows
    });

  } catch (error) {
    console.error('Error al buscar empleados:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL BUSCAR EMPLEADOS',
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