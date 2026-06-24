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

function extractFileKeyFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/f\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
}

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
  }
}

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

// Función para obtener el ALTA activa (Status = 1) de un empleado
async function getActiveAltaMovement(connection: any, employeeId: number, excludeBatchId?: number): Promise<any | null> {
  let query = `
    SELECT em.MovementID, em.BatchID
    FROM employeeimssinfonavitmovements em
    INNER JOIN employee_movement_batches emb ON em.BatchID = emb.BatchID
    WHERE em.EmployeeID = ? 
    AND em.Status = 1
    AND emb.MovementType = 'ALTA'
  `;
  
  const params: any[] = [employeeId];
  
  if (excludeBatchId) {
    query += ` AND em.BatchID != ?`;
    params.push(excludeBatchId);
  }
  
  query += ` ORDER BY em.MovementID DESC LIMIT 1`;
  
  const [rows] = await connection.execute(query, params);
  return (rows as any[])[0] || null;
}

// Función para obtener el último movimiento de un empleado (para restaurar status)
async function getLastMovement(connection: any, employeeId: number, excludeBatchId?: number): Promise<any | null> {
  let query = `
    SELECT em.MovementID, em.Status, emb.MovementType
    FROM employeeimssinfonavitmovements em
    INNER JOIN employee_movement_batches emb ON em.BatchID = emb.BatchID
    WHERE em.EmployeeID = ?
  `;
  
  const params: any[] = [employeeId];
  
  if (excludeBatchId) {
    query += ` AND em.BatchID != ?`;
    params.push(excludeBatchId);
  }
  
  query += ` ORDER BY em.MovementID DESC LIMIT 1`;
  
  const [rows] = await connection.execute(query, params);
  return (rows as any[])[0] || null;
}

async function generateUpdatedMovementPDF(
  batchId: number
): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-05-EDIT-${Date.now()}-${batchId}.xlsx`
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
      throw new Error(`Batch con ID ${batchId} no encontrado`);
    }

    const batch = batchRows[0];

    const [employeeRows] = await connection.execute<any[]>(
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
      WHERE em.BatchID = ?
      ORDER BY em.MovementID`,
      [batchId]
    );

    if (employeeRows.length === 0) {
      throw new Error('No se encontraron empleados para este lote');
    }

    if (employeeRows.length > 10) {
      throw new Error('El lote tiene más de 10 movimientos');
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

    employeeRows.forEach((mov, index) => {
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

// GET: Obtener un lote específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id } = await params;
    
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

    const batchId = parseInt(id);

    connection = await getConnection();

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

    const [employeeRows] = await connection.execute<any[]>(
      `SELECT 
        em.EmployeeID,
        em.BaseContractID,
        em.ProjectContractID,
        em.Status,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bp.Area, pj.NameProject) as AreaOrProject,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL AND em.BaseContractID IS NOT NULL THEN 'BASE'
          WHEN pp.EmployeeID IS NOT NULL AND em.ProjectContractID IS NOT NULL THEN 'PROYECTO'
          ELSE 'NO ESPECIFICADO'
        END as tipo
      FROM employeeimssinfonavitmovements em
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
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

// PUT: Actualizar lote completo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id } = await params;
    
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

    const BatchID = parseInt(id);
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

    if (MovementType.toUpperCase() === 'BAJA' && !ReasonForWithdrawal) {
      return NextResponse.json(
        { success: false, message: 'El motivo de baja es requerido para movimientos de BAJA' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Obtener el batch actual
      const [batchCheck] = await connection.execute<any[]>(
        'SELECT BatchID, FileURL, MovementType as CurrentMovementType FROM employee_movement_batches WHERE BatchID = ?',
        [BatchID]
      );

      if (batchCheck.length === 0) {
        throw new Error('El lote no existe');
      }

      const currentBatch = batchCheck[0];
      const oldFileUrl = currentBatch.FileURL;
      const currentMovementType = currentBatch.CurrentMovementType;

      // Obtener los empleados actuales del lote
      const [currentEmployees] = await connection.execute<any[]>(
        `SELECT EmployeeID, Status FROM employeeimssinfonavitmovements WHERE BatchID = ?`,
        [BatchID]
      );
      
      const currentEmployeeIds = currentEmployees.map((e: any) => e.EmployeeID);

      // Determinar el nuevo status basado en el MovementType
      const newStatus = MovementType === 'ALTA' ? 1 : 0;

      // Procesar los empleados que serán removidos del lote
      for (const empId of currentEmployeeIds) {
        if (!Employees.includes(empId)) {
          // El empleado fue removido del lote
          // Buscar el último movimiento del empleado (excluyendo el lote actual)
          const lastMovement = await getLastMovement(connection, empId, BatchID);
          
          if (lastMovement) {
            // Restaurar el status del último movimiento anterior
            await connection.execute(
              `UPDATE employeeimssinfonavitmovements 
               SET Status = ? 
               WHERE MovementID = ?`,
              [lastMovement.Status, lastMovement.MovementID]
            );
          }
        }
      }

      // Procesar los empleados que se mantienen o se agregan
      const employeesToSave = [];
      
      for (const employeeId of Employees) {
        const { baseContractId, projectContractId } = await getEmployeeContractIDs(connection, employeeId);
        
        if (!baseContractId && !projectContractId) {
          throw new Error(`El empleado ${employeeId} no tiene un contrato activo.`);
        }

        // Verificar si el empleado ya está en el lote actual
        const existingInBatch = currentEmployeeIds.includes(employeeId);
        
        if (existingInBatch) {
          // Si ya está en el lote, actualizar su status según el nuevo MovementType
          employeesToSave.push({ 
            EmployeeID: employeeId, 
            BaseContractID: baseContractId, 
            ProjectContractID: projectContractId,
            Status: newStatus
          });
          
          // Actualizar el status del empleado en el lote
          await connection.execute(
            `UPDATE employeeimssinfonavitmovements 
             SET Status = ? 
             WHERE BatchID = ? AND EmployeeID = ?`,
            [newStatus, BatchID, employeeId]
          );
        } else {
          // Nuevo empleado agregado al lote
          if (MovementType === 'ALTA') {
            // Verificar si tiene un ALTA activa en otro lote
            const activeAlta = await getActiveAltaMovement(connection, employeeId);
            
            if (activeAlta) {
              throw new Error(`El empleado ${employeeId} ya tiene un ALTA activa (MovementID: ${activeAlta.MovementID}). Debe realizar una BAJA primero.`);
            }
            
            employeesToSave.push({ 
              EmployeeID: employeeId, 
              BaseContractID: baseContractId, 
              ProjectContractID: projectContractId,
              Status: 1
            });
            
          } else if (MovementType === 'BAJA') {
            // Verificar si tiene un ALTA activa
            const activeAlta = await getActiveAltaMovement(connection, employeeId);
            
            if (!activeAlta) {
              throw new Error(`El empleado ${employeeId} no tiene un ALTA activa. No se puede dar de BAJA.`);
            }
            
            // Marcar el ALTA activa como inactiva
            await connection.execute(
              `UPDATE employeeimssinfonavitmovements 
               SET Status = 0 
               WHERE MovementID = ?`,
              [activeAlta.MovementID]
            );
            
            employeesToSave.push({ 
              EmployeeID: employeeId, 
              BaseContractID: baseContractId, 
              ProjectContractID: projectContractId,
              Status: 0
            });
          }
        }
      }

      const dateMovementFormatted = DateMovement ? formatearFechaMySQL(DateMovement) : null;

      // Actualizar los datos del batch
      await connection.execute(
        `UPDATE employee_movement_batches 
         SET MovementType = ?, DateMovement = ?, ReasonForWithdrawal = ?
         WHERE BatchID = ?`,
        [
          MovementType || null,
          dateMovementFormatted,
          ReasonForWithdrawal || null,
          BatchID
        ]
      );

      // Eliminar los empleados que ya no están en el lote
      for (const empId of currentEmployeeIds) {
        if (!Employees.includes(empId)) {
          await connection.execute(
            'DELETE FROM employeeimssinfonavitmovements WHERE BatchID = ? AND EmployeeID = ?',
            [BatchID, empId]
          );
        }
      }

      // Insertar los nuevos empleados (los que no estaban en el lote)
      for (const emp of employeesToSave) {
        if (!currentEmployeeIds.includes(emp.EmployeeID)) {
          await connection.execute(
            `INSERT INTO employeeimssinfonavitmovements 
             (BatchID, EmployeeID, BaseContractID, ProjectContractID, Status) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              BatchID,
              emp.EmployeeID,
              emp.BaseContractID,
              emp.ProjectContractID,
              emp.Status
            ]
          );
        }
      }

      await connection.commit();

      // Generar nuevo PDF
      let newFileUrl: string | null = null;
      let pdfGenerationSuccess = false;

      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { fileUrl: pdfUrl } = await generateUpdatedMovementPDF(BatchID);
        newFileUrl = pdfUrl;
        pdfGenerationSuccess = true;
        
        const updateConnection = await getConnection();
        try {
          await updateConnection.execute(
            `UPDATE employee_movement_batches SET FileURL = ? WHERE BatchID = ?`,
            [newFileUrl, BatchID]
          );
          console.log(`PDF actualizado subido a UploadThing: ${newFileUrl}`);
          
          if (oldFileUrl && pdfGenerationSuccess) {
            await deleteFileFromUploadThing(oldFileUrl);
          }
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF durante actualización:', pdfError);
        newFileUrl = oldFileUrl;
        
        if (oldFileUrl) {
          const restoreConnection = await getConnection();
          try {
            await restoreConnection.execute(
              `UPDATE employee_movement_batches SET FileURL = ? WHERE BatchID = ?`,
              [oldFileUrl, BatchID]
            );
          } finally {
            await restoreConnection.release();
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: pdfGenerationSuccess 
          ? `Lote actualizado exitosamente para ${Employees.length} empleado(s) con nuevo documento` 
          : `Lote actualizado exitosamente para ${Employees.length} empleado(s) (sin cambios en el documento)`,
        fileUrl: newFileUrl,
        batchId: BatchID,
        employeeCount: Employees.length
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar lote:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL LOTE';
    
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

// DELETE: Eliminar lote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    const { id } = await params;
    
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

    const BatchID = parseInt(id);

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      const [batchCheck] = await connection.execute<any[]>(
        'SELECT BatchID, FileURL FROM employee_movement_batches WHERE BatchID = ?',
        [BatchID]
      );

      if (batchCheck.length === 0) {
        throw new Error('El lote no existe');
      }

      const fileUrl = batchCheck[0].FileURL;

      // Obtener los empleados del lote
      const [employees] = await connection.execute<any[]>(
        `SELECT EmployeeID, Status 
         FROM employeeimssinfonavitmovements 
         WHERE BatchID = ?`,
        [BatchID]
      );

      // Restaurar status de empleados que estaban en el lote
      for (const emp of employees) {
        // Buscar el último movimiento del empleado (excluyendo el lote actual)
        const lastMovement = await getLastMovement(connection, emp.EmployeeID, BatchID);
        
        if (lastMovement) {
          // Restaurar el status del último movimiento anterior
          await connection.execute(
            `UPDATE employeeimssinfonavitmovements 
             SET Status = ? 
             WHERE MovementID = ?`,
            [lastMovement.Status, lastMovement.MovementID]
          );
        }
      }

      if (fileUrl) {
        await deleteFileFromUploadThing(fileUrl);
      }
      
      await connection.execute(
        'DELETE FROM employeeimssinfonavitmovements WHERE BatchID = ?',
        [BatchID]
      );

      await connection.execute(
        'DELETE FROM employee_movement_batches WHERE BatchID = ?',
        [BatchID]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Lote eliminado exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar lote:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL LOTE';
    
    if (error instanceof Error) {
      errorMessage = error.message;
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