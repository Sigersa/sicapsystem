import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface Area extends RowDataPacket {
  AreaID: number;
  AreaName: string;
  ClientID: number;
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

    // Verificar permisos (UserTypeID 2 = Administrativo, 1 = Admin General, 3 = RH)
    if (![4].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    // Si no hay clientId, devolver todas las áreas
    if (!clientId) {
      const [allAreas] = await connection.query<Area[]>(
        `SELECT * FROM areas ORDER BY AreaName ASC`
      );
      return NextResponse.json(allAreas);
    }

    const [areas] = await connection.query<Area[]>(
      `SELECT * FROM areas WHERE ClientID = ? ORDER BY AreaName ASC`,
      [clientId]
    );

    return NextResponse.json(areas);
  } catch (error) {
    console.error('Error en GET /api/areas:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al obtener áreas',
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

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Verificar permisos (UserTypeID 2 = Administrativo, 1 = Admin General, 3 = RH)
    if (![1, 2, 3].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { AreaName, ClientID } = await request.json();

    if (!AreaName || !ClientID) {
      return NextResponse.json(
        { success: false, message: 'AreaName y ClientID son requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Verificar si el cliente existe
    const [clientRows] = await connection.query<RowDataPacket[]>(
      'SELECT ClientID FROM clients WHERE ClientID = ?',
      [ClientID]
    );

    if (clientRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'El cliente especificado no existe' },
        { status: 400 }
      );
    }

    // Verificar si ya existe un área con el mismo nombre para este cliente
    const [existingArea] = await connection.query<Area[]>(
      'SELECT AreaID FROM areas WHERE AreaName = ? AND ClientID = ?',
      [AreaName, ClientID]
    );

    if (existingArea.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Ya existe un área con este nombre para el cliente especificado' },
        { status: 400 }
      );
    }

    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO areas (AreaName, ClientID) VALUES (?, ?)',
      [AreaName, ClientID]
    );

    const [newAreaRows] = await connection.query<Area[]>(
      'SELECT * FROM areas WHERE AreaID = ?',
      [result.insertId]
    );

    return NextResponse.json(newAreaRows[0], { status: 201 });
  } catch (error) {
    console.error('Error al crear área:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al crear área',
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

export async function PUT(request: NextRequest): Promise<NextResponse> {
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

    // Verificar permisos (UserTypeID 2 = Administrativo, 1 = Admin General, 3 = RH)
    if (![1, 2, 3].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('id');

    if (!areaId) {
      return NextResponse.json(
        { success: false, message: 'ID de área es requerido' },
        { status: 400 }
      );
    }

    const { AreaName, ClientID } = await request.json();

    if (!AreaName || !ClientID) {
      return NextResponse.json(
        { success: false, message: 'AreaName y ClientID son requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Verificar si el área existe
    const [areaRows] = await connection.query<Area[]>(
      'SELECT * FROM areas WHERE AreaID = ?',
      [areaId]
    );

    if (areaRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Área no encontrada' },
        { status: 404 }
      );
    }

    // Verificar si el cliente existe
    const [clientRows] = await connection.query<RowDataPacket[]>(
      'SELECT ClientID FROM clients WHERE ClientID = ?',
      [ClientID]
    );

    if (clientRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'El cliente especificado no existe' },
        { status: 400 }
      );
    }

    // Verificar si ya existe otro área con el mismo nombre para este cliente
    const [existingArea] = await connection.query<Area[]>(
      'SELECT AreaID FROM areas WHERE AreaName = ? AND ClientID = ? AND AreaID != ?',
      [AreaName, ClientID, areaId]
    );

    if (existingArea.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Ya existe otro área con este nombre para el cliente especificado' },
        { status: 400 }
      );
    }

    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE areas SET AreaName = ?, ClientID = ? WHERE AreaID = ?',
      [AreaName, ClientID, areaId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'No se pudo actualizar el área' },
        { status: 400 }
      );
    }

    const [updatedAreaRows] = await connection.query<Area[]>(
      'SELECT * FROM areas WHERE AreaID = ?',
      [areaId]
    );

    return NextResponse.json(updatedAreaRows[0]);
  } catch (error) {
    console.error('Error al actualizar área:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al actualizar área',
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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

    // Verificar permisos (UserTypeID 2 = Administrativo, 1 = Admin General, 3 = RH)
    if (![1, 2, 3].includes(user.UserTypeID)) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('id');

    if (!areaId) {
      return NextResponse.json(
        { success: false, message: 'ID de área es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Verificar si el área existe
    const [areaRows] = await connection.query<Area[]>(
      'SELECT * FROM areas WHERE AreaID = ?',
      [areaId]
    );

    if (areaRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Área no encontrada' },
        { status: 404 }
      );
    }

    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM areas WHERE AreaID = ?',
      [areaId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'No se pudo eliminar el área' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Área eliminada correctamente' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error al eliminar área:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Error al eliminar área',
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