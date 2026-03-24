// app/api/administrative-personnel-dashboard/employee-management/employeepermissions/[id]/route.ts
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

// Función para extraer el fileKey de una URL de UploadThing
function extractFileKeyFromUrl(url: string): string | null {
  try {
    const matches = url.match(/\/f\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
}

// Función para eliminar archivo de UploadThing
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

// Función para generar el PDF FT-RH-09 actualizado
async function generateUpdatedPermissionPDF(
  permissionId: number
): Promise<ArrayBuffer> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-09-EDIT-${Date.now()}-${permissionId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-09-EDIT-${Date.now()}-${permissionId}.pdf`
  );

  let connection;

  try {
    connection = await getConnection();

    // Obtener información del permiso y del empleado
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        p.PermissionID,
        p.EmployeeID,
        p.ApplicationDate,
        p.DepartureTime,
        p.CheckInTime,
        p.DaysOfLeave,
        p.PermitDate,
        p.PermitEndDate,
        p.Reason,
        p.AutorizationType,
        p.Observations,
        p.TypeOfPermission,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo,
        COALESCE(bp.Area, pj.NameProject) as AreaOrProject,
        -- Jefe directo
        COALESCE(jefe_bp.FirstName, jefe_pp.FirstName) as JefeFirstName,
        COALESCE(jefe_bp.LastName, jefe_pp.LastName) as JefeLastName,
        COALESCE(jefe_bp.MiddleName, jefe_pp.MiddleName) as JefeMiddleName,
        -- Número total de permisos en el mes y año
        (SELECT COUNT(*) FROM employeepermission ep 
         WHERE ep.EmployeeID = p.EmployeeID 
         AND MONTH(ep.ApplicationDate) = MONTH(CURRENT_DATE())
         AND YEAR(ep.ApplicationDate) = YEAR(CURRENT_DATE())) as totalPermisosMes,
        (SELECT COUNT(*) FROM employeepermission ep 
         WHERE ep.EmployeeID = p.EmployeeID 
         AND YEAR(ep.ApplicationDate) = YEAR(CURRENT_DATE())) as totalPermisosAnio
      FROM employeepermission p
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON p.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON p.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      -- Jefe directo (BASE)
      LEFT JOIN basepersonnel jefe_bp ON bc.jefeDirectoId = jefe_bp.EmployeeID
      -- Jefe directo (PROJECT)
      LEFT JOIN projectpersonnel jefe_pp ON pc.jefeDirectoId = jefe_pp.EmployeeID
      WHERE p.PermissionID = ?`,
      [permissionId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Registro de permiso con ID ${permissionId} no encontrado`);
    }

    const perm = rows[0];

    // Construir nombre completo del empleado
    const employeeName = [
      perm.FirstName || '',
      perm.LastName || '',
      perm.MiddleName || ''
    ].filter(part => part.trim() !== '').join(' ');

    // Construir nombre completo del jefe directo
    const jefeDirectoNombre = [
      perm.JefeFirstName || '',
      perm.JefeLastName || '',
      perm.JefeMiddleName || ''
    ].filter(part => part.trim() !== '').join(' ') || "NO ESPECIFICADO";

    // Formatear fecha de aplicación
    let applicationDay = "00";
    let applicationMonth = "MES NO ESPECIFICADO";
    let applicationYear = "0000";
    
    if (perm.ApplicationDate) {
      const date = new Date(perm.ApplicationDate);
      if (!isNaN(date.getTime())) {
        applicationDay = date.getDate().toString();
        const meses = [
          "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
          "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
        ];
        applicationMonth = meses[date.getMonth()];
        applicationYear = date.getFullYear().toString();
      }
    }

    // Formatear hora de salida
    let departureTime = "NO ESPECIFICADO";
    if (perm.DepartureTime) {
      const timeStr = perm.DepartureTime;
      if (typeof timeStr === 'string' && timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        departureTime = `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
      } else {
        try {
          const date = new Date(timeStr);
          if (!isNaN(date.getTime())) {
            departureTime = date.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }).toUpperCase();
          } else {
            departureTime = timeStr;
          }
        } catch {
          departureTime = timeStr;
        }
      }
    }

    // Formatear hora de entrada
    let checkInTime = "NO ESPECIFICADO";
    if (perm.CheckInTime) {
      const timeStr = perm.CheckInTime;
      if (typeof timeStr === 'string' && timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        checkInTime = `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
      } else {
        try {
          const date = new Date(timeStr);
          if (!isNaN(date.getTime())) {
            checkInTime = date.toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }).toUpperCase();
          } else {
            checkInTime = timeStr;
          }
        } catch {
          checkInTime = timeStr;
        }
      }
    }

    // Formatear fecha del permiso (rango si aplica)
    let permitDate = "NO ESPECIFICADO";
    if (perm.PermitDate) {
      const formatSingleDate = (dateStr: string) => {
        try {
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('es-MX', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
          return dateStr;
        } catch {
          return dateStr;
        }
      };

      const startDateFormatted = formatSingleDate(perm.PermitDate);
      const daysNum = perm.DaysOfLeave ? parseInt(perm.DaysOfLeave) : 1;
      
      if (daysNum > 1 && perm.PermitEndDate) {
        const endDateFormatted = formatSingleDate(perm.PermitEndDate);
        permitDate = `${startDateFormatted} - ${endDateFormatted}`;
      } else {
        permitDate = startDateFormatted;
      }
    }

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-09.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla FT-RH-09 no encontrada en: ' + templatePath);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Llenar datos en la plantilla
    ws.getCell("P5").value = perm.totalPermisosMes || 0;
    ws.getCell("P7").value = perm.totalPermisosAnio || 0;

    // Limpiar y marcar tipo de permiso
    ws.getCell("L9").value = "";
    ws.getCell("P9").value = "";
    if (perm.TypeOfPermission === "IMPREVISTO") {
      ws.getCell("L9").value = "/";
    } else if (perm.TypeOfPermission === "PROGRAMADO") {
      ws.getCell("P9").value = "/";
    }

    // Limpiar y marcar motivo
    ws.getCell("C19").value = "";
    ws.getCell("G19").value = "";
    ws.getCell("L19").value = "";
    ws.getCell("P19").value = "";
    if (perm.Reason) {
      const motivo = perm.Reason.toUpperCase().trim();
      if (motivo === "PERSONALES") ws.getCell("C19").value = "/";
      else if (motivo === "SALUD") ws.getCell("G19").value = "/";
      else if (motivo === "CAPACITACIÓN" || motivo === "CAPACITACION") ws.getCell("L19").value = "/";
      else if (motivo === "OTROS") ws.getCell("P19").value = "/";
    }

    // Limpiar y marcar tipo de autorización
    ws.getCell("G22").value = "";
    ws.getCell("M22").value = "";
    if (perm.AutorizationType) {
      const tipoAutorizacion = perm.AutorizationType.toUpperCase().trim();
      if (tipoAutorizacion === "REMUNERADO") ws.getCell("G22").value = "/";
      else if (tipoAutorizacion === "NO REMUNERADO") ws.getCell("M22").value = "/";
    }

    ws.getCell("I11").value = applicationDay;
    ws.getCell("K11").value = applicationMonth;
    ws.getCell("P11").value = applicationYear;
    ws.getCell("C13").value = employeeName || "NO ESPECIFICADO";
    ws.getCell("C14").value = perm.AreaOrProject || "NO ESPECIFICADO";
    ws.getCell("C15").value = perm.tipo || "NO ESPECIFICADO";
    ws.getCell("M13").value = departureTime;
    ws.getCell("M14").value = checkInTime;
    ws.getCell("M15").value = perm.DaysOfLeave ? perm.DaysOfLeave.toString() : "NO ESPECIFICADO";
    ws.getCell("M16").value = permitDate;
    ws.getCell("A25").value = perm.Observations || "SIN OBSERVACIONES";
    ws.getCell("A32").value = employeeName || "NO ESPECIFICADO";
    ws.getCell("F32").value = jefeDirectoNombre;

    // Guardar Excel temporal
    await workbook.xlsx.writeFile(tempExcelPath);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    return pdfBuffer;

  } catch (error) {
    console.error('Error al generar PDF FT-RH-09 actualizado:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
    // Limpiar archivos temporales
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
      }
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}

// GET: Obtener un permiso específico
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

    const permissionId = id;

    connection = await getConnection();

    const [rows] = await connection.execute<any[]>(
      `SELECT 
        p.PermissionID,
        p.EmployeeID,
        p.ApplicationDate,
        p.DepartureTime,
        p.CheckInTime,
        p.DaysOfLeave,
        p.PermitDate,
        p.PermitEndDate,
        p.Reason,
        p.AutorizationType,
        p.Observations,
        p.TypeOfPermission,
        p.DocumentURL,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName
      FROM employeepermission p
      LEFT JOIN basepersonnel bp ON p.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON p.EmployeeID = pp.EmployeeID
      WHERE p.PermissionID = ?`,
      [permissionId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Permiso no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      record: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener permiso:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER PERMISO',
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

// PUT: Actualizar permiso existente
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

    const permissionId = parseInt(id);
    const body = await request.json();
    const { 
      EmployeeID,
      DepartureTime,
      CheckInTime,
      DaysOfLeave,
      PermitDate,
      PermitEndDate,
      Reason,
      AutorizationType,
      Observations,
      TypeOfPermission
    } = body;

    // Validaciones básicas
    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'El ID del empleado es requerido' },
        { status: 400 }
      );
    }

    if (TypeOfPermission && !['IMPREVISTO', 'PROGRAMADO'].includes(TypeOfPermission)) {
      return NextResponse.json(
        { success: false, message: 'El tipo de permiso debe ser IMPREVISTO o PROGRAMADO' },
        { status: 400 }
      );
    }

    // Validar días de permiso (máximo 5)
    if (DaysOfLeave) {
      const daysNum = parseInt(DaysOfLeave);
      if (isNaN(daysNum) || daysNum <= 0 || daysNum > 5) {
        return NextResponse.json(
          { success: false, message: 'Los días de permiso deben ser entre 1 y 5' },
          { status: 400 }
        );
      }
    }

    // Validar rango de fechas si hay más de 1 día
    if (DaysOfLeave && parseInt(DaysOfLeave) > 1) {
      if (!PermitDate || !PermitEndDate) {
        return NextResponse.json(
          { success: false, message: 'Para permisos de más de 1 día, debe especificar fecha de inicio y fin' },
          { status: 400 }
        );
      }

      const startDate = new Date(PermitDate);
      const endDate = new Date(PermitEndDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return NextResponse.json(
          { success: false, message: 'Formato de fecha inválido' },
          { status: 400 }
        );
      }

      if (endDate < startDate) {
        return NextResponse.json(
          { success: false, message: 'La fecha de fin no puede ser anterior a la fecha de inicio' },
          { status: 400 }
        );
      }

      // Calcular la diferencia de días
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (diffDays !== parseInt(DaysOfLeave)) {
        return NextResponse.json(
          { success: false, message: 'El número de días no coincide con el rango de fechas seleccionado' },
          { status: 400 }
        );
      }
    }

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el registro existe y obtener el DocumentURL actual
      const [permissionCheck] = await connection.execute<any[]>(
        'SELECT PermissionID, DocumentURL FROM employeepermission WHERE PermissionID = ?',
        [permissionId]
      );

      if (permissionCheck.length === 0) {
        throw new Error('El permiso no existe');
      }

      const currentPermission = permissionCheck[0];
      const oldFileUrl = currentPermission.DocumentURL;

      // Verificar que el empleado existe
      const [baseCheck] = await connection.execute(
        'SELECT EmployeeID FROM basepersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      const [projectCheck] = await connection.execute(
        'SELECT EmployeeID FROM projectpersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      if ((baseCheck as any[]).length === 0 && (projectCheck as any[]).length === 0) {
        throw new Error('El empleado no existe');
      }

      // Formatear fechas
      const permitDateFormatted = formatearFechaMySQL(PermitDate);
      const permitEndDateFormatted = PermitEndDate ? formatearFechaMySQL(PermitEndDate) : null;

      // PRIMERO: Actualizar registro de permiso
      await connection.execute(
        `UPDATE employeepermission 
         SET EmployeeID = ?, ApplicationDate = NOW(), DepartureTime = ?, 
             CheckInTime = ?, DaysOfLeave = ?, PermitDate = ?, PermitEndDate = ?,
             Reason = ?, AutorizationType = ?, Observations = ?, TypeOfPermission = ?, DocumentURL = ?
         WHERE PermissionID = ?`,
        [
          EmployeeID,
          DepartureTime || null,
          CheckInTime || null,
          DaysOfLeave || null,
          permitDateFormatted,
          permitEndDateFormatted,
          Reason || null,
          AutorizationType || null,
          Observations || null,
          TypeOfPermission || null,
          null, // Temporalmente null
          permissionId
        ]
      );

      // SEGUNDO: Confirmar la transacción para que los cambios estén disponibles
      await connection.commit();

      // TERCERO: Generar nuevo PDF con los datos actualizados
      let newFileUrl: string | null = null;
      let pdfGenerationSuccess = false;

      try {
        // Generar el PDF actualizado
        const pdfBuffer = await generateUpdatedPermissionPDF(permissionId);

        // Subir a UploadThing
        const tipoEmpleado = (baseCheck as any[]).length > 0 ? 'BASE' : 'PROJECT';
        const fileName = `FT-RH-09-${tipoEmpleado}-${EmployeeID}-${Date.now()}.pdf`;
        const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
        
        const uploadResponse = await utapi.uploadFiles([file]);
        
        if (uploadResponse && uploadResponse[0] && uploadResponse[0].data && uploadResponse[0].data.url) {
          newFileUrl = uploadResponse[0].data.url;
          pdfGenerationSuccess = true;
          
          // CUARTO: Actualizar el campo DocumentURL con la nueva URL (usando nueva conexión)
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE employeepermission SET DocumentURL = ? WHERE PermissionID = ?`,
              [newFileUrl, permissionId]
            );
            console.log(`PDF actualizado subido a UploadThing: ${newFileUrl}`);
            
            // Eliminar el archivo anterior si existe y la generación fue exitosa
            if (oldFileUrl && pdfGenerationSuccess) {
              await deleteFileFromUploadThing(oldFileUrl);
            }
          } finally {
            await updateConnection.release();
          }
        } else {
          throw new Error('Error al subir el PDF a UploadThing');
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF durante actualización:', pdfError);
        // Si falla la generación del PDF, mantenemos el archivo anterior
        newFileUrl = oldFileUrl;
        
        // Restaurar el archivo anterior en la base de datos
        if (oldFileUrl) {
          const restoreConnection = await getConnection();
          try {
            await restoreConnection.execute(
              `UPDATE employeepermission SET DocumentURL = ? WHERE PermissionID = ?`,
              [oldFileUrl, permissionId]
            );
          } finally {
            await restoreConnection.release();
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: pdfGenerationSuccess ? 'Permiso actualizado exitosamente con nuevo documento' : 'Permiso actualizado exitosamente (sin cambios en el documento)',
        fileUrl: newFileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al actualizar permiso:', error);
    
    let errorMessage = 'ERROR AL ACTUALIZAR EL PERMISO';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El empleado seleccionado no existe';
      } else if (error.message.includes('date value')) {
        errorMessage = 'ERROR: Formato de fecha incorrecto';
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

// DELETE: Eliminar permiso
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

    const permissionId = id;

    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el registro existe y obtener el DocumentURL
      const [permissionCheck] = await connection.execute<any[]>(
        'SELECT PermissionID, DocumentURL FROM employeepermission WHERE PermissionID = ?',
        [permissionId]
      );

      if (permissionCheck.length === 0) {
        throw new Error('El permiso no existe');
      }

      const fileUrl = permissionCheck[0].DocumentURL;

      // Eliminar el archivo de UploadThing si existe
      if (fileUrl) {
        await deleteFileFromUploadThing(fileUrl);
      }

      // Eliminar registro
      await connection.execute(
        'DELETE FROM employeepermission WHERE PermissionID = ?',
        [permissionId]
      );

      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'Permiso eliminado exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al eliminar permiso:', error);
    
    let errorMessage = 'ERROR AL ELIMINAR EL PERMISO';
    
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