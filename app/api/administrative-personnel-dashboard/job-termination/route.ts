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
      // Primero verificar si es personal base o proyecto
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
        // Para personal de proyecto, buscar en projectcontracts
        const [projectPersonnel] = await connection.execute(
          `SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?`,
          [parseInt(employeeId)]
        );

        if ((projectPersonnel as any[]).length > 0) {
          const projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          const [rows] = await connection.execute(
            `SELECT CDFileURL, CRFileURL, OFFileURL 
             FROM projectcontracts 
             WHERE ProjectPersonnelID = ? AND Status = 1`,
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

    // Obtener lista de empleados
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
        bpi.RFC,
        bpi.CURP,
        bpi.NSS,
        bpi.Email,
        bpi.Phone
      FROM basepersonnel bp
      INNER JOIN employees e ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      ORDER BY bp.LastName, bp.FirstName
    `);

    const [projectEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
        e.Status,
        pp.ProjectPersonnelID,
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        p.NameProject as ProjectName,
        pc.ProjectID,
        pc.Position,
        pc.Salary,
        pc.WorkSchedule,
        pc.StartDate,
        pc.EndDate,
        pc.Status as ContractStatus,
        ppi.RFC,
        ppi.CURP,
        ppi.NSS,
        ppi.Email,
        ppi.Phone
      FROM projectpersonnel pp
      INNER JOIN employees e ON pp.EmployeeID = e.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID AND pc.Status = 1
      LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
      ORDER BY pp.LastName, pp.FirstName
    `);

    const allEmployees = [
      ...(baseEmployees as any[]).map(emp => ({ ...emp, tipo: 'BASE' as const })),
      ...(projectEmployees as any[]).map(emp => ({ ...emp, tipo: 'PROJECT' as const }))
    ];

    let filteredEmployees = allEmployees;

    if (tipo && tipo !== 'TODOS') {
      filteredEmployees = filteredEmployees.filter(emp => emp.tipo === tipo);
    }

    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredEmployees = filteredEmployees.filter(emp => 
        emp.FirstName.toLowerCase().includes(searchLower) ||
        emp.LastName.toLowerCase().includes(searchLower) ||
        (emp.MiddleName?.toLowerCase() || '').includes(searchLower) ||
        `${emp.FirstName} ${emp.LastName}`.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      employees: filteredEmployees,
      total: filteredEmployees.length
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

    await connection.beginTransaction();

    // 🔍 Tipo de empleado
    const [employeeType] = await connection.execute(
      `SELECT 
        CASE 
          WHEN EXISTS (SELECT 1 FROM basepersonnel WHERE EmployeeID = ?) THEN 'BASE'
          WHEN EXISTS (SELECT 1 FROM projectpersonnel WHERE EmployeeID = ?) THEN 'PROJECT'
        END as EmployeeType`,
      [EmployeeID, EmployeeID]
    );

    const type = (employeeType as any[])[0]?.EmployeeType;

    // 🔄 Actualizar estado en employees
    await connection.execute(
      `UPDATE employees SET Status = ? WHERE EmployeeID = ?`,
      [Status, EmployeeID]
    );

    let contractID: number | null = null;

    if (Status === 0) {
      // ========================
      // 🔻 BAJA
      // ========================

      if (type === 'PROJECT') {

        // 1. Obtener ProjectPersonnelID
        const [pp] = await connection.execute(
          `SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?`,
          [EmployeeID]
        );

        const projectPersonnelID = (pp as any[])[0]?.ProjectPersonnelID;

        if (projectPersonnelID) {

          // 2. Obtener contrato ACTIVO antes de cambiarlo
          const [contract] = await connection.execute(
            `SELECT ContractID, EndDate 
             FROM projectcontracts 
             WHERE ProjectPersonnelID = ? AND Status = 1
             LIMIT 1`,
            [projectPersonnelID]
          );

          if ((contract as any[]).length > 0) {
            contractID = (contract as any[])[0].ContractID;

            // 3. Solo cambiar status (NO tocar EndDate)
            await connection.execute(
              `UPDATE projectcontracts 
               SET Status = 0 
               WHERE ContractID = ?`,
              [contractID]
            );

          } else {
            // ⚠️ Solo si no existe contrato (caso raro)
            const [insert] = await connection.execute(
              `INSERT INTO projectcontracts (ProjectPersonnelID, Status) VALUES (?, 0)`,
              [projectPersonnelID]
            );

            contractID = (insert as any).insertId;
          }
        }
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

      // ========================
      // 📄 GENERAR PDFs
      // ========================
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const cookies = request.headers.get('cookie') || '';

      const pdfUrls = await generateAndSaveAllPDFsFixed(
        EmployeeID,
        baseUrl,
        cookies,
        type,
        contractID
      );

      return NextResponse.json({
        success: true,
        message: 'Empleado dado de baja',
        ...pdfUrls
      });

    } else {
      // ========================
      // 🔼 REACTIVAR
      // ========================

      if (type === 'PROJECT') {
        // 🔴 IMPORTANTE: Para personal de proyecto, NO se reactiva automáticamente
        // Se devuelve un mensaje indicando que debe ir al módulo de edición
        await connection.rollback();
        
        return NextResponse.json({
          success: false,
          message: 'Para reactivar personal de proyecto, debe ir al módulo de EDICIÓN DE USUARIO y asignar un nuevo contrato y proyecto.',
          requiresManualReactivation: true,
          employeeType: 'PROJECT'
        }, { status: 400 });
        
      } else if (type === 'BASE') {
        // Para personal BASE, se puede reactivar directamente
        await connection.execute(
          `DELETE FROM jobtermination WHERE EmployeeID = ?`,
          [EmployeeID]
        );

        await connection.commit();

        return NextResponse.json({
          success: true,
          message: 'Empleado reactivado exitosamente'
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
    if (connection) await connection.release();
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
      // Eliminar de jobtermination o limpiar projectcontracts según el tipo
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
        await connection.execute(
          'DELETE FROM jobtermination WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        const [basePersonnel] = await connection.execute(
          'SELECT BasePersonnelID FROM basepersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((basePersonnel as any[]).length > 0) {
          const basePersonnelID = (basePersonnel as any[])[0].BasePersonnelID;
          
          await connection.execute(
            'DELETE FROM basepersonnelpersonalinfo WHERE BasePersonnelID = ?',
            [basePersonnelID]
          );
          
          await connection.execute(
            'DELETE FROM basepersonnel WHERE EmployeeID = ?',
            [EmployeeID]
          );
        }
      } else if (type === 'PROJECT') {
        const [projectPersonnel] = await connection.execute(
          'SELECT ProjectPersonnelID FROM projectpersonnel WHERE EmployeeID = ?',
          [EmployeeID]
        );
        
        if ((projectPersonnel as any[]).length > 0) {
          const projectPersonnelID = (projectPersonnel as any[])[0].ProjectPersonnelID;
          
          // Limpiar las URLs de documentos y Status en projectcontracts
          await connection.execute(
            `UPDATE projectcontracts 
             SET CDFileURL = NULL, CRFileURL = NULL, OFFileURL = NULL, 
                 EndDate = NULL, Status = 0
             WHERE ProjectPersonnelID = ?`,
            [projectPersonnelID]
          );
          
          await connection.execute(
            'DELETE FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?',
            [projectPersonnelID]
          );
          
          await connection.execute(
            'DELETE FROM projectpersonnel WHERE EmployeeID = ?',
            [EmployeeID]
          );
        }
      }

      await connection.execute(
        'DELETE FROM employees WHERE EmployeeID = ?',
        [EmployeeID]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Empleado eliminado permanentemente'
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

// Función auxiliar para obtener información del empleado
async function getEmployeeInfo(connection: any, employeeId: number) {
  const [employeeInfo] = await connection.query(
    `SELECT EmployeeType 
    FROM employees 
    WHERE EmployeeID = ?`,
    [employeeId]
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
        pc.EndDate,
        TIMESTAMPDIFF(MONTH, pc.StartDate, CURDATE()) AS meses_trabajados,
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
  contractID: number | null
) {

  const formatos: FormatoPDF[] = ['FT-RH-12', 'FT-RH-13', 'FT-RH-14'];
  const result: any = {};

  for (const formato of formatos) {

    const url = `${baseUrl}/api/download/pdf/${formato}?empleadoId=${employeeId}&save=1`;

    const response = await fetch(url, {
      headers: { Cookie: cookies }
    });

    const data = await response.json();

    if (data.success && data.fileUrl) {

      const fieldName = fieldMap[formato];

      const connection = await getConnection();

      try {
        if (employeeType === 'PROJECT' && contractID) {

          // 🔥 SIEMPRE UPDATE (NO INSERT)
          await connection.execute(
            `UPDATE projectcontracts 
             SET ${fieldName} = ? 
             WHERE ContractID = ?`,
            [data.fileUrl, contractID]
          );

        } else if (employeeType === 'BASE') {

          await connection.execute(
            `UPDATE jobtermination 
             SET ${fieldName} = ? 
             WHERE EmployeeID = ?`,
            [data.fileUrl, employeeId]
          );
        }

      } finally {
        await connection.release();
      }

      result[fieldName] = data.fileUrl;
    }
  }

  return result;
}