import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from "@/lib/auth";

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase();
};

/* =========================
   GET: obtener proyecto por ID
========================= */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

     if (user.UserTypeID !== 2) {
     return NextResponse.json(
     { message: 'ACCESO DENEGADO - SE REQUIEREN PERMISOS DE ADMINISTRADOR' },
         { status: 403 }
       );
     }

    const { id } = await context.params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: 'ID DE PROYECTO INVÁLIDO' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [projects] = await connection.execute(
      'SELECT * FROM projects WHERE ProjectID = ?',
      [id]
    );

    const result = projects as any[];

    if (result.length === 0) {
      return NextResponse.json(
        { message: 'PROYECTO NO ENCONTRADO' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0], { status: 200 });
    
  } catch (error) {
    console.error('GET project error:', error);

    return NextResponse.json(
      { message: 'ERROR AL OBTENER EL PROYECTO' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}

/* =========================
   PUT: actualizar proyecto
========================= */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

     if (user.UserTypeID !== 2) {
       return NextResponse.json(
         { message: 'ACCESO DENEGADO - SE REQUIEREN PERMISOS DE ADMINISTRADOR' },
         { status: 403 }
       );
     }

    const { id } = await context.params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: 'ID DE PROYECTO INVÁLIDO' },
        { status: 400 }
      );
    }

    let { NameProject, ProjectAddress } = await request.json();

    if (!NameProject || !ProjectAddress) {
      return NextResponse.json(
        { message: 'EL NOMBRE Y LA DIRECCIÓN DEL PROYECTO SON REQUERIDOS' },
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

    const [exists] = await connection.execute(
      'SELECT ProjectID FROM projects WHERE ProjectID = ?',
      [id]
    );

    if ((exists as any[]).length === 0) {
      return NextResponse.json(
        { message: 'PROYECTO NO ENCONTRADO' },
        { status: 404 }
      );
    }

    await connection.execute(
      `UPDATE projects 
       SET NameProject = ?, ProjectAddress = ?
       WHERE ProjectID = ?`,
      [NameProject, ProjectAddress, id]
    );

    return NextResponse.json(
      { message: 'PROYECTO ACTUALIZADO EXITOSAMENTE', success: true },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('PUT project error:', error);

    return NextResponse.json(
      { message: 'ERROR AL ACTUALIZAR EL PROYECTO' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}

/* =========================
   DELETE: eliminar proyecto
========================= */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

     if (user.UserTypeID !== 2) {
       return NextResponse.json(
         { message: 'ACCESO DENEGADO - SE REQUIEREN PERMISOS DE ADMINISTRADOR' },
         { status: 403 }
       );
     }

    const { id } = await context.params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: 'ID DE PROYECTO INVÁLIDO' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [exists] = await connection.execute(
      'SELECT ProjectID FROM projects WHERE ProjectID = ?',
      [id]
    );

    if ((exists as any[]).length === 0) {
      return NextResponse.json(
        { message: 'PROYECTO NO ENCONTRADO' },
        { status: 404 }
      );
    }

    await connection.execute(
      'DELETE FROM projects WHERE ProjectID = ?',
      [id]
    );

    return NextResponse.json(
      { message: 'PROYECTO ELIMINADO EXITOSAMENTE', success: true },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('DELETE project error:', error);

    return NextResponse.json(
      { message: 'ERROR AL ELIMINAR EL PROYECTO' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.release();
  }
}