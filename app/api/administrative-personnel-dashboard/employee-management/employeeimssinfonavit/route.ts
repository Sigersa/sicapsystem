import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from 'uploadthing/server';
import os from "os";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import ConvertAPI from "convertapi";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

// Función para formatear fecha correctamente para MySQL (YYYY-MM-DD)
const formatearFechaMySQL = (fecha: string): string | null => {
  if (!fecha) return null;
  
  try {
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    return fecha;
  } catch {
    return null;
  }
};

// Función para obtener los ContractIDs de un empleado (tanto BASE como PROJECT)
async function getEmployeeContractIDs(connection: any, employeeId: number): Promise<{ baseContractId: number | null, projectContractId: number | null }> {
  const [baseResult] = await connection.execute(
    `SELECT bc.ContractID as BaseContractID
     FROM basepersonnel bp 
     LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID 
     WHERE bp.EmployeeID = ? 
     LIMIT 1`,
    [employeeId]
  );
  
  const baseContracts = baseResult as any[];
  let baseContractId = null;
  if (baseContracts.length > 0 && baseContracts[0].BaseContractID) {
    baseContractId = baseContracts[0].BaseContractID;
  }
  
  const [projectResult] = await connection.execute(
    `SELECT pc.ContractID as ProjectContractID
     FROM projectpersonnel pp 
     LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID 
     WHERE pp.EmployeeID = ? 
     LIMIT 1`,
    [employeeId]
  );
  
  const projectContracts = projectResult as any[];
  let projectContractId = null;
  if (projectContracts.length > 0 && projectContracts[0].ProjectContractID) {
    projectContractId = projectContracts[0].ProjectContractID;
  }
  
  return { baseContractId, projectContractId };
}

// Función para verificar si un empleado tiene un ALTA activa (Status = 1)
async function getActiveAltaMovement(connection: any, employeeId: number): Promise<any | null> {
  const [rows] = await connection.execute(
    `SELECT em.MovementID, em.BatchID
     FROM employeeimssinfonavitmovements em
     INNER JOIN employee_movement_batches emb ON em.BatchID = emb.BatchID
     WHERE em.EmployeeID = ? 
     AND em.Status = 1
     AND emb.MovementType = 'ALTA'
     ORDER BY em.MovementID DESC
     LIMIT 1`,
    [employeeId]
  );
  
  return (rows as any[])[0] || null;
}

// Función para generar el PDF FT-RH-05
async function generateMovementPDF(
  batchId: number,
  employees: any[]
): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-05-${Date.now()}-${batchId}.xlsx`
  );

  let connection;

  try {
    connection = await getConnection();

    const [batchRows] = await connection.execute<any[]>(
      `SELECT 
        emb.BatchID,
        emb.MovementType,
        emb.DateMovement,
        emb.ReasonForWithdrawal,
        pj.NameProject,
        pj.AdminProjectID,
        COALESCE(admin_bp.FirstName) as AdminNombre,
        COALESCE(admin_bp.LastName) as AdminApellido,
        COALESCE(admin_bp.MiddleName) as AdminApellido2
      FROM employee_movement_batches emb
      LEFT JOIN employeeimssinfonavitmovements em ON em.BatchID = emb.BatchID
      LEFT JOIN projectcontracts pc ON em.ProjectContractID = pc.ContractID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      LEFT JOIN employees e ON e.EmployeeID = pj.AdminProjectID
      LEFT JOIN basepersonnel admin_bp ON admin_bp.EmployeeID = e.EmployeeID
      WHERE emb.BatchID = ?
      LIMIT 1`,
      [batchId]
    );

    if (!batchRows || batchRows.length === 0) {
      throw new Error('Movimiento no encontrado');
    }

    const batch = batchRows[0];

    const employeesData: any[] = [];
    
    for (const emp of employees) {
      const [empRows] = await connection.execute<any[]>(
        `SELECT 
          em.EmployeeID,
          em.BaseContractID,
          em.ProjectContractID,
          COALESCE(bp.FirstName, pp.FirstName) as FirstName,
          COALESCE(bp.LastName, pp.LastName) as LastName,
          COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
          COALESCE(bp.Position, pc.Position) as Position,
          COALESCE(bc.SalaryIMSS, pc.SalaryIMSS) as SalaryIMSS,
          COALESCE(bpi.CURP, ppi.CURP) as CURP,
          COALESCE(bpi.NSS, ppi.NSS) as NSS,
          COALESCE(bpi.NCI, ppi.NCI) as NCI,
          COALESCE(bpi.UMF, ppi.UMF) as UMF,    
          CASE 
            WHEN bp.EmployeeID IS NOT NULL AND em.BaseContractID IS NOT NULL THEN 'BASE'
            WHEN pp.EmployeeID IS NOT NULL AND em.ProjectContractID IS NOT NULL THEN 'PROYECTO'
            ELSE 'NO ESPECIFICADO'
          END as tipo
        FROM employeeimssinfonavitmovements em
        LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
        LEFT JOIN basecontracts bc ON em.BaseContractID = bc.ContractID
        LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
        LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
        LEFT JOIN projectcontracts pc ON em.ProjectContractID = pc.ContractID
        LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
        WHERE em.BatchID = ? AND em.EmployeeID = ?`,
        [batchId, emp.EmployeeID]
      );
      
      if (empRows && empRows.length > 0) {
        employeesData.push(empRows[0]);
      }
    }

    if (employeesData.length === 0) {
      throw new Error('No se encontraron empleados para este lote');
    }

    const adminName = [
      batch.AdminNombre || '',
      batch.AdminApellido || '',
      batch.AdminApellido2 || ''
    ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

    const formatDate = (dateValue: any): string => {
      if (!dateValue) return 'NO ESPECIFICADO';
      
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          return 'NO ESPECIFICADO';
        }
        return date.toLocaleDateString('es-MX');
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'NO ESPECIFICADO';
      }
    };

    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-05.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla FT-RH-05 no encontrada en: ' + templatePath);
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;
    
    ws.getCell('D5').value = batch.NameProject || 'NO ESPECIFICADO';
    ws.getCell('D7').value = adminName || 'NO ESPECIFICADO';

    employeesData.forEach((mov, index) => {
      const rowNumber = 10 + index; 
      
      const employeeName = [
        mov.FirstName || '',
        mov.LastName || '',
        mov.MiddleName || ''
      ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

      ws.getCell(`A${rowNumber}`).value = employeeName;
      ws.getCell(`C${rowNumber}`).value = mov.Position || 'NO ESPECIFICADO';
      ws.getCell(`E${rowNumber}`).value = mov.NSS || 'NO ESPECIFICADO';
      ws.getCell(`F${rowNumber}`).value = mov.SalaryIMSS || 'NO ESPECIFICADO';
      ws.getCell(`G${rowNumber}`).value = mov.CURP || 'NO ESPECIFICADO';
      ws.getCell(`H${rowNumber}`).value = batch.MovementType || 'NO ESPECIFICADO';
      ws.getCell(`I${rowNumber}`).value = formatDate(batch.DateMovement);
      ws.getCell(`J${rowNumber}`).value = mov.NCI || 'NO ESPECIFICADO';
      ws.getCell(`K${rowNumber}`).value = mov.UMF || 'NO ESPECIFICADO';
      ws.getCell(`L${rowNumber}`).value = mov.tipo || 'NO ESPECIFICADO';
      ws.getCell(`M${rowNumber}`).value = batch.ReasonForWithdrawal || 'N/A';
    });

    await workbook.xlsx.writeFile(tempExcelPath);

    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    const fileName = `FT-RH-05-${batchId}-${Date.now()}.pdf`;
    
    const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0] || !uploadResponse[0].data || !uploadResponse[0].data.url) {
      throw new Error('Error al subir el PDF a UploadThing');
    }
    
    const fileUrl = uploadResponse[0].data.url;

    return { pdfBuffer, fileUrl };

  } catch (error) {
    console.error('Error al generar PDF FT-RH-05:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
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
    
    const [rows] = await connection.execute(`
      SELECT 
          emb.BatchID,
          emb.MovementType,
          emb.DateMovement,
          emb.ReasonForWithdrawal,
          emb.FileURL,
          GROUP_CONCAT(DISTINCT 
            COALESCE(
              CONCAT(COALESCE(bp.FirstName, pp.FirstName), ' ', COALESCE(bp.LastName, pp.LastName)),
              ''
            ) SEPARATOR ', '
          ) as EmployeeNames
      FROM employee_movement_batches emb
      INNER JOIN employeeimssinfonavitmovements em ON em.BatchID = emb.BatchID
      LEFT JOIN employees e ON e.EmployeeID = em.EmployeeID
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      GROUP BY emb.BatchID, emb.MovementType, emb.DateMovement, emb.ReasonForWithdrawal, emb.FileURL
      HAVING COUNT(*) = SUM(CASE WHEN e.Status = 1 THEN 1 ELSE 0 END)
      ORDER BY emb.BatchID DESC;
    `);
    
    const movementsRecords = rows as any[];

    return NextResponse.json({
      success: true,
      records: movementsRecords
    });

  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER MOVIMIENTOS',
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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { 
      Employees, 
      MovementType,
      DateMovement,
      ReasonForWithdrawal,
    } = body;

    if (!Employees || !Array.isArray(Employees) || Employees.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Debe incluir al menos un empleado' },
        { status: 400 }
      );
    }

    if (Employees.length > 10) {
      return NextResponse.json(
        { success: false, message: 'Máximo 10 empleados por lote' },
        { status: 400 }
      );
    }

    if (!MovementType) {
      return NextResponse.json(
        { success: false, message: 'El tipo de movimiento es requerido' },
        { status: 400 }
      );
    }

    if (!DateMovement) {
      return NextResponse.json(
        { success: false, message: 'La fecha del movimiento es requerida' },
        { status: 400 }
      );
    }
    
    connection = await getConnection();
    await connection.beginTransaction();

    try {
      const dateMovementFormatted = DateMovement ? formatearFechaMySQL(DateMovement) : null;
      
      // Insertar en employee_movement_batches
      const [batchResult] = await connection.execute(
        `INSERT INTO employee_movement_batches 
         (MovementType, DateMovement, ReasonForWithdrawal) 
         VALUES (?, ?, ?)`,
        [
          MovementType || null,
          dateMovementFormatted,
          ReasonForWithdrawal || null
        ]
      );

      const BatchID = (batchResult as any).insertId;
      const employeesToSave = [];
      
      for (const employeeId of Employees) {
        // Obtener ambos IDs de contrato
        const { baseContractId, projectContractId } = await getEmployeeContractIDs(connection, employeeId);
        
        if (!baseContractId && !projectContractId) {
          throw new Error(`El empleado ${employeeId} no tiene un contrato activo.`);
        }

        if (MovementType === 'ALTA') {
          // Verificar si ya tiene un ALTA activa (Status = 1)
          const activeAlta = await getActiveAltaMovement(connection, employeeId);
          
          if (activeAlta) {
            throw new Error(`El empleado ${employeeId} ya tiene un ALTA activa (MovementID: ${activeAlta.MovementID}). Debe realizar una BAJA primero.`);
          }
          
          // Crear nuevo ALTA con Status = 1
          await connection.execute(
            `INSERT INTO employeeimssinfonavitmovements 
             (BatchID, EmployeeID, BaseContractID, ProjectContractID, Status) 
             VALUES (?, ?, ?, ?, 1)`,
            [
              BatchID,
              employeeId,
              baseContractId,
              projectContractId
            ]
          );
          
        } else if (MovementType === 'BAJA') {
          // Verificar si tiene un ALTA activa (Status = 1)
          const activeAlta = await getActiveAltaMovement(connection, employeeId);
          
          if (!activeAlta) {
            throw new Error(`El empleado ${employeeId} no tiene un ALTA activa. No se puede dar de BAJA.`);
          }
          
          // 1. Actualizar el ALTA activa a Status = 0 (se vuelve inactiva)
          await connection.execute(
            `UPDATE employeeimssinfonavitmovements 
             SET Status = 0 
             WHERE MovementID = ?`,
            [activeAlta.MovementID]
          );
          
          // 2. Crear el registro de BAJA con Status = 0
          await connection.execute(
            `INSERT INTO employeeimssinfonavitmovements 
             (BatchID, EmployeeID, BaseContractID, ProjectContractID, Status) 
             VALUES (?, ?, ?, ?, 0)`,
            [
              BatchID,
              employeeId,
              baseContractId,
              projectContractId
            ]
          );
        }
        
        employeesToSave.push({ EmployeeID: employeeId });
      }

      await connection.commit();

      let fileUrl = null;

      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { fileUrl: pdfUrl } = await generateMovementPDF(BatchID, employeesToSave);
        fileUrl = pdfUrl;
        
        const updateConnection = await getConnection();
        try {
          await updateConnection.execute(
            `UPDATE employee_movement_batches SET FileURL = ? WHERE BatchID = ?`,
            [pdfUrl, BatchID]
          );
          console.log(`PDF subido a UploadThing y URL actualizada: ${pdfUrl}`);
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
      }
      
      return NextResponse.json({
        success: true,
        message: fileUrl ? `Movimiento creado exitosamente para ${Employees.length} empleado(s)` : 'Movimiento creado exitosamente (sin PDF)',
        BatchID: BatchID,
        fileUrl: fileUrl,
        batchId: BatchID,
        employeeCount: Employees.length
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear movimiento:', error);
    
    let errorMessage = 'ERROR AL CREAR EL MOVIMIENTO';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: Uno o más empleados no existen o no tienen contrato activo';
      } else if (error.message.includes('date value')) {
        errorMessage = 'ERROR: Formato de fecha incorrecto';
      } else if (error.message.includes('ya tiene un ALTA activa')) {
        errorMessage = error.message;
      } else if (error.message.includes('no tiene un ALTA activa')) {
        errorMessage = error.message;
      } else if (error.message.includes('no tiene un contrato activo')) {
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
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