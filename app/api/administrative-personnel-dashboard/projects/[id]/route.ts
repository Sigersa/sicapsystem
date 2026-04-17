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
  { params }: { params: Promise<{ id: string }> | { id: string } }
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

    const resolvedParams = await params;
    const { id } = resolvedParams;

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
   PUT: actualizar proyecto O marcar como concluido
========================= */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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

    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { message: 'ID DE PROYECTO INVÁLIDO' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Verificar si es una solicitud para concluir el proyecto
    if (body.complete === true) {
      // Marcar proyecto como concluido
      connection = await getConnection();

      // Verificar si el proyecto existe
      const [exists] = await connection.execute(
        'SELECT ProjectID, Status FROM projects WHERE ProjectID = ?',
        [id]
      );

      const projectData = exists as any[];
      if (projectData.length === 0) {
        return NextResponse.json(
          { message: 'PROYECTO NO ENCONTRADO' },
          { status: 404 }
        );
      }

      // Verificar si ya está concluido
      if (projectData[0].Status === 0) {
        return NextResponse.json(
          { message: 'EL PROYECTO YA ESTÁ MARCADO COMO CONCLUIDO' },
          { status: 400 }
        );
      }

      // Actualizar el status a 0 (concluido)
      await connection.execute(
        'UPDATE projects SET Status = 0 WHERE ProjectID = ?',
        [id]
      );

      return NextResponse.json(
        { message: 'PROYECTO MARCADO COMO CONCLUIDO EXITOSAMENTE', success: true },
        { status: 200 }
      );
    }

    // Si no es para concluir, entonces es para actualizar datos del proyecto
    let { NameProject, ProjectAddress, AdminProjectID, StartDate, EndDate } = body;

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

    // Verificar si el proyecto existe y está activo
    const [exists] = await connection.execute(
      'SELECT ProjectID, Status FROM projects WHERE ProjectID = ?',
      [id]
    );

    const projectData = exists as any[];
    if (projectData.length === 0) {
      return NextResponse.json(
        { message: 'PROYECTO NO ENCONTRADO' },
        { status: 404 }
      );
    }

    // No permitir editar proyectos concluidos
    if (projectData[0].Status === 0) {
      return NextResponse.json(
        { message: 'NO SE PUEDE EDITAR UN PROYECTO CONCLUIDO' },
        { status: 400 }
      );
    }

    await connection.execute(
      `UPDATE projects 
       SET NameProject = ?, ProjectAddress = ?, AdminProjectID = ?, StartDate = ?, EndDate = ?
       WHERE ProjectID = ?`,
      [NameProject, ProjectAddress, AdminProjectID, StartDate, EndDate, id]
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
  { params }: { params: Promise<{ id: string }> | { id: string } }
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

    const resolvedParams = await params;
    const { id } = resolvedParams;

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