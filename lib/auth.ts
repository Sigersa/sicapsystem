import { getConnection } from '@/lib/db';

export async function validateAndRenewSession(sessionId: string) {
  const connection = await getConnection();

  try {
    const [rows]: any = await connection.execute(
      `
      SELECT 
        s.id,
        u.SystemUserID,
        u.UserName,
        u.UserTypeID
      FROM sessions s
      JOIN systemusers u ON u.SystemUserID = s.user_id
      WHERE s.id = ?
        AND s.expires_at > NOW()
      `,
      [sessionId]
    );

    if (rows.length === 0) {
      return null;
    }

    // Renovar sesión
    await connection.execute(
      `
      UPDATE sessions
      SET expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
      WHERE id = ?
      `,
      [sessionId]
    );

    return rows[0];

  } finally {
    connection.release();
  }
}
