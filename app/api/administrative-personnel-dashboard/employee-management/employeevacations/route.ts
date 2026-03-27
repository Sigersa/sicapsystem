import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase();
};

// GET: Obtener todos los proyectos
export async function GET(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    connection = await getConnection();
    
        const [baseEmployees] = await connection.execute(`
          SELECT 
            e.EmployeeID,
            bp.BasePersonnelID,
            bp.FirstName,
            bp.LastName,
            bp.MiddleName,
            bp.Position,
            bc.StartDate,
            es.YearsOfSeniority,
            es.DaysOfVacations
          FROM basepersonnel bp
          INNER JOIN employees e ON bp.EmployeeID = e.EmployeeID
          LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
          LEFT JOIN employeeseniority es ON es.EmployeeID = e.EmployeeID 
          ORDER BY bp.LastName, bp.FirstName
    `);

    
    return NextResponse.json(baseEmployees, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    
    return NextResponse.json(
      { error: 'ERROR AL OBTENER LOS PROYECTOS' },
      { status: 500 }
    );
  } finally {
        if (connection) connection.release();
  }
}

