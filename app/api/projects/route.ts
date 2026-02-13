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
      'SELECT * FROM projects ORDER BY ProjectID DESC'
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
    let { NameProject, ProjectAddress } = body;

    // Validaciones
    if (!NameProject || !ProjectAddress) {
      return NextResponse.json(
        { message: 'EL NOMBRE Y LA DIRECCIÓN DEL PROYECTO SON REQUERIDOS' },
        { status: 400 }
      );
    }

    // Normalizar a mayúsculas
    NameProject = normalizarMayusculas(NameProject.trim());
    ProjectAddress = normalizarMayusculas(ProjectAddress.trim());

    connection = await getConnection();
    
    const [result] = await connection.execute(
      'INSERT INTO projects (NameProject, ProjectAddress) VALUES (?, ?)',
      [NameProject, ProjectAddress]
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