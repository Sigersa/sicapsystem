import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

interface Project extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
  AdminProjectID: number;
  CreatedBy: number;
}

interface SystemUser extends RowDataPacket {
  SystemUserID: number;
}

// Helper para validar sesión
async function getAuthenticatedUser(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) return null;
  return await validateAndRenewSession(sessionId);
}

// POST - Manejar notificaciones de gastos de consumibles administrativos
export async function POST(request: NextRequest): Promise<NextResponse> {
  let connection;

  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { projectId, administrativeConsumableId, isUpdate = false } = await request.json();

    console.log('🔵 [notif] Datos recibidos:', { projectId, administrativeConsumableId, isUpdate });

    if (!projectId || !administrativeConsumableId) {
      return NextResponse.json(
        { message: 'Project ID y Administrative Consumable ID son requeridos' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener información del proyecto
    const [projectRows] = await connection.execute<Project[]>(
      `SELECT NameProject, AdminProjectID, CreatedBy 
       FROM projects 
       WHERE ProjectID = ?`,
      [projectId]
    );

    console.log('🔵 [notif] Proyecto encontrado:', projectRows);

    if (projectRows.length === 0) {
      return NextResponse.json(
        { message: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const project = projectRows[0];
    const action = isUpdate ? 'actualizado' : 'registrado';

    // Resolver el SystemUserID del admin del proyecto
    const [adminUserRows] = await connection.execute<SystemUser[]>(
      `SELECT SystemUserID 
       FROM systemusers 
       WHERE EmployeeID = ? 
       LIMIT 1`,
      [project.AdminProjectID]
    );

    const adminSystemUserId =
      adminUserRows.length > 0 ? adminUserRows[0].SystemUserID : null;

    console.log('🔵 [notif] Admin SystemUserID:', adminSystemUserId);

    if (!adminSystemUserId) {
      return NextResponse.json(
        { message: 'No se encontró el usuario del sistema del admin del proyecto', notifiedUsers: 0 },
        { status: 200 }
      );
    }

    // Crear la notificación
    const [notificationResult] = await connection.execute(
      `INSERT INTO notification 
       (UserID, Title, Message, RelatedEntity, EntityID, ProjectID, Type)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        adminSystemUserId,
        isUpdate
          ? 'Registro de consumible administrativo actualizado'
          : 'Nuevo registro de consumible administrativo',
        `Se ha ${action} un registro de consumible administrativo en el proyecto ${project.NameProject}`,
        'administrativeconsumable',
        administrativeConsumableId,
        projectId
      ]
    );

    const notificationId = (notificationResult as any).insertId;

    // Insertar en usernotification
    await connection.execute(
      `INSERT INTO usernotification (NotificationID, UserID, IsRead) VALUES (?, ?, 0)`,
      [notificationId, adminSystemUserId]
    );

    return NextResponse.json(
      {
        message: `Notificación de gasto de consumible administrativo ${action} creada correctamente`,
        notifiedUsers: 1
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      '🔴 [notif] Error al procesar notificación de gastos de consumible administrativo:',
      error
    );
    return NextResponse.json(
      { message: 'Error al procesar notificación de gastos de consumible administrativo' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}