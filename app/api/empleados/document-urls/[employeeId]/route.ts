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
    
    // Consulta optimizada para obtener URLs de documentos según el tipo de empleado
    const [rows]: any = await connection.query(`
      SELECT 
        e.EmployeeID,
        e.EmployeeType,
        e.BasePersonnelID,
        e.ProjectPersonnelID,
        CASE 
          WHEN e.EmployeeType = 'BASE' THEN bc.ContractFileURL
          WHEN e.EmployeeType = 'PROJECT' THEN pc.ContractFileURL
          ELSE NULL
        END as ContractFileURL,
        CASE 
          WHEN e.EmployeeType = 'BASE' THEN bc.WarningFileURL
          WHEN e.EmployeeType = 'PROJECT' THEN pc.WarningFileURL
          ELSE NULL
        END as WarningFileURL,
        CASE 
          WHEN e.EmployeeType = 'BASE' THEN bc.LetterFileURL
          WHEN e.EmployeeType = 'PROJECT' THEN pc.LetterFileURL
          ELSE NULL
        END as LetterFileURL,
        CASE 
          WHEN e.EmployeeType = 'BASE' THEN bc.AgreementFileURL
          WHEN e.EmployeeType = 'PROJECT' THEN pc.AgreementFileURL
          ELSE NULL
        END as AgreementFileURL
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

    const contractFileURL = rows[0].ContractFileURL;
    const warningFileURL = rows[0].WarningFileURL;
    const letterFileURL = rows[0].LetterFileURL;
    const agreementFileURL = rows[0].AgreementFileURL;

    return NextResponse.json({
      success: true,
      contractFileURL,
      warningFileURL,
      letterFileURL,
      agreementFileURL,
      employeeId,
      employeeType: rows[0].EmployeeType,
      basePersonnelID: rows[0].BasePersonnelID,
      projectPersonnelID: rows[0].ProjectPersonnelID
    });

  } catch (error) {
    console.error('Error al obtener URLs de documentos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error al obtener documentos',
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