import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase();
};

// GET: Obtener todos los proyectos
export async function GET(request: NextRequest) {
  let connection;
  try {
    connection = await getConnection();
    
    const [projects] = await connection.execute(
      'SELECT * FROM projects ORDER BY ProjectID DESC'
    );
    
    await connection.release();
    
    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error('Error fetching projects:', error);
    
    if (connection) {
      await connection.release();
    }
    
    return NextResponse.json(
      { 
        message: 'ERROR AL OBTENER LOS PROYECTOS',
        error: error instanceof Error ? error.message : 'ERROR DESCONOCIDO'
      },
      { status: 500 }
    );
  }
}

// POST: Crear un nuevo proyecto
export async function POST(request: NextRequest) {
  let connection;
  try {
    const body = await request.json();
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

    if (NameProject.length > 1000) {
      return NextResponse.json(
        { message: 'EL NOMBRE DEL PROYECTO ES DEMASIADO LARGO' },
        { status: 400 }
      );
    }

    if (ProjectAddress.length > 1000) {
      return NextResponse.json(
        { message: 'LA DIRECCIÓN DEL PROYECTO ES DEMASIADO LARGA' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    
    const [result] = await connection.execute(
      'INSERT INTO projects (NameProject, ProjectAddress) VALUES (?, ?)',
      [NameProject, ProjectAddress]
    );
    
    await connection.release();
    
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
    
    if (connection) {
      await connection.release();
    }
    
    return NextResponse.json(
      { 
        message: 'ERROR AL CREAR EL PROYECTO',
        error: error instanceof Error ? error.message : 'ERROR DESCONOCIDO'
      },
      { status: 500 }
    );
  }
}