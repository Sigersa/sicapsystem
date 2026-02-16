import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  let connection;

  try {
    const { employeeId } = await params;
    
    if (!employeeId || isNaN(parseInt(employeeId))) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado inválido' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    
    const [rows]: any = await connection.query(`
      SELECT 
        e.EmployeeID,
        e.EmployeeType,
        bp.BasePersonnelID,
        pp.ProjectPersonnelID,
        bc.WarningFileURL,
        bc.LetterFileURL as BaseLetterFileURL,
        pc.WarningFileURL as ProjectWarningFileURL,
        pc.LetterFileURL,
        bp.LetterFileURL as BasePersonnelLetterFileURL,
        pp.LetterFileURL as ProjectPersonnelLetterFileURL
      FROM employees e
      LEFT JOIN basecontracts bc ON e.BasePersonnelID = bc.BasePersonnelID AND e.EmployeeType = 'BASE'
      LEFT JOIN projectcontracts pc ON e.ProjectPersonnelID = pc.ProjectPersonnelID AND e.EmployeeType = 'PROJECT'
      LEFT JOIN basepersonnel e ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN projectpersonnel e ON e.EmployeeID = e.EmployeeID
      WHERE e.EmployeeID = ?
      LIMIT 1
    `, [parseInt(employeeId)]);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const row = rows[0];
    
    // Determinar las URLs basadas en el tipo de empleado
    let warningFileURL, letterFileURL;
    
    if (row.EmployeeType === 'BASE') {
      warningFileURL = row.WarningFileURL;
      letterFileURL = row.BaseLetterFileURL || row.BasePersonnelLetterFileURL;
    } else {
      warningFileURL = row.ProjectWarningFileURL;
      letterFileURL = row.LetterFileURL || row.ProjectPersonnelLetterFileURL;
    }

    return NextResponse.json({
      success: true,
      warningFileURL,
      letterFileURL,
      employeeId: row.EmployeeID,
      employeeType: row.EmployeeType,
      hasWarningFile: !!warningFileURL,
      hasLetterFile: !!letterFileURL
    });

  } catch (error) {
    console.error('Error al obtener URLs de documentos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error al obtener los documentos',
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