// app/api/administrative-personnel-dashboard/employee-management/employeepermissions/route.ts
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

// Función para generar el PDF FT-RH-09
async function generatePermissionPDF(
  permissionId: number
): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-09-${Date.now()}-${permissionId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-09-${Date.now()}-${permissionId}.pdf`
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

    // Subir a UploadThing
    const tipoEmpleado = perm.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-09-${tipoEmpleado}-${perm.EmployeeID}-${Date.now()}.pdf`;
    
    const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0] || !uploadResponse[0].data || !uploadResponse[0].data.url) {
      throw new Error('Error al subir el PDF a UploadThing');
    }
    
    const fileUrl = uploadResponse[0].data.url;

    return { pdfBuffer, fileUrl };

  } catch (error) {
    console.error('Error al generar PDF FT-RH-09:', error);
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

// GET: Obtener todos los permisos de empleados
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
        e.Status,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeepermission p
      INNER JOIN employees e ON e.EmployeeID = p.EmployeeID
      LEFT JOIN basepersonnel bp ON p.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON p.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      WHERE e.Status = 1
      ORDER BY p.ApplicationDate DESC, p.PermissionID DESC
    `);

    const permissionRecords = rows as any[];

    return NextResponse.json({
      success: true,
      records: permissionRecords
    });

  } catch (error) {
    console.error('Error al obtener permisos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER PERMISOS',
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

// POST: Crear nuevo permiso
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

    if (!TypeOfPermission || !['IMPREVISTO', 'PROGRAMADO'].includes(TypeOfPermission)) {
      return NextResponse.json(
        { success: false, message: 'El tipo de permiso es requerido y debe ser IMPREVISTO o PROGRAMADO' },
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

      // Insertar registro de permiso (sin DocumentURL por ahora)
      const [result] = await connection.execute(
        `INSERT INTO employeepermission 
         (EmployeeID, ApplicationDate, DepartureTime, CheckInTime, DaysOfLeave, PermitDate, PermitEndDate, Reason, AutorizationType, Observations, TypeOfPermission) 
         VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          TypeOfPermission
        ]
      );

      const permissionId = (result as any).insertId;

      // CONFIRMAR LA TRANSACCIÓN PRIMERO
      await connection.commit();

      // AHORA generar el PDF con una nueva conexión (los datos ya están en la BD)
      let fileUrl = null;

      try {
        // Pequeña pausa para asegurar que la base de datos tenga el registro
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { fileUrl: pdfUrl } = await generatePermissionPDF(permissionId);
        fileUrl = pdfUrl;
        
        // Actualizar el campo DocumentURL en la base de datos (usando nueva conexión)
        const updateConnection = await getConnection();
        try {
          await updateConnection.execute(
            `UPDATE employeepermission SET DocumentURL = ? WHERE PermissionID = ?`,
            [pdfUrl, permissionId]
          );
          console.log(`PDF subido a UploadThing y URL actualizada: ${pdfUrl}`);
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
        // No revertimos la transacción principal, solo registramos el error
      }

      return NextResponse.json({
        success: true,
        message: fileUrl ? 'Permiso creado exitosamente' : 'Permiso creado exitosamente (sin PDF)',
        permissionId: permissionId,
        fileUrl: fileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear permiso:', error);
    
    let errorMessage = 'ERROR AL CREAR EL PERMISO';
    
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