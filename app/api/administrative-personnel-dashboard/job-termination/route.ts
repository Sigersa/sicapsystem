// app/api/administrative-personnel-dashboard/job-termination/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

type FormatoPDF = 'FT-RH-12' | 'FT-RH-13' | 'FT-RH-14';

const fieldMap: Record<FormatoPDF, string> = {
  'FT-RH-12': 'CDFileURL',
  'FT-RH-13': 'CRFileURL',
  'FT-RH-14': 'OFFileURL'
};

export async function GET(request: NextRequest) {
  let connection;
  
  try {
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

    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');
    const search = url.searchParams.get('search');
    const employeeId = url.searchParams.get('employeeId');
    const action = url.searchParams.get('action');
    
    // Obtener URLs de documentos guardados
    if (action === 'getDocumentUrls' && employeeId) {
      const [employeeType] = await connection.execute(
        `SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
            WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
            ELSE 'UNKNOWN'
          END as EmployeeType`,
        [parseInt(employeeId), parseInt(employeeId)]
      );

      const type = (employeeType as any[])[0]?.EmployeeType;

      if (type === 'BASE') {
        const [rows] = await connection.execute(
          `SELECT CDFileURL, CRFileURL, OFFileURL 
           FROM jobtermination 
           WHERE EmployeeID = ?`,
          [parseInt(employeeId)]
        );
        
        if ((rows as any[]).length > 0) {
          const urls = (rows as any[])[0];
          return NextResponse.json({
            success: true,
            urls: {
              ftRh12PdfUrl: urls.CDFileURL,
              ftRh13PdfUrl: urls.CRFileURL,
              ftRh14PdfUrl: urls.OFFileURL
            }
          });
        }
      } else if (type === 'PROJECT') {
        const [projectPersonnel] = await connection.execute(
          `SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?`,
          [parseInt(employeeId)]
        );

        if ((projectPersonnel as any[]).length > 0) {
          const projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          const [rows] = await connection.execute(
            `SELECT CDFileURL, CRFileURL, OFFileURL 
             FROM projectcontracts 
             WHERE ProjectPersonnelID = ? AND Status = 0
             ORDER BY ContractID DESC LIMIT 1`,
            [projectPersonnelID]
          );
          
          if ((rows as any[]).length > 0) {
            const urls = (rows as any[])[0];
            return NextResponse.json({
              success: true,
              urls: {
                ftRh12PdfUrl: urls.CDFileURL,
                ftRh13PdfUrl: urls.CRFileURL,
                ftRh14PdfUrl: urls.OFFileURL
              }
            });
          }
        }
      }
      
      return NextResponse.json({
        success: true,
        urls: null
      });
    }
    
    // Nueva acción para obtener URLs de documentos específicos por formato
    if (action === 'getDocumentUrl' && employeeId) {
      const formato = url.searchParams.get('formato') as FormatoPDF;
      const [employeeType] = await connection.execute(
        `SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
            WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
            ELSE 'UNKNOWN'
          END as EmployeeType`,
        [parseInt(employeeId), parseInt(employeeId)]
      );

      const type = (employeeType as any[])[0]?.EmployeeType;
      const fieldName = fieldMap[formato];

      if (type === 'BASE') {
        const [rows] = await connection.execute(
          `SELECT ${fieldName} as fileUrl
           FROM jobtermination 
           WHERE EmployeeID = ?`,
          [parseInt(employeeId)]
        );
        
        if ((rows as any[]).length > 0) {
          const fileUrl = (rows as any[])[0].fileUrl;
          return NextResponse.json({
            success: true,
            fileUrl: fileUrl
          });
        }
      } else if (type === 'PROJECT') {
        const [projectPersonnel] = await connection.execute(
          `SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?`,
          [parseInt(employeeId)]
        );

        if ((projectPersonnel as any[]).length > 0) {
          const projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          const [rows] = await connection.execute(
            `SELECT ${fieldName} as fileUrl
             FROM projectcontracts 
             WHERE ProjectPersonnelID = ? AND Status = 0
             ORDER BY ContractID DESC LIMIT 1`,
            [projectPersonnelID]
          );
          
          if ((rows as any[]).length > 0) {
            const fileUrl = (rows as any[])[0].fileUrl;
            return NextResponse.json({
              success: true,
              fileUrl: fileUrl
            });
          }
        }
      }
      
      return NextResponse.json({
        success: false,
        fileUrl: null,
        message: 'Documento no encontrado'
      });
    }
    
    // Obtener información específica de un empleado
    if (employeeId) {
      try {
        const employeeInfo = await getEmployeeInfo(connection, parseInt(employeeId));
        return NextResponse.json({
          success: true,
          ...employeeInfo
        });
      } catch (error: any) {
        return NextResponse.json(
          { success: false, message: error.message || 'Error al obtener información del empleado' },
          { status: 404 }
        );
      }
    }

    // 1. Obtener personal base - UN SOLO REGISTRO POR EMPLEADO
    const [baseEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
        e.Status,
        bp.BasePersonnelID,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bp.Area,
        bp.Salary,
        bp.WorkSchedule,
        COALESCE(bpi.RFC, '') as RFC,
        COALESCE(bpi.CURP, '') as CURP,
        COALESCE(bpi.NSS, '') as NSS,
        COALESCE(bpi.Email, '') as Email,
        COALESCE(bpi.Phone, '') as Phone,
        jt.CDFileURL as CDFileURL,
        jt.CRFileURL as CRFileURL,
        jt.OFFileURL as OFFileURL
      FROM basepersonnel bp
      INNER JOIN employees e ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      LEFT JOIN jobtermination jt ON bp.EmployeeID = jt.EmployeeID
      ORDER BY e.EmployeeID
    `);

    // 2. Obtener personal de proyecto - CON TODOS SUS CONTRATOS HISTÓRICOS
    const [projectEmployees] = await connection.execute(`
      SELECT 
    e.EmployeeID,
    e.Status as EmployeeStatus,
    pp.ProjectPersonnelID,
    pp.FirstName,
    pp.LastName,
    pp.MiddleName,
    COALESCE(p.NameProject, '') as ProjectName,
    pc.ProjectID,
    pc.Position,
    pc.Salary,
    pc.WorkSchedule,
    COALESCE(ppi.RFC, '') as RFC,
    COALESCE(ppi.CURP, '') as CURP,
    COALESCE(ppi.NSS, '') as NSS,
    COALESCE(ppi.Email, '') as Email,
    COALESCE(ppi.Phone, '') as Phone,
    pc.ContractFileURL,
    pc.WarningFileURL,
    pc.LetterFileURL,
    pc.AgreementFileURL,
    pc.ContractID
FROM projectpersonnel pp
INNER JOIN employees e ON pp.EmployeeID = e.EmployeeID
LEFT JOIN projectpersonnelpersonalinfo ppi 
    ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
LEFT JOIN (
    SELECT 
        pc1.*,
        ROW_NUMBER() OVER (
            PARTITION BY pc1.ProjectPersonnelID 
            ORDER BY pc1.ContractID DESC
        ) as rn
    FROM projectcontracts pc1
) pc 
    ON pp.ProjectPersonnelID = pc.ProjectPersonnelID 
    AND pc.rn = 1
LEFT JOIN projects p 
    ON pc.ProjectID = p.ProjectID
ORDER BY e.EmployeeID;
    `);

    // 3. Obtener todos los contratos históricos para personal de proyecto
    const [allProjectContracts] = await connection.execute(`
      SELECT 
        pc.ContractID,
        pc.ProjectPersonnelID,
        pc.ProjectID,
        p.NameProject as ProjectName,
        pc.Position,
        p.StartDate,
        p.EndDate,
        pc.Status,
        pc.CDFileURL,
        pc.CRFileURL,
        pc.OFFileURL
      FROM projectcontracts pc
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      ORDER BY pc.ProjectPersonnelID, p.StartDate DESC
    `);

    // Organizar contratos por ProjectPersonnelID
    const contractsByPersonnel: Record<number, any[]> = {};
    for (const contract of allProjectContracts as any[]) {
      if (!contractsByPersonnel[contract.ProjectPersonnelID]) {
        contractsByPersonnel[contract.ProjectPersonnelID] = [];
      }
      contractsByPersonnel[contract.ProjectPersonnelID].push(contract);
    }

    // Construir arrays de empleados con claves únicas
    const baseEmployeesFormatted = (baseEmployees as any[]).map(emp => ({ 
      ...emp, 
      tipo: 'BASE' as const,
      Status: emp.Status,
      uniqueKey: `BASE_${emp.EmployeeID}`,
      TerminationDocuments: {
        CDFileURL: emp.CDFileURL,
        CRFileURL: emp.CRFileURL,
        OFFileURL: emp.OFFileURL
      },
      Contracts: []
    }));
    
    const projectEmployeesFormatted = (projectEmployees as any[]).map(emp => ({ 
      ...emp, 
      tipo: 'PROJECT' as const,
      Status: emp.EmployeeStatus,
      uniqueKey: `PROJECT_${emp.EmployeeID}`,
      TerminationDocuments: null,
      Contracts: contractsByPersonnel[emp.ProjectPersonnelID] || []
    }));

    // Combinar todos los empleados
    let allEmployees = [...baseEmployeesFormatted, ...projectEmployeesFormatted];

    // DEDUPLICAR POR EMPLOYEEID (un empleado no puede aparecer dos veces)
    const uniqueByEmployeeId = new Map<number, (typeof allEmployees)[0]>();
    
    for (const emp of allEmployees) {
      const existing = uniqueByEmployeeId.get(emp.EmployeeID);
      if (!existing) {
        uniqueByEmployeeId.set(emp.EmployeeID, emp);
      } else {
        console.warn(` Empleado duplicado encontrado: ID=${emp.EmployeeID}, tipos: ${existing.tipo} y ${emp.tipo}`);
      }
    }
    
    let finalEmployees = Array.from(uniqueByEmployeeId.values());

    // Filtrar por tipo
    if (tipo && tipo !== 'TODOS') {
      finalEmployees = finalEmployees.filter(emp => emp.tipo === tipo);
    }

    // Filtrar por búsqueda
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      finalEmployees = finalEmployees.filter(emp => 
        emp.FirstName.toLowerCase().includes(searchLower) ||
        emp.LastName.toLowerCase().includes(searchLower) ||
        (emp.MiddleName?.toLowerCase() || '').includes(searchLower) ||
        `${emp.FirstName} ${emp.LastName}`.toLowerCase().includes(searchLower) ||
        (emp.RFC?.toLowerCase() || '').includes(searchLower) ||
        (emp.CURP?.toLowerCase() || '').includes(searchLower) ||
        (emp.Email?.toLowerCase() || '').includes(searchLower) ||
        (emp.NSS?.toLowerCase() || '').includes(searchLower) ||
        emp.EmployeeID.toString().includes(searchLower)
      );
    }

    // Ordenar por ID de empleado de menor a mayor
    finalEmployees.sort((a, b) => a.EmployeeID - b.EmployeeID);

    return NextResponse.json({
      success: true,
      employees: finalEmployees,
      total: finalEmployees.length
    });

  } catch (error) {
    console.error('Error al obtener empleados:', error);
    return NextResponse.json(
      { success: false, message: 'ERROR AL OBTENER LA LISTA DE EMPLEADOS' },
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

export async function PUT(request: NextRequest) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ success: false, message: 'NO AUTORIZADO' }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ success: false, message: 'ACCESO DENEGADO' }, { status: 403 });
    }

    const body = await request.json();
    const { EmployeeID, Status } = body;

    if (!EmployeeID || Status === undefined) {
      return NextResponse.json({ success: false, message: 'Faltan datos' }, { status: 400 });
    }

    // Para dar de baja (Status = 0)
    if (Status === 0) {
      // 1. Obtener información ANTES de hacer cualquier cambio
      connection = await getConnection();
      
      const [employeeType] = await connection.execute(
        `SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
            WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
          END as EmployeeType`,
        [EmployeeID, EmployeeID]
      );

      const type = (employeeType as any[])[0]?.EmployeeType;
      let contractID: number | null = null;
      let projectPersonnelID: number | null = null;

      // 2. Obtener el contractID del contrato activo (Status = 1)
      if (type === 'PROJECT') {
        const [pp] = await connection.execute(
          `SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?`,
          [EmployeeID]
        );
        
        projectPersonnelID = (pp as any[])[0]?.ProjectPersonnelID;
        
        if (projectPersonnelID) {
          const [contract] = await connection.execute(
            `SELECT ContractID FROM projectcontracts 
             WHERE ProjectPersonnelID = ? AND Status = 1
             LIMIT 1`,
            [projectPersonnelID]
          );
          
          if ((contract as any[]).length > 0) {
            contractID = (contract as any[])[0].ContractID;
          }
        }
      }

      // 3. Generar PDFs ANTES de actualizar el status (mientras el contrato está activo)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const cookies = request.headers.get('cookie') || '';
      
      // IMPORTANTE: Pasar el contractID para que sepa qué contrato actualizar
      const pdfUrls = await generateAndSaveAllPDFsFixed(
        EmployeeID,
        baseUrl,
        cookies,
        type,
        contractID,
        projectPersonnelID  // Pasamos también el ProjectPersonnelID por si acaso
      );

      // 4. Ahora sí, actualizar los status (después de generar PDFs)
      await connection.beginTransaction();
      
      try {
        // Actualizar status del empleado
        await connection.execute(
          `UPDATE employees SET Status = ? WHERE EmployeeID = ?`,
          [Status, EmployeeID]
        );

        if (type === 'PROJECT' && contractID) {
          // Actualizar el contrato específico a Status = 0
          await connection.execute(
            `UPDATE projectcontracts SET Status = 0 WHERE ContractID = ?`,
            [contractID]
          );
        }

        if (type === 'BASE') {
          const [existing] = await connection.execute(
            `SELECT JobTerminationID FROM jobtermination WHERE EmployeeID = ?`,
            [EmployeeID]
          );

          if ((existing as any[]).length === 0) {
            await connection.execute(
              `INSERT INTO jobtermination (EmployeeID) VALUES (?)`,
              [EmployeeID]
            );
          }
        }

        await connection.commit();
        
        return NextResponse.json({
          success: true,
          message: 'EMPLEADO DADO DE BAJA',
          ...pdfUrls
        });
        
      } catch (dbError) {
        await connection.rollback();
        throw dbError;
      }
      
    } else {
      // Reactivación (Status = 1)
      connection = await getConnection();
      
      const [employeeType] = await connection.execute(
        `SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
            WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
          END as EmployeeType`,
        [EmployeeID, EmployeeID]
      );

      const type = (employeeType as any[])[0]?.EmployeeType;

      if (type === 'PROJECT') {
        await connection.rollback();
        return NextResponse.json({
          success: false,
          message: 'Para reactivar personal de proyecto, debe ir al módulo de EDICIÓN DE USUARIO y asignar un nuevo contrato y proyecto.',
          requiresManualReactivation: true,
          employeeType: 'PROJECT'
        }, { status: 400 });
      } else if (type === 'BASE') {
        await connection.execute(
          `DELETE FROM jobtermination WHERE EmployeeID = ?`,
          [EmployeeID]
        );
        await connection.commit();
        return NextResponse.json({
          success: true,
          message: 'EMPLEADO REACTIVADO EXITOSAMENTE'
        });
      }
      
      await connection.rollback();
      return NextResponse.json({
        success: false,
        message: 'Tipo de empleado no reconocido'
      }, { status: 400 });
    }

  } catch (error) {
    if (connection) await connection.rollback();
    console.error(error);
    return NextResponse.json({ success: false, message: 'Error interno del servidor' }, { status: 500 });
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

export async function DELETE(request: NextRequest) {
  let connection;
  
  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { EmployeeID } = body;

    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'Falta el EmployeeID' },
        { status: 400 }
      );
    }

    connection = await getConnection();

    const [existingEmployee] = await connection.execute(
      'SELECT EmployeeID, Status FROM employees WHERE EmployeeID = ?',
      [EmployeeID]
    );

    if ((existingEmployee as any[]).length === 0) {
      return NextResponse.json(
        { success: false, message: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const employee = (existingEmployee as any[])[0];
    
    if (employee.Status !== 0) {
      return NextResponse.json(
        { success: false, message: 'Solo se pueden eliminar empleados que están dados de baja (Status = 0)' },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    try {
      const [employeeType] = await connection.execute(
        `SELECT 
          CASE 
            WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
            WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
            ELSE 'UNKNOWN'
          END as EmployeeType`,
        [EmployeeID, EmployeeID]
      );

      const type = (employeeType as any[])[0]?.EmployeeType;

      if (type === 'BASE') {
        await connection.execute('DELETE FROM jobtermination WHERE EmployeeID = ?', [EmployeeID]);
        
        const [basePersonnel] = await connection.execute(
          'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((basePersonnel as any[]).length > 0) {
          const basePersonnelID = (basePersonnel as any[])[0].BasePersonnelID;
          await connection.execute('DELETE FROM basepersonnelpersonalinfo WHERE BasePersonnelID = ?', [basePersonnelID]);
          await connection.execute('DELETE FROM basepersonnel WHERE EmployeeID = ?', [EmployeeID]);
        }
      } else if (type === 'PROJECT') {
        const [projectPersonnel] = await connection.execute(
          'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((projectPersonnel as any[]).length > 0) {
          const projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          await connection.execute(
            `UPDATE projectcontracts 
             SET CDFileURL = NULL, CRFileURL = NULL, OFFileURL = NULL
             WHERE ProjectPersonnelID = ?`,
            [projectPersonnelID]
          );
          
          await connection.execute('DELETE FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?', [projectPersonnelID]);
          await connection.execute('DELETE FROM projectpersonnel WHERE EmployeeID = ?', [EmployeeID]);
        }
      }

      await connection.execute('DELETE FROM employees WHERE EmployeeID = ?', [EmployeeID]);
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'EMPLEADO ELIMINADO PERMANENTEMENTE'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar empleado:', error);
    return NextResponse.json(
      { success: false, message: 'ERROR AL ELIMINAR EL EMPLEADO' },
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

async function getEmployeeInfo(connection: any, employeeId: number) {
  const [employeeInfo] = await connection.query(
    `SELECT 
      CASE 
        WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
        WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
      END as EmployeeType`,
    [employeeId, employeeId]
  );

  if (!employeeInfo || (employeeInfo as any[]).length === 0) {
    throw new Error('Empleado no encontrado');
  }

  const employee = (employeeInfo as any[])[0];
  let nombre = "";
  let puesto = "";
  let tipoPersonal = employee.EmployeeType === 'PROJECT' ? 'PERSONAL DE PROYECTO' : 'PERSONAL BASE';
  let mesesTrabajados = 0;
  let fechaInicio = "";
  let fechaTermino = "";
  let direccion = "";

  if (employee.EmployeeType === 'PROJECT') {
    const [rows] = await connection.query(
      `SELECT 
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        pc.Position,
        pc.StartDate,
        pr.EndDate,
        TIMESTAMPDIFF(MONTH, pr.StartDate, CURDATE()) AS meses_trabajados,
        pr.ProjectAddress
      FROM projectpersonnel pp
      LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID AND pc.Status = 1
      LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
      WHERE pp.EmployeeID = ?`,
      [employeeId]
    );

    if (rows && (rows as any[]).length > 0) {
      const r = (rows as any[])[0];
      nombre = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      puesto = r.Position || "No especificado";
      mesesTrabajados = r.meses_trabajados || 0;
      fechaInicio = r.StartDate || "";
      fechaTermino = r.EndDate || "";
      direccion = r.ProjectAddress || "";
    }
  } else {
    const [rows] = await connection.query(
      `SELECT 
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bc.StartDate,
        TIMESTAMPDIFF(MONTH, bc.StartDate, CURDATE()) AS meses_trabajados
      FROM basepersonnel bp
      LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
      WHERE bp.EmployeeID = ?`,
      [employeeId]
    );

    if (rows && (rows as any[]).length > 0) {
      const r = (rows as any[])[0];
      nombre = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      puesto = r.Position || "No especificado";
      mesesTrabajados = r.meses_trabajados || 0;
      fechaInicio = r.StartDate || "";
      direccion = "AV. EL SAUZ 7, EL DEPOSITO, 42795 TLAHUELILPAN, HGO";
    }
  }

  return {
    nombre: nombre || "No especificado",
    puesto: puesto,
    tipoPersonal: tipoPersonal,
    mesesTrabajados: mesesTrabajados,
    fechaInicio: fechaInicio,
    fechaTermino: fechaTermino,
    direccion: direccion
  };
}

async function generateAndSaveAllPDFsFixed(
  employeeId: number,
  baseUrl: string,
  cookies: string,
  employeeType: string,
  contractID: number | null,
  projectPersonnelID?: number | null  // Nuevo parámetro opcional
) {
  const formatos: FormatoPDF[] = ['FT-RH-12', 'FT-RH-13', 'FT-RH-14'];
  const result: any = {};

  for (const formato of formatos) {
    const url = `${baseUrl}/api/download/pdf/${formato}?empleadoId=${employeeId}&save=1`;
    
    console.log(`Generando ${formato} para empleado ${employeeId} (Status aún activo)`);

    const response = await fetch(url, {
      headers: { Cookie: cookies }
    });

    const data = await response.json();

    if (data.success && data.fileUrl) {
      const fieldName = fieldMap[formato];
      let updateConnection = null;
      
      try {
        updateConnection = await getConnection();
        
        if (employeeType === 'PROJECT' && contractID) {
          // Actualizar el contrato específico (que aún tiene Status = 1 en este momento)
          await updateConnection.execute(
            `UPDATE projectcontracts SET ${fieldName} = ? WHERE ContractID = ?`,
            [data.fileUrl, contractID]
          );
          console.log(`${formato} guardado para ContractID: ${contractID}`);
        } else if (employeeType === 'BASE') {
          await updateConnection.execute(
            `UPDATE jobtermination SET ${fieldName} = ? WHERE EmployeeID = ?`,
            [data.fileUrl, employeeId]
          );
          console.log(`${formato} guardado para EmployeeID: ${employeeId}`);
        }
        
        result[fieldName] = data.fileUrl;
      } catch (error) {
        console.error(`Error guardando ${formato}:`, error);
      } finally {
        if (updateConnection) {
          await updateConnection.release();
        }
      }
    } else {
      console.warn(`No se pudo generar ${formato}:`, data.message || 'Error desconocido');
    }
  }

  return result;
}