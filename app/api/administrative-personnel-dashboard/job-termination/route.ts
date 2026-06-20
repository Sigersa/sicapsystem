// app/api/administrative-personnel-dashboard/job-termination/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from 'uploadthing/server';

type FormatoPDF = 'FT-RH-12' | 'FT-RH-13' | 'FT-RH-14';

const fieldMap: Record<FormatoPDF, string> = {
  'FT-RH-12': 'CDFileURL',
  'FT-RH-13': 'CRFileURL',
  'FT-RH-14': 'OFFileURL'
};

// ============================================================
// FUNCIÓN CORREGIDA USANDO EL SDK DE UPLOADTHING
// ============================================================
const utapi = new UTApi();

async function deleteFilesFromUploadThing(fileUrls: string[]) {
  const validUrls = fileUrls.filter(url => url && url.trim() !== '');
  
  if (validUrls.length === 0) {
    console.log('[UploadThing] No hay archivos para eliminar');
    return true;
  }
  
  try {
    // Extraer fileKeys de las URLs
    const fileKeys = validUrls
      .map(url => {
        // Soporta diferentes formatos de URL de UploadThing
        const match = url.match(/utfs\.io\/f\/([^?]+)/);
        if (match) {
          // Limpiar el fileKey: eliminar parámetros y rutas adicionales
          let fileKey = match[1];
          fileKey = fileKey.split('?')[0].split('/')[0];
          return fileKey;
        }
        return null;
      })
      .filter((key): key is string => key !== null && key.length > 0);

    console.log('[UploadThing] FileKeys a eliminar:', fileKeys);
    
    if (fileKeys.length === 0) {
      console.log('[UploadThing] No se pudieron extraer fileKeys de las URLs');
      return true;
    }

    // Usar el SDK de UploadThing para eliminar los archivos
    await utapi.deleteFiles(fileKeys);
    
    console.log(`[UploadThing] Archivos eliminados exitosamente: ${fileKeys.length}`);
    return true;
    
  } catch (error) {
    console.error('[UploadThing] Error al eliminar archivos:', error);
    return false;
  }
}

// Función para extraer fileKey de una URL individual (para el primer código)
function extractFileKeyFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/f\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
}

// Función para eliminar un archivo individual de UploadThing
async function deleteFileFromUploadThing(fileUrl: string): Promise<void> {
  try {
    const fileKey = extractFileKeyFromUrl(fileUrl);
    if (!fileKey) {
      console.warn('No se pudo extraer el fileKey de la URL:', fileUrl);
      return;
    }
    
    await utapi.deleteFiles([fileKey]);
    console.log(`Archivo eliminado de UploadThing: ${fileKey}`);
  } catch (error) {
    console.error('Error al eliminar archivo de UploadThing:', error);
    // No lanzamos el error para no interrumpir el flujo principal
  }
}

// Función para recopilar todas las URLs de documentos de un empleado de proyecto
async function collectProjectPersonnelUrls(connection: any, projectPersonnelID: number): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    // 1. Obtener URLs de projectcontracts
    const [contracts] = await connection.execute(
      `SELECT CDFileURL, CRFileURL, OFFileURL, ContractFileURL, WarningFileURL, 
              AgreementFileURL, LetterFileURL
       FROM projectcontracts 
       WHERE ProjectPersonnelID = ?`,
      [projectPersonnelID]
    );
    
    for (const contract of contracts as any[]) {
      const fields = ['CDFileURL', 'CRFileURL', 'OFFileURL', 'ContractFileURL', 
                      'WarningFileURL', 'AgreementFileURL', 'LetterFileURL'];
      for (const field of fields) {
        if (contract[field] && typeof contract[field] === 'string' && contract[field].trim() !== '') {
          urls.push(contract[field]);
        }
      }
    }

    // 2. Obtener URLs de projectpersonneldocumentation
    const [docs] = await connection.execute(
      `SELECT CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, 
              INEFileURL, CDFileURL, CEFileURL, CPFileURL, LMFileURL,
              ANPFileURL, CRFileURL, RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
       FROM projectpersonneldocumentation 
       WHERE ProjectPersonnelID = ?`,
      [projectPersonnelID]
    );
    
    if ((docs as any[]).length > 0) {
      const doc = (docs as any[])[0];
      for (const [key, value] of Object.entries(doc)) {
        if (value && typeof value === 'string' && value.trim() !== '') {
          urls.push(value);
        }
      }
    }

  } catch (error) {
    console.error('[collectProjectPersonnelUrls] Error:', error);
  }
  
  return urls;
}

// Función para recopilar todas las URLs de documentos de un empleado base
async function collectBasePersonnelUrls(connection: any, employeeId: number): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    // 1. Obtener URLs de jobtermination
    const [rows] = await connection.execute(
      `SELECT CDFileURL, CRFileURL, OFFileURL 
       FROM jobtermination 
       WHERE EmployeeID = ?`,
      [employeeId]
    );
    
    if ((rows as any[]).length > 0) {
      const urlsRow = (rows as any[])[0];
      const fields = ['CDFileURL', 'CRFileURL', 'OFFileURL'];
      for (const field of fields) {
        if (urlsRow[field] && typeof urlsRow[field] === 'string' && urlsRow[field].trim() !== '') {
          urls.push(urlsRow[field]);
        }
      }
    }

    // 2. Obtener BasePersonnelID
    const [bp] = await connection.execute(
      'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
      [employeeId]
    );
    
    if ((bp as any[]).length > 0) {
      const basePersonnelID = (bp as any[])[0].BasePersonnelID;
      
      // 3. Obtener URLs de basepersonneldocumentation
      const [docs] = await connection.execute(
        `SELECT CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, 
                INEFileURL, CDFileURL, CEFileURL, CPFileURL, LMFileURL,
                ANPFileURL, CRFileURL, RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
         FROM basepersonneldocumentation 
         WHERE BasePersonnelID = ?`,
        [basePersonnelID]
      );
      
      if ((docs as any[]).length > 0) {
        const doc = (docs as any[])[0];
        for (const [key, value] of Object.entries(doc)) {
          if (value && typeof value === 'string' && value.trim() !== '') {
            urls.push(value);
          }
        }
      }
      
      // 4. Obtener URLs de basecontracts
      const [contracts] = await connection.execute(
        `SELECT ContractFileURL, WarningFileURL, AgreementFileURL, LetterFileURL
         FROM basecontracts 
         WHERE BasePersonnelID = ?`,
        [basePersonnelID]
      );
      
      for (const contract of contracts as any[]) {
        const fields = ['ContractFileURL', 'WarningFileURL', 'AgreementFileURL', 'LetterFileURL'];
        for (const field of fields) {
          if (contract[field] && typeof contract[field] === 'string' && contract[field].trim() !== '') {
            urls.push(contract[field]);
          }
        }
      }
    }

  } catch (error) {
    console.error('[collectBasePersonnelUrls] Error:', error);
  }
  
  return urls;
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
          // Obtener todas las URLs de documentos del empleado base
          const urlsToDelete = await collectBasePersonnelUrls(connection, EmployeeID);
          
          // Eliminar archivos de UploadThing usando el SDK
          if (urlsToDelete.length > 0) {
            console.log(`[Reactivación] Eliminando ${urlsToDelete.length} archivos de UploadThing para empleado ${EmployeeID}`);
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

    // Verificar si el empleado existe
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
        { success: false, message: 'Solo se pueden eliminar empleados dados de baja (Status = 0)' },
        { status: 400 }
      );
    }

    // ============================================================
    // VALIDACIONES DE DEPENDENCIAS ANTES DE ELIMINAR
    // ============================================================

    // 1. Verificar si es administrador de proyectos
    const [adminProjects] = await connection.execute(
      `SELECT ProjectID, NameProject 
       FROM projects 
       WHERE AdminProjectID = ?`,
      [EmployeeID]
    );

    if ((adminProjects as any[]).length > 0) {
      const projectNames = (adminProjects as any[]).map(p => p.NameProject).join(', ');
      return NextResponse.json(
        { 
          success: false, 
          message: `No se puede eliminar el empleado porque es administrador del(los) siguiente(s) proyecto(s): ${projectNames}. Debe reasignar o eliminar estos proyectos antes de proceder.` 
        },
        { status: 400 }
      );
    }

    // 2. Verificar si es jefe directo de contratos base
    const [baseContracts] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM basecontracts 
       WHERE jefeDirectoId = ?`,
      [EmployeeID]
    );

    const baseContractsCount = (baseContracts as any[])[0]?.count || 0;
    if (baseContractsCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `No se puede eliminar el empleado porque es jefe directo de ${baseContractsCount} contrato(s) base. Debe reasignar estos contratos antes de proceder.` 
        },
        { status: 400 }
      );
    }

    // 3. Verificar si es entrenador en DC3
    const [dc3Trainer] = await connection.execute(
      `SELECT COUNT(*) as count 
       FROM employeedc3 
       WHERE TrainerID = ?`,
      [EmployeeID]
    );

    const dc3TrainerCount = (dc3Trainer as any[])[0]?.count || 0;
    if (dc3TrainerCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `No se puede eliminar el empleado porque es entrenador en ${dc3TrainerCount} registro(s) DC3. Debe reasignar estos registros antes de proceder.` 
        },
        { status: 400 }
      );
    }

    // Si pasó todas las validaciones, proceder con la eliminación
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
      let projectPersonnelID: number | null = null;

      if (type === 'BASE') {
        // Recopilar todas las URLs de documentos del empleado base
        urlsToDelete = await collectBasePersonnelUrls(connection, EmployeeID);

        // Eliminar jobtermination primero (esto también eliminará sus documentos)
        await connection.execute('DELETE FROM jobtermination WHERE EmployeeID = ?', [EmployeeID]);
        
        // Eliminar basepersonnel (las FK con CASCADE eliminarán el resto)
        await connection.execute('DELETE FROM basepersonnel WHERE EmployeeID = ?', [EmployeeID]);
        
      } else if (type === 'PROJECT') {
        // Obtener ProjectPersonnelID
        const [projectPersonnel] = await connection.execute(
          'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((projectPersonnel as any[]).length > 0) {
          projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          if (projectPersonnelID !== null) {
            // Recopilar todas las URLs de documentos del empleado de proyecto
            urlsToDelete = await collectProjectPersonnelUrls(connection, projectPersonnelID);

            console.log(`[DELETE] URLs a eliminar para proyecto ${projectPersonnelID}:`, urlsToDelete.length);

            // 3. ELIMINAR REGISTROS ASOCIADOS
            // Eliminar projectcontracts (NO elimina el proyecto)
            await connection.execute(
              'DELETE FROM projectcontracts WHERE ProjectPersonnelID = ?',
              [projectPersonnelID]
            );
            
            // Eliminar projectpersonnelbeneficiaries
            await connection.execute(
              'DELETE FROM projectpersonnelbeneficiaries WHERE ProjectPersonnelID = ?',
              [projectPersonnelID]
            );
            
            // Eliminar projectpersonneldocumentation
            await connection.execute(
              'DELETE FROM projectpersonneldocumentation WHERE ProjectPersonnelID = ?',
              [projectPersonnelID]
            );
            
            // Eliminar projectpersonnelpersonalinfo
            await connection.execute(
              'DELETE FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?',
              [projectPersonnelID]
            );
          }
        }
        
        // ============================================================
        // ELIMINAR jobtermination PARA EMPLEADOS DE PROYECTO
        // ============================================================
        // Primero obtener las URLs de jobtermination antes de eliminar
        const [jtRows] = await connection.execute(
          `SELECT CDFileURL, CRFileURL, OFFileURL 
           FROM jobtermination 
           WHERE EmployeeID = ?`,
          [EmployeeID]
        );
        
        if ((jtRows as any[]).length > 0) {
          const urlsRow = (jtRows as any[])[0];
          const fields = ['CDFileURL', 'CRFileURL', 'OFFileURL'];
          for (const field of fields) {
            if (urlsRow[field] && typeof urlsRow[field] === 'string' && urlsRow[field].trim() !== '') {
              urlsToDelete.push(urlsRow[field]);
            }
          }
        }
        
        // Eliminar jobtermination
        await connection.execute(
          'DELETE FROM jobtermination WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        // 5. Finalmente eliminar el projectpersonnel
        await connection.execute(
          'DELETE FROM projectpersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
      }

      // Eliminar archivos de UploadThing usando el SDK ANTES de eliminar los registros
      if (urlsToDelete.length > 0) {
        console.log(`[DELETE] Eliminando ${urlsToDelete.length} archivos de UploadThing para empleado ${EmployeeID}`);
        const deleted = await deleteFilesFromUploadThing(urlsToDelete);
        if (!deleted) {
          console.warn('[DELETE] Algunos archivos no se pudieron eliminar de UploadThing');
        }
      }

      // Ahora eliminar el empleado
      await connection.execute('DELETE FROM employees WHERE EmployeeID = ?', [EmployeeID]);
      
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'EMPLEADO ELIMINADO PERMANENTEMENTE JUNTO CON TODOS SUS REGISTROS Y DOCUMENTOS ASOCIADOS'
      });

    } catch (error: any) {
      await connection.rollback();
      console.error('Error en transacción de eliminación:', error);
      
      let errorMessage = 'Error al eliminar el empleado.';
      if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        if (error.sqlMessage?.includes('projectcontracts')) {
          errorMessage = 'No se puede eliminar el empleado porque tiene contratos de proyecto asociados.';
        } else if (error.sqlMessage?.includes('basecontracts')) {
          errorMessage = 'No se puede eliminar el empleado porque es jefe directo de contratos base. Debe reasignar estos contratos primero.';
        } else if (error.sqlMessage?.includes('employeedc3')) {
          errorMessage = 'No se puede eliminar el empleado porque es instructor en registros DC3. Debe reasignar estos registros primero.';
        } else if (error.sqlMessage?.includes('projects')) {
          errorMessage = 'No se puede eliminar el empleado porque es administrador de proyectos. Debe reasignar estos proyectos primero.';
        } else {
          errorMessage = 'No se puede eliminar el empleado porque tiene registros relacionados en la base de datos.';
        }
      } else if (error.sqlMessage) {
        errorMessage = `Error en la base de datos: ${error.sqlMessage}`;
      }
      
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 500 }
      );
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
          console.log(`[PDF-GEN] Guardando ${formato} en contrato ${contractID}`);
          await updateConnection.execute(
            `UPDATE projectcontracts SET ${fieldName} = ? WHERE ContractID = ?`,
            [data.fileUrl, contractID]
          );
        } else if (employeeType === 'BASE') {
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
        
        console.log(`[PDF-GEN] ${formato} guardado exitosamente`);
      } catch (error) {
        console.error(`[PDF-GEN] Error guardando ${formato}:`, error);
      } finally {
        if (updateConnection) {
          await updateConnection.release();
        }
      }
    } else {
      console.error(`[PDF-GEN] Error generando ${formato}:`, data);
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