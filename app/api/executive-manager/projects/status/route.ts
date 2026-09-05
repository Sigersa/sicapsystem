import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";


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

    if (!user || user.UserTypeID !== 4) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    connection = await getConnection();
    
    const [projects] = await connection.execute(
      `SELECT 
          p.ProjectID,
          p.NameProject,
          p.ProjectBudget,
          p.CreatedBy,
          pe.TotalExpenses,
          pe.BudgetUsagePercentage
      FROM projects p
      LEFT JOIN projectexpenses pe ON p.ProjectID = pe.ProjectID
      WHERE p.Status = 0`
    );
    
    return NextResponse.json(projects, { status: 200 });
    
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