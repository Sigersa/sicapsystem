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

// Función para eliminar archivos de UploadThing
async function deleteFilesFromUploadThing(fileUrls: string[]) {
  const validUrls = fileUrls.filter(url => url && url.trim() !== '');
  
  if (validUrls.length === 0) return true;
  
  try {
    const fileKeys = validUrls.map(url => {
      const match = url.match(/https:\/\/utfs\.io\/f\/([^?]+)/);
      return match ? match[1] : null;
    }).filter(key => key !== null);
    
    if (fileKeys.length === 0) return true;
    
    const response = await fetch('https://uploadthing.com/api/deleteFiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UploadThing-Secret': process.env.UPLOADTHING_SECRET!,
      },
      body: JSON.stringify({ fileKeys }),
    });
    
    if (!response.ok) {
      console.error('Error eliminando archivos de UploadThing:', await response.text());
      return false;
    }
    
    console.log(`Eliminados ${fileKeys.length} archivos de UploadThing`);
    return true;
  } catch (error) {
    console.error('Error al eliminar archivos de UploadThing:', error);
    return false;
  }
}

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
    const contractId = url.searchParams.get('contractId');
    
    // Obtener URLs de documentos guardados (todos los formatos)
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
    
    // Obtener URL de documento específico por formato
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
    
    // Obtener URLs de documentos por ContractID (para contratos históricos de PROJECT)
    if (action === 'getContractDocumentUrls' && contractId) {
      const [rows] = await connection.execute(
        `SELECT CDFileURL, CRFileURL, OFFileURL 
         FROM projectcontracts 
         WHERE ContractID = ?`,
        [parseInt(contractId)]
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
      
      return NextResponse.json({
        success: true,
        urls: null
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

    // 1. Obtener personal base
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

    // 2. Obtener personal de proyecto
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

    // Construir arrays de empleados
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

    let allEmployees = [...baseEmployeesFormatted, ...projectEmployeesFormatted];

    // Deduplicar
    const uniqueByEmployeeId = new Map<number, (typeof allEmployees)[0]>();
    for (const emp of allEmployees) {
      const existing = uniqueByEmployeeId.get(emp.EmployeeID);
      if (!existing) {
        uniqueByEmployeeId.set(emp.EmployeeID, emp);
      }
    }
    
    let finalEmployees = Array.from(uniqueByEmployeeId.values());

    if (tipo && tipo !== 'TODOS') {
      finalEmployees = finalEmployees.filter(emp => emp.tipo === tipo);
    }

    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      finalEmployees = finalEmployees.filter(emp => 
        emp.FirstName.toLowerCase().includes(searchLower) ||
        emp.LastName.toLowerCase().includes(searchLower) ||
        emp.EmployeeID.toString().includes(searchLower)
      );
    }

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

    connection = await getConnection();

    if (Status === 0) {
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

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const cookies = request.headers.get('cookie') || '';
      
      await generateAndSaveAllPDFsFixed(
        EmployeeID,
        baseUrl,
        cookies,
        type,
        contractID,
        projectPersonnelID
      );

      await connection.beginTransaction();
      
      try {
        await connection.execute(
          `UPDATE employees SET Status = ? WHERE EmployeeID = ?`,
          [Status, EmployeeID]
        );

        if (type === 'PROJECT' && contractID) {
          await connection.execute(
            `UPDATE projectcontracts SET Status = 0 WHERE ContractID = ?`,
            [contractID]
          );
        }

        await connection.commit();
        
        const savedUrls = await getSavedDocumentUrlsFromDB(connection, EmployeeID, type, contractID);
        
        return NextResponse.json({
          success: true,
          message: 'EMPLEADO DADO DE BAJA',
          urls: savedUrls
        });
        
      } catch (dbError) {
        await connection.rollback();
        throw dbError;
      }
    } 
    else if (Status === 1) {
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

      if (type === 'PROJECT') {
        return NextResponse.json({
          success: false,
          message: 'Para reactivar personal de proyecto, debe ir al módulo de EDICIÓN DE USUARIO y asignar un nuevo contrato y proyecto.',
          requiresManualReactivation: true,
          employeeType: 'PROJECT'
        }, { status: 400 });
      } 
      else if (type === 'BASE') {
        await connection.beginTransaction();
        
        try {
          // Obtener las URLs de los documentos antes de eliminar el registro
          const urlsToDelete: string[] = [];
          const [rows] = await connection.execute(
            `SELECT CDFileURL, CRFileURL, OFFileURL 
             FROM jobtermination 
             WHERE EmployeeID = ?`,
            [EmployeeID]
          );
          
          if ((rows as any[]).length > 0) {
            const urls = (rows as any[])[0];
            if (urls.CDFileURL) urlsToDelete.push(urls.CDFileURL);
            if (urls.CRFileURL) urlsToDelete.push(urls.CRFileURL);
            if (urls.OFFileURL) urlsToDelete.push(urls.OFFileURL);
          }
          
          // Eliminar archivos de UploadThing
          if (urlsToDelete.length > 0) {
            console.log(`Eliminando ${urlsToDelete.length} archivos de UploadThing para empleado ${EmployeeID}`);
            await deleteFilesFromUploadThing(urlsToDelete);
          }
          
          // Actualizar el estado del empleado
          await connection.execute(
            `UPDATE employees SET Status = 1 WHERE EmployeeID = ?`,
            [EmployeeID]
          );
          
          // Eliminar el registro de jobtermination
          await connection.execute(
            `DELETE FROM jobtermination WHERE EmployeeID = ?`,
            [EmployeeID]
          );
          
          await connection.commit();
          
          return NextResponse.json({
            success: true,
            message: 'EMPLEADO REACTIVADO EXITOSAMENTE Y DOCUMENTOS ELIMINADOS'
          });
          
        } catch (dbError) {
          await connection.rollback();
          console.error('Error al reactivar empleado:', dbError);
          return NextResponse.json({
            success: false,
            message: 'Error al reactivar el empleado'
          }, { status: 500 });
        }
      }
      else {
        return NextResponse.json({
          success: false,
          message: 'Tipo de empleado no reconocido'
        }, { status: 404 });
      }
    }
    else {
      return NextResponse.json({
        success: false,
        message: 'Status no válido'
      }, { status: 400 });
    }

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('[JOB-TERMINATION] Error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error interno del servidor'
    }, { status: 500 });
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
        { success: false, message: 'Solo se pueden eliminar empleados dados de baja' },
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
      let urlsToDelete: string[] = [];

      if (type === 'BASE') {
        // Obtener URLs antes de eliminar
        const [rows] = await connection.execute(
          `SELECT CDFileURL, CRFileURL, OFFileURL 
           FROM jobtermination 
           WHERE EmployeeID = ?`,
          [EmployeeID]
        );
        
        if ((rows as any[]).length > 0) {
          const urls = (rows as any[])[0];
          if (urls.CDFileURL) urlsToDelete.push(urls.CDFileURL);
          if (urls.CRFileURL) urlsToDelete.push(urls.CRFileURL);
          if (urls.OFFileURL) urlsToDelete.push(urls.OFFileURL);
        }
        
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
          
          // Obtener URLs de los contratos antes de eliminarlos
          const [contracts] = await connection.execute(
            `SELECT CDFileURL, CRFileURL, OFFileURL 
             FROM projectcontracts 
             WHERE ProjectPersonnelID = ?`,
            [projectPersonnelID]
          );
          
          for (const contract of contracts as any[]) {
            if (contract.CDFileURL) urlsToDelete.push(contract.CDFileURL);
            if (contract.CRFileURL) urlsToDelete.push(contract.CRFileURL);
            if (contract.OFFileURL) urlsToDelete.push(contract.OFFileURL);
          }
          
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

      // Eliminar archivos de UploadThing
      if (urlsToDelete.length > 0) {
        console.log(`Eliminando ${urlsToDelete.length} archivos de UploadThing para empleado ${EmployeeID}`);
        await deleteFilesFromUploadThing(urlsToDelete);
      }

      await connection.execute('DELETE FROM employees WHERE EmployeeID = ?', [EmployeeID]);
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'EMPLEADO ELIMINADO PERMANENTEMENTE JUNTO CON SUS DOCUMENTOS'
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

  if (employee.EmployeeType === 'PROJECT') {
    const [rows] = await connection.query(
      `SELECT 
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        pc.Position
      FROM projectpersonnel pp
      LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID AND pc.Status = 1
      WHERE pp.EmployeeID = ?`,
      [employeeId]
    );

    if (rows && (rows as any[]).length > 0) {
      const r = (rows as any[])[0];
      nombre = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      puesto = r.Position || "No especificado";
    }
  } else {
    const [rows] = await connection.query(
      `SELECT 
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position
      FROM basepersonnel bp
      WHERE bp.EmployeeID = ?`,
      [employeeId]
    );

    if (rows && (rows as any[]).length > 0) {
      const r = (rows as any[])[0];
      nombre = `${r.FirstName || ""} ${r.LastName || ""} ${r.MiddleName || ""}`.trim();
      puesto = r.Position || "No especificado";
    }
  }

  return {
    nombre: nombre || "No especificado",
    puesto: puesto,
    tipoPersonal: tipoPersonal
  };
}

async function generateAndSaveAllPDFsFixed(
  employeeId: number,
  baseUrl: string,
  cookies: string,
  employeeType: string,
  contractID: number | null,
  projectPersonnelID?: number | null
) {
  const formatos: FormatoPDF[] = ['FT-RH-12', 'FT-RH-13', 'FT-RH-14'];

  for (const formato of formatos) {
    // SIEMPRE usar employeeId para generar el PDF
    const url = `${baseUrl}/api/download/pdf/${formato}?empleadoId=${employeeId}&save=1`;
    
    console.log(`[PDF-GEN] Generando ${formato} para empleado ${employeeId} (${employeeType})`);
    
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
          // Guardar en el contrato específico
          console.log(`[PDF-GEN] Guardando ${formato} en contrato ${contractID}`);
          await updateConnection.execute(
            `UPDATE projectcontracts SET ${fieldName} = ? WHERE ContractID = ?`,
            [data.fileUrl, contractID]
          );
        } else if (employeeType === 'BASE') {
          // Guardar en jobtermination
          const [existing] = await updateConnection.execute(
            `SELECT JobTerminationID FROM jobtermination WHERE EmployeeID = ?`,
            [employeeId]
          );
          
          if ((existing as any[]).length === 0) {
            await updateConnection.execute(
              `INSERT INTO jobtermination (EmployeeID) VALUES (?)`,
              [employeeId]
            );
          }
          
          await updateConnection.execute(
            `UPDATE jobtermination SET ${fieldName} = ? WHERE EmployeeID = ?`,
            [data.fileUrl, employeeId]
          );
        }
        
        console.log(`[PDF-GEN] ✅ ${formato} guardado exitosamente`);
      } catch (error) {
        console.error(`[PDF-GEN] ❌ Error guardando ${formato}:`, error);
      } finally {
        if (updateConnection) {
          await updateConnection.release();
        }
      }
    } else {
      console.error(`[PDF-GEN] ❌ Error generando ${formato}:`, data);
    }
  }
}

async function getSavedDocumentUrlsFromDB(connection: any, employeeId: number, employeeType: string, contractID: number | null) {
  const result: any = {};
  
  if (employeeType === 'BASE') {
    const [rows] = await connection.execute(
      `SELECT CDFileURL, CRFileURL, OFFileURL 
       FROM jobtermination 
       WHERE EmployeeID = ?`,
      [employeeId]
    );
    
    if ((rows as any[]).length > 0) {
      const urls = (rows as any[])[0];
      result.ftRh12PdfUrl = urls.CDFileURL;
      result.ftRh13PdfUrl = urls.CRFileURL;
      result.ftRh14PdfUrl = urls.OFFileURL;
    }
  } else if (employeeType === 'PROJECT' && contractID) {
    const [rows] = await connection.execute(
      `SELECT CDFileURL, CRFileURL, OFFileURL 
       FROM projectcontracts 
       WHERE ContractID = ?`,
      [contractID]
    );
    
    if ((rows as any[]).length > 0) {
      const urls = (rows as any[])[0];
      result.ftRh12PdfUrl = urls.CDFileURL;
      result.ftRh13PdfUrl = urls.CRFileURL;
      result.ftRh14PdfUrl = urls.OFFileURL;
    }
  }
  
  return result;
}