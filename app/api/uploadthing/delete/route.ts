import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';
import { validateAndRenewSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
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

    // Verificar permisos (solo administradores)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const { fileKey } = await request.json();

    if (!fileKey) {
      return NextResponse.json(
        { success: false, message: 'File key is required' },
        { status: 400 }
      );
    }

    const utapi = new UTApi();
    await utapi.deleteFiles([fileKey]);

    return NextResponse.json({
      success: true,
      message: 'Archivo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error al eliminar el archivo' 
      },
      { status: 500 }
    );
  }
}