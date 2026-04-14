import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

async function uploadToUploadThing(fileBuffer: Buffer, fileName: string): Promise<string | null> {
  try {
    const uint8Array = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8Array], { type: 'application/pdf' });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    
    const uploadedFiles = await utapi.uploadFiles([file]);
    
    if (uploadedFiles[0] && uploadedFiles[0].data) {
      const fileUrl = (uploadedFiles[0].data as any).ufsUrl || uploadedFiles[0].data.url;
      return fileUrl;
    }
    
    return null;
  } catch (error) {
    console.error('Error al subir a UploadThing:', error);
    return null;
  }
}

async function generateAndSavePDF(employeeId: number, formato: string, baseUrl: string, cookies?: string): Promise<string | null> {
  try {
    console.log(`Generando PDF para ${formato}, EmployeeID: ${employeeId}`);
    
    const url = `${baseUrl}/api/download/pdf/${formato}?empleadoId=${employeeId}`;
    console.log('URL de generación PDF:', url);
    
    const response = await fetch(url, {
      headers: {
        Cookie: cookies || ''
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error al generar PDF ${formato}:`, response.status, errorText);
      return null;
    }
    
    const pdfBuffer = await response.arrayBuffer();
    
    const fileName = `${formato}_${employeeId}_${Date.now()}.pdf`;
    const fileUrl = await uploadToUploadThing(Buffer.from(pdfBuffer), fileName);
    
    if (fileUrl) {
      console.log(`${formato} subido a UploadThing: ${fileUrl}`);
      return fileUrl;
    }
    
    return null;
  } catch (error) {
    console.error(`Error en generateAndSavePDF para ${formato}:`, error);
    return null;
  }
}

async function updateDocumentUrl(connection: any, employeeId: number, formato: string, fileUrl: string) {
  const fieldMap: Record<string, string> = {
    'FT-RH-12': 'CDFileURL',
    'FT-RH-13': 'CRFileURL',
    'FT-RH-14': 'OFFileURL'
  };
  
  const fieldName = fieldMap[formato];
  if (!fieldName) return;
  
  await connection.execute(
    `UPDATE jobtermination SET ${fieldName} = ? WHERE EmployeeID = ?`,
    [fileUrl, employeeId]
  );
  
  console.log(`URL de ${formato} actualizada para EmployeeID: ${employeeId}`);
}

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
      LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
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
        ppi.RFC,
        ppi.CURP,
        ppi.NSS,
        ppi.Email,
        ppi.Phone
      FROM projectpersonnel pp
      INNER JOIN employees e ON pp.EmployeeID = e.EmployeeID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
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
    const { EmployeeID, Status } = body;

    if (!EmployeeID || Status === undefined) {
      return NextResponse.json(
        { success: false, message: 'Faltan datos requeridos: EmployeeID y Status' },
        { status: 400 }
      );
    }

    if (Status !== 0 && Status !== 1) {
      return NextResponse.json(
        { success: false, message: 'El status debe ser 0 (inactivo) o 1 (activo)' },
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

    await connection.beginTransaction();

    try {
      await connection.execute(
        'UPDATE employees SET Status = ? WHERE EmployeeID = ?',
        [Status, EmployeeID]
      );

      if (Status === 0) {
        const [existingTermination] = await connection.execute(
          'SELECT JobTerminationID FROM jobtermination WHERE EmployeeID = ?',
          [EmployeeID]
        );

        if ((existingTermination as any[]).length === 0) {
          await connection.execute(
            `INSERT INTO jobtermination (EmployeeID, EndDate) 
             VALUES (?, NOW())`,
            [EmployeeID]
          );
        } else {
          await connection.execute(
            'UPDATE jobtermination SET EndDate = NOW() WHERE EmployeeID = ?',
            [EmployeeID]
          );
        }
        
        await connection.commit();
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
        const cookies = request.headers.get('cookie') || '';
        
        const formatos = ['FT-RH-12', 'FT-RH-13', 'FT-RH-14'];
        
        for (const formato of formatos) {
          try {
            const fileUrl = await generateAndSavePDF(EmployeeID, formato, baseUrl, cookies);
            if (fileUrl) {
              const updateConnection = await getConnection();
              try {
                await updateDocumentUrl(updateConnection, EmployeeID, formato, fileUrl);
              } finally {
                await updateConnection.release();
              }
            }
            if (formato !== 'FT-RH-14') {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (pdfError) {
            console.error(`Error generando ${formato}:`, pdfError);
          }
        }
        
      } else if (Status === 1) {
        await connection.execute(
          'DELETE FROM jobtermination WHERE EmployeeID = ?',
          [EmployeeID]
        );
        await connection.commit();
      }

      const actionText = Status === 0 ? 'dado de baja' : 'reactivado';

      return NextResponse.json({
        success: true,
        message: `Empleado ${actionText} exitosamente`,
        data: { EmployeeID, Status }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar status del empleado:', error);
    return NextResponse.json(
      { success: false, message: 'ERROR AL ACTUALIZAR EL ESTADO DEL EMPLEADO' },
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
      const [termination] = await connection.execute(
        'SELECT CDFileURL, CRFileURL, OFFileURL FROM jobtermination WHERE EmployeeID = ?',
        [EmployeeID]
      );
      
      const fileUrls = (termination as any[])[0] || {};
      
      await connection.execute(
        'DELETE FROM jobtermination WHERE EmployeeID = ?',
        [EmployeeID]
      );

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
          
          await connection.execute(
            'DELETE FROM projectpersonnelpersonalinfo WHERE ProjectPersonnelID = ?',
            [projectPersonnelID]
          );
          
          await connection.execute(
            'DELETE FROM projectcontracts WHERE ProjectPersonnelID = ?',
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
      
      for (const [key, url] of Object.entries(fileUrls)) {
        if (url && typeof url === 'string') {
          try {
            const fileKey = url.match(/\/f\/([a-zA-Z0-9-_]+)/)?.[1];
            if (fileKey) {
              await utapi.deleteFiles([fileKey]);
              console.log(`Archivo eliminado de UploadThing: ${fileKey}`);
            }
          } catch (deleteError) {
            console.error(`Error al eliminar archivo ${key}:`, deleteError);
          }
        }
      }

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