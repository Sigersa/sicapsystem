import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
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

    // Verificar permisos (Admin y System Admin)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { field, value } = await request.json();

    if (!field || !value) {
      return NextResponse.json(
        { success: false, message: 'CAMPO Y VALOR REQUERIDOS' },
        { status: 400 }
      );
    }

    // Validar que el campo sea uno de los permitidos
    const allowedFields = ['rfc', 'curp', 'nss'];
    if (!allowedFields.includes(field)) {
      return NextResponse.json(
        { success: false, message: 'CAMPO NO VÁLIDO PARA VERIFICACIÓN' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Determinar qué tablas consultar según el campo
    let query = '';
    let params: any[] = [value];

    if (field === 'rfc') {
      query = `
        SELECT 'BASE' as tipo FROM basepersonnelpersonalinfo WHERE RFC = ?
        UNION
        SELECT 'PROJECT' as tipo FROM projectpersonnelpersonalinfo WHERE RFC = ?
      `;
    } else if (field === 'curp') {
      query = `
        SELECT 'BASE' as tipo FROM basepersonnelpersonalinfo WHERE CURP = ?
        UNION
        SELECT 'PROJECT' as tipo FROM projectpersonnelpersonalinfo WHERE CURP = ?
      `;
    } else if (field === 'nss') {
      query = `
        SELECT 'BASE' as tipo FROM basepersonnelpersonalinfo WHERE NSS = ?
        UNION
        SELECT 'PROJECT' as tipo FROM projectpersonnelpersonalinfo WHERE NSS = ?
      `;
    }

    const [rows] = await connection.execute(query, [value, value]);

    const exists = Array.isArray(rows) && rows.length > 0;

    // Determinar mensaje según el campo
    const fieldNames: Record<string, string> = {
      rfc: 'RFC',
      curp: 'CURP',
      nss: 'NSS'
    };

    const message = exists 
      ? `EL ${fieldNames[field] || field} YA ESTÁ REGISTRADO EN EL SISTEMA`
      : undefined;

    return NextResponse.json({
      success: true,
      exists,
      message,
      field
    });

  } catch (error) {
    console.error('Error al verificar duplicados:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL VERIFICAR DUPLICADOS',
        exists: false 
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

export async function GET() {
  return NextResponse.json(
    { message: 'MÉTODO NO PERMITIDO' },
    { status: 405 }
  );
}