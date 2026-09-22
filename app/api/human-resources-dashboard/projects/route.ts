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
    
    const [projects] = await connection.execute(
      `SELECT 
          p.ProjectID,
          p.NameProject,
          p.ProjectAddress,
          p.AdminProjectID,
          p.StartDate,
          p.EndDate,
          p.Status,
          bp.FirstName,
          bp.LastName,
          bp.MiddleName
      FROM projects p
      INNER JOIN employees e ON e.EmployeeID = p.AdminProjectID
      LEFT JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID 
      ORDER BY p.Status DESC, p.ProjectID DESC`
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

// POST: Crear un nuevo proyecto
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    let { NameProject, ProjectAddress, AdminProjectID, StartDate, EndDate } = body;

    // Validaciones
    if (!NameProject || !ProjectAddress || !AdminProjectID || !StartDate || !EndDate) {
      return NextResponse.json(
        { message: 'TODOS LOS CAMPOS SON REQUERIDOS (NOMBRE, DIRECCIÓN, ADMINISTRADOR, FECHA INICIO, FECHA TÉRMINO)' },
        { status: 400 }
      );
    }

    // Validar fechas
    if (new Date(EndDate) <= new Date(StartDate)) {
      return NextResponse.json(
        { message: 'LA FECHA DE TÉRMINO DEBE SER POSTERIOR A LA FECHA DE INICIO' },
        { status: 400 }
      );
    }

    // Normalizar a mayúsculas
    NameProject = normalizarMayusculas(NameProject.trim());
    ProjectAddress = normalizarMayusculas(ProjectAddress.trim());

    if (NameProject.length > 1000 || ProjectAddress.length > 1000) {
      return NextResponse.json(
        { message: 'DATOS DEMASIADO LARGOS' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    
    const [result] = await connection.execute(
      'INSERT INTO projects (NameProject, ProjectAddress, AdminProjectID, StartDate, EndDate, Status) VALUES (?, ?, ?, ?, ?, 1)',
      [NameProject, ProjectAddress, AdminProjectID, StartDate, EndDate]
    );
    
    const insertedId = (result as any).insertId;
    
    return NextResponse.json(
      { 
        message: 'PROYECTO CREADO EXITOSAMENTE',
        projectId: insertedId,
        success: true 
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error('Error creating project:', error);
    
    return NextResponse.json(
      { 
        message: 'ERROR AL CREAR EL PROYECTO',
        error: error instanceof Error ? error.message : 'ERROR DESCONOCIDO'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}