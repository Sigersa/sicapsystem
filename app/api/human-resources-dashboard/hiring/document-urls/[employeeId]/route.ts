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
    const employeeIdNum = parseInt(employeeId);

    // Validar que employeeId sea un número
    if (!employeeId || isNaN(employeeIdNum)) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado inválido' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Primero, obtener el tipo de empleado
    const [employeeRows]: any = await connection.query(
      'SELECT EmployeeType FROM employees WHERE EmployeeID = ?',
      [employeeIdNum]
    );

    if (!employeeRows || employeeRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const employeeType = employeeRows[0].EmployeeType;
    let contractFileURL = null;
    let warningFileURL = null;
    let letterFileURL = null;
    let agreementFileURL = null;
    let basePersonnelID = null;
    let projectPersonnelID = null;

    // Consultar según el tipo de empleado
    if (employeeType === 'BASE') {
      // Obtener BasePersonnelID desde basepersonnel usando EmployeeID
      const [basePersonnelRows]: any = await connection.query(
        'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
        [employeeIdNum]
      );

      if (basePersonnelRows && basePersonnelRows.length > 0) {
        basePersonnelID = basePersonnelRows[0].BasePersonnelID;

        // Obtener URLs de documentos desde basecontracts usando BasePersonnelID
        const [contractRows]: any = await connection.query(
          `SELECT 
            ContractFileURL,
            WarningFileURL,
            LetterFileURL,
            AgreementFileURL
          FROM basecontracts 
          WHERE BasePersonnelID = ?
          LIMIT 1`,
          [basePersonnelID]
        );

        if (contractRows && contractRows.length > 0) {
          contractFileURL = contractRows[0].ContractFileURL;
          warningFileURL = contractRows[0].WarningFileURL;
          letterFileURL = contractRows[0].LetterFileURL;
          agreementFileURL = contractRows[0].AgreementFileURL;
        }
      }
    } else if (employeeType === 'PROJECT') {
      // Obtener ProjectPersonnelID desde projectpersonnel usando EmployeeID
      const [projectPersonnelRows]: any = await connection.query(
        'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
        [employeeIdNum]
      );

      if (projectPersonnelRows && projectPersonnelRows.length > 0) {
        projectPersonnelID = projectPersonnelRows[0].ProjectPersonnelID;

        // Obtener URLs de documentos desde projectcontracts usando ProjectPersonnelID
        const [contractRows]: any = await connection.query(
          `SELECT 
            ContractFileURL,
            WarningFileURL,
            LetterFileURL,
            AgreementFileURL
          FROM projectcontracts 
          WHERE ProjectPersonnelID = ?
          LIMIT 1`,
          [projectPersonnelID]
        );

        if (contractRows && contractRows.length > 0) {
          contractFileURL = contractRows[0].ContractFileURL;
          warningFileURL = contractRows[0].WarningFileURL;
          letterFileURL = contractRows[0].LetterFileURL;
          agreementFileURL = contractRows[0].AgreementFileURL;
        }
      }
    }

    return NextResponse.json({
      success: true,
      contractFileURL,
      warningFileURL,
      letterFileURL,
      agreementFileURL,
      employeeId: employeeIdNum,
      employeeType,
      basePersonnelID,
      projectPersonnelID
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