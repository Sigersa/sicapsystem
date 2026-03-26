// app/api/administrative-personnel-dashboard/employee-management/employeeimssinfonavit/batch/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id } = await params;
    const batchId = parseInt(id);
    
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    // Obtener datos del batch
    const [batchRows] = await connection.execute<any[]>(
      `SELECT 
        BatchID,
        MovementType,
        DateMovement,
        ReasonForWithdrawal,
        FileURL
      FROM employee_movement_batches 
      WHERE BatchID = ?`,
      [batchId]
    );

    if (batchRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Lote no encontrado' },
        { status: 404 }
      );
    }

    // Obtener empleados del lote
    const [employeeRows] = await connection.execute<any[]>(
      `SELECT 
        em.EmployeeID,
        em.ProjectContractID,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.SalaryIMSS, pc.SalaryIMSS) as SalaryIMSS,
        COALESCE(bpi.CURP, ppi.CURP) as CURP,
        COALESCE(bpi.NSS, ppi.NSS) as NSS,
        COALESCE(bpi.NCI, ppi.NCI) as NCI,
        COALESCE(bpi.UMF, ppi.UMF) as UMF,
        COALESCE(bp.Area, pj.NameProject) as AreaOrProject,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROYECTO'
        END as tipo
      FROM employeeimssinfonavitmovements em
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      WHERE em.BatchID = ?
      ORDER BY em.MovementID`,
      [batchId]
    );

    return NextResponse.json({
      success: true,
      batch: batchRows[0],
      employees: employeeRows,
      employeeCount: employeeRows.length
    });

  } catch (error) {
    console.error('Error al obtener lote:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER DATOS DEL LOTE',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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