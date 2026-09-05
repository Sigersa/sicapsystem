import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface Client extends RowDataPacket {
  ClientID: number;
  ClientName: string;
  BusinessName: string;
}

// GET - Obtener todos los clientes
export async function GET(request: NextRequest): Promise<NextResponse> {
  let connection = null;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    
    if (!user) {
      return NextResponse.json({ error: "SESIÓN INVÁLIDA" }, { status: 401 });
    }

    connection = await getConnection();

    const [clients] = await connection.query<Client[]>(
      `SELECT 
          ClientID as clientId,
          ClientName as clientName,
          BusinessName as businessName
        FROM clients
        ORDER BY ClientName ASC`
    );

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    return NextResponse.json(
      { message: 'Error al obtener clientes' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// POST - Crear nuevo cliente
export async function POST(request: NextRequest): Promise<NextResponse> {
  let connection = null;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    
    if (!user) {
      return NextResponse.json({ error: "SESIÓN INVÁLIDA" }, { status: 401 });
    }

    const {
      clientName,
      businessName
    } = await request.json();

    // Validación de campos requeridos
    if (!clientName || !businessName) {
      return NextResponse.json(
        { message: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    // Crear el registro en la base de datos
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO clients 
       (ClientName, BusinessName) 
       VALUES (?, ?)`,
      [
        clientName,
        businessName
      ]
    );

    const clientId = result.insertId;

    await connection.commit();

    return NextResponse.json({ 
      message: 'Cliente creado correctamente',
      id: clientId,
      clientId,
      clientName,
      businessName
    }, { status: 201 });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error al crear cliente:', error);
    return NextResponse.json(
      { message: 'Error al crear cliente' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// PUT - Actualizar cliente existente
export async function PUT(request: NextRequest): Promise<NextResponse> {
  let connection = null;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    
    if (!user) {
      return NextResponse.json({ error: "SESIÓN INVÁLIDA" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID es requerido' },
        { status: 400 }
      );
    }

    const {
      clientName,
      businessName
    } = await request.json();

    connection = await getConnection();
    await connection.beginTransaction();

    // Verificar que el cliente existe
    const [clientRows] = await connection.query<Client[]>(
      `SELECT * FROM clients WHERE ClientID = ?`,
      [id]
    );
    
    if (clientRows.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { message: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si hay cambios reales
    const client = clientRows[0];
    const hasChanges = 
      client.ClientName !== clientName ||
      client.BusinessName !== businessName;

    // Si no hay cambios, retornar sin actualizar
    if (!hasChanges) {
      await connection.commit();
      return NextResponse.json({ 
        message: 'No se realizaron cambios',
        clientId: parseInt(id),
        clientName,
        businessName
      });
    }

    // Actualizar el registro
    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE clients SET
        ClientName = ?,
        BusinessName = ?
       WHERE ClientID = ?`,
      [
        clientName,
        businessName,
        id
      ]
    );

    await connection.commit();

    return NextResponse.json({ 
      message: 'Cliente actualizado correctamente',
      affectedRows: result.affectedRows,
      clientId: parseInt(id),
      clientName,
      businessName
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error al actualizar cliente:', error);
    return NextResponse.json(
      { message: 'Error al actualizar cliente' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// DELETE - Eliminar cliente
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let connection = null;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    
    if (!user) {
      return NextResponse.json({ error: "SESIÓN INVÁLIDA" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'ID es requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    // Verificar que el cliente existe
    const [clientRows] = await connection.query<Client[]>(
      `SELECT * FROM clients WHERE ClientID = ?`,
      [id]
    );
    
    if (clientRows.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { message: 'No se encontró el cliente a eliminar' },
        { status: 404 }
      );
    }

    // Verificar si el cliente tiene proyectos asociados
    const [projectRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM projects WHERE ClientID = ?`,
      [id]
    );

    if (projectRows[0].count > 0) {
      await connection.rollback();
      return NextResponse.json(
        { 
          message: 'No se puede eliminar el cliente porque tiene proyectos asociados. Elimine o reasigne los proyectos primero.' 
        },
        { status: 409 }
      );
    }

    // Eliminar el cliente
    const [result] = await connection.query<ResultSetHeader>(
      `DELETE FROM clients WHERE ClientID = ?`,
      [id]
    );

    await connection.commit();

    return NextResponse.json({ 
      message: 'Cliente eliminado correctamente',
      affectedRows: result.affectedRows 
    });
  } catch (error: any) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error al eliminar cliente:', error);

    // Manejar errores de clave foránea
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return NextResponse.json(
        { 
          message: 'No se puede eliminar el cliente porque tiene registros dependientes en otras tablas.' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: 'Error al eliminar cliente' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}