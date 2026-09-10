import { NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { RowDataPacket } from 'mysql2';
import { validateAndRenewSession } from '@/lib/auth';

interface DBNotification extends RowDataPacket {
  id: number;
  title: string;
  message: string;
  isRead: number;
  createdAt: string;
  entityType: string;
  entityId: number;
  relatedUserId: number;
  type: number;
  projectId: number;
  createdByUserId: number;
  createdByUserName: string;
}

interface ApiNotification {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  entityType: string;
  entityId: number;
  relatedUserId: number;
  type: number;
  projectId: number;
  createdByUserId: number;
  createdByUserName: string;
}

// Función para obtener usuario de la sesión
async function getUserFromSession() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;

    if (!sessionId) {
      return null;
    }

    return await validateAndRenewSession(sessionId);
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

// Convierte UTC a hora de CDMX y formatea con AM/PM
function formatToCDMXTime(dateString: string): string {
  try {
    // Crear objeto de fecha a partir de la cadena UTC de la base de datos
    const utcDate = new Date(dateString);
    
    // Verificar si la fecha es válida
    if (isNaN(utcDate.getTime())) {
      console.error('Fecha inválida:', dateString);
      return 'Fecha inválida';
    }
    
    // Ajustar a zona horaria de CDMX (UTC-6)
    const cdmxDate = new Date(utcDate.getTime() - (6 * 60 * 60 * 1000));
    
    // Obtener componentes de la fecha
    const day = cdmxDate.getDate().toString().padStart(2, '0');
    const month = (cdmxDate.getMonth() + 1).toString().padStart(2, '0');
    const year = cdmxDate.getFullYear();
    
    // Obtener hora en formato 12 horas con AM/PM
    let hours = cdmxDate.getHours();
    const minutes = cdmxDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convertir a formato 12 horas
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 debería ser 12
    
    return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formateando fecha:', error);
    return 'Error en fecha';
  }
}

// GET: obtener notificaciones
export async function GET() {
  let connection;
  try {
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    connection = await getConnection();

    let query = '';
    let params: any[] = [];

    if (user.UserTypeID === 5) {
      query = `
        SELECT 
          n.NotificationID AS id,
          n.Title AS title,
          n.Message AS message,
          un.IsRead AS isRead,
          n.CreatedAt AS createdAt,
          n.RelatedEntity AS entityType,
          n.EntityID AS entityId,
          n.UserID AS relatedUserId,
          n.ProjectID AS projectId,
          n.Type AS type,
          u.SystemUserID AS createdByUserId,
          u.UserName AS createdByUserName
        FROM notification n
        INNER JOIN usernotification un ON n.NotificationID = un.NotificationID
        INNER JOIN systemusers u ON n.UserID = u.SystemUserID
        INNER JOIN projects p ON n.ProjectID = p.ProjectID
        WHERE un.UserID = ? AND p.CreatedBy = ?
        ORDER BY n.CreatedAt DESC
      `;
      params = [user.SystemUserID, user.SystemUserID];
    } else {
      // Para todos los demás usuarios: todas sus notificaciones
      query = `
        SELECT 
          n.NotificationID AS id,
          n.Title AS title,
          n.Message AS message,
          un.IsRead AS isRead,
          n.CreatedAt AS createdAt,
          n.RelatedEntity AS entityType,
          n.EntityID AS entityId,
          n.UserID AS relatedUserId,
          n.ProjectID AS projectId,
          n.Type AS type,
          u.SystemUserID AS createdByUserId,
          u.UserName AS createdByUserName
        FROM notification n
        INNER JOIN usernotification un ON n.NotificationID = un.NotificationID
        INNER JOIN systemusers u ON n.UserID = u.SystemUserID
        WHERE un.UserID = ?
        ORDER BY n.CreatedAt DESC
      `;
      params = [user.SystemUserID];
    }

    const [dbNotifications] = await connection.query<DBNotification[]>(query, params);

    const notifications: ApiNotification[] = Array.isArray(dbNotifications)
      ? dbNotifications.map(n => ({ 
          ...n, 
          isRead: n.isRead === 1,
          createdAt: formatToCDMXTime(n.createdAt.toString()) 
        }))
      : [];

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('Error en API de notificaciones:', error);
    return NextResponse.json(
      { message: 'Error interno del servidor' },
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

// POST: marcar notificación como leída
export async function POST(request: Request) {
  let connection;
  try {
    const user = await getUserFromSession();
    
    if (!user) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { message: 'ID de notificación requerido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Para usuarios tipo 5 (ejecutivos), verificar que la notificación pertenece a un proyecto que crearon
    let verificationQuery = '';
    let verificationParams: any[] = [];

    if (user.UserTypeID === 5) {
      verificationQuery = `
        SELECT un.* 
        FROM usernotification un
        INNER JOIN notification n ON un.NotificationID = n.NotificationID
        INNER JOIN projects p ON n.ProjectID = p.ProjectID
        WHERE un.NotificationID = ? AND un.UserID = ? AND p.CreatedBy = ?
      `;
      verificationParams = [notificationId, user.SystemUserID, user.SystemUserID];
    } else {
      verificationQuery = `
        SELECT un.* 
        FROM usernotification un 
        WHERE un.NotificationID = ? AND un.UserID = ?
      `;
      verificationParams = [notificationId, user.SystemUserID];
    }

    const [notificationRows] = await connection.query<RowDataPacket[]>(
      verificationQuery,
      verificationParams
    );

    if (notificationRows.length === 0) {
      return NextResponse.json(
        { message: 'Notificación no encontrada' },
        { status: 404 }
      );
    }

    await connection.query(
      `UPDATE usernotification SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?`,
      [notificationId, user.SystemUserID]
    );

    return NextResponse.json({
      message: 'Notificación marcada como leída',
      success: true
    });
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    return NextResponse.json(
      {
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Desconocido'
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