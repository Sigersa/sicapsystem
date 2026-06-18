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

    // Obtener empleados del lote con sus datos específicos según el tipo
    const [employeeRows] = await connection.execute<any[]>(
      `SELECT 
        em.MovementID,
        em.EmployeeID,
        em.BaseContractID,
        em.ProjectContractID,
        -- Datos del empleado (BASE)
        bp.FirstName as BaseFirstName,
        bp.LastName as BaseLastName,
        bp.MiddleName as BaseMiddleName,
        bp.Position as BasePosition,
        bp.Area as BaseArea,
        bc.SalaryIMSS as BaseSalaryIMSS,
        bpi.CURP as BaseCURP,
        bpi.NSS as BaseNSS,
        bpi.NCI as BaseNCI,
        bpi.UMF as BaseUMF,
        -- Datos del empleado (PROJECT)
        pp.FirstName as ProjectFirstName,
        pp.LastName as ProjectLastName,
        pp.MiddleName as ProjectMiddleName,
        pc.Position as ProjectPosition,
        pc.SalaryIMSS as ProjectSalaryIMSS,
        ppi.CURP as ProjectCURP,
        ppi.NSS as ProjectNSS,
        ppi.NCI as ProjectNCI,
        ppi.UMF as ProjectUMF,
        -- Datos del proyecto
        pj.NameProject,
        -- Determinar el tipo basado en qué contrato tiene
        CASE 
          WHEN em.BaseContractID IS NOT NULL THEN 'BASE'
          WHEN em.ProjectContractID IS NOT NULL THEN 'PROYECTO'
          ELSE 'NO ESPECIFICADO'
        END as tipo
      FROM employeeimssinfonavitmovements em
      -- Datos del empleado (BASE) - Solo si tiene BaseContractID
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID AND em.BaseContractID IS NOT NULL
      LEFT JOIN basecontracts bc ON em.BaseContractID = bc.ContractID AND em.BaseContractID IS NOT NULL
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT) - Solo si tiene ProjectContractID
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID AND em.ProjectContractID IS NOT NULL
      LEFT JOIN projectcontracts pc ON em.ProjectContractID = pc.ContractID AND em.ProjectContractID IS NOT NULL
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      -- Datos del proyecto - Solo para PROJECT
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      WHERE em.BatchID = ?
      ORDER BY em.MovementID`,
      [batchId]
    );

    // Formatear los datos para el frontend
    const formattedEmployees = employeeRows.map((row) => {
      // Obtener los datos según el tipo
      let firstName, lastName, middleName, position, salaryIMSS, curp, nss, nci, umf, areaOrProject;
      
      if (row.tipo === 'BASE') {
        firstName = row.BaseFirstName || 'NO ESPECIFICADO';
        lastName = row.BaseLastName || '';
        middleName = row.BaseMiddleName || '';
        position = row.BasePosition || 'NO ESPECIFICADO';
        salaryIMSS = row.BaseSalaryIMSS || 'NO ESPECIFICADO';
        curp = row.BaseCURP || 'NO ESPECIFICADO';
        nss = row.BaseNSS || 'NO ESPECIFICADO';
        nci = row.BaseNCI || 'NO ESPECIFICADO';
        umf = row.BaseUMF || 'NO ESPECIFICADO';
        areaOrProject = row.BaseArea || 'NO ESPECIFICADO';
      } else if (row.tipo === 'PROYECTO') {
        firstName = row.ProjectFirstName || 'NO ESPECIFICADO';
        lastName = row.ProjectLastName || '';
        middleName = row.ProjectMiddleName || '';
        position = row.ProjectPosition || 'NO ESPECIFICADO';
        salaryIMSS = row.ProjectSalaryIMSS || 'NO ESPECIFICADO';
        curp = row.ProjectCURP || 'NO ESPECIFICADO';
        nss = row.ProjectNSS || 'NO ESPECIFICADO';
        nci = row.ProjectNCI || 'NO ESPECIFICADO';
        umf = row.ProjectUMF || 'NO ESPECIFICADO';
        areaOrProject = row.NameProject || 'NO ESPECIFICADO';
      } else {
        firstName = 'NO ESPECIFICADO';
        lastName = '';
        middleName = '';
        position = 'NO ESPECIFICADO';
        salaryIMSS = null;
        curp = 'NO ESPECIFICADO';
        nss = 'NO ESPECIFICADO';
        nci = 'NO ESPECIFICADO';
        umf = null;
        areaOrProject = 'NO ESPECIFICADO';
      }

      const fullName = [
        firstName || '',
        lastName || '',
        middleName || ''
      ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

      return {
        EmployeeID: row.EmployeeID,
        BaseContractID: row.BaseContractID,
        ProjectContractID: row.ProjectContractID,
        FullName: fullName,
        FirstName: firstName,
        LastName: lastName || '',
        MiddleName: middleName || '',
        Position: position,
        SalaryIMSS: salaryIMSS,
        CURP: curp,
        NSS: nss,
        NCI: nci,
        UMF: umf,
        AreaOrProject: areaOrProject,
        tipo: row.tipo,
        MovementID: row.MovementID
      };
    });

    return NextResponse.json({
      success: true,
      batch: batchRows[0],
      employees: formattedEmployees,
      employeeCount: formattedEmployees.length
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