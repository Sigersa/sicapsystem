import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  let connection;

  try {
    // Desempaquetar los parámetros
    const { employeeId } = await params;
    
    // Validar que employeeId sea un número
    if (!employeeId || isNaN(parseInt(employeeId))) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado inválido' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    
    // Consulta para obtener la URL del PDF del warning según el tipo de empleado
    const [rows]: any = await connection.query(`
      SELECT 
        e.EmployeeID,
        e.EmployeeType,
        CASE 
          WHEN e.EmployeeType = 'BASE' THEN bc.WarningFileURL
          WHEN e.EmployeeType = 'PROJECT' THEN pc.WarningFileURL
          ELSE NULL
        END as WarningFileURL
      FROM employees e
      LEFT JOIN basecontracts bc ON e.BasePersonnelID = bc.BasePersonnelID AND e.EmployeeType = 'BASE'
      LEFT JOIN projectcontracts pc ON e.ProjectPersonnelID = pc.ProjectPersonnelID AND e.EmployeeType = 'PROJECT'
      WHERE e.EmployeeID = ?
      LIMIT 1
    `, [parseInt(employeeId)]);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const warningFileURL = rows[0].WarningFileURL;

    if (!warningFileURL) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Documento de advertencia no encontrado para este empleado',
          employeeId,
          employeeType: rows[0].EmployeeType
        },
        { status: 404 }
      );
    }

    // Obtener el nombre del archivo desde la URL
    const fileName = `contrato_${employeeId}.pdf`;
    
    // Redirigir a la URL de UploadThing con headers para descarga
    const response = await fetch(warningFileURL);
    
    if (!response.ok) {
      throw new Error(`Error al obtener el archivo: ${response.statusText}`);
    }
    
    // Obtener el contenido del archivo
    const fileBuffer = await response.arrayBuffer();
    
    // Crear una nueva respuesta con los headers adecuados para forzar descarga
    const downloadResponse = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    return downloadResponse;

  } catch (error) {
    console.error('Error al descargar warning:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error al descargar el documento',
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}