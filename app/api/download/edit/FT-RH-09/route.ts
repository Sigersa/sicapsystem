// app/api/download/edit/FT-RH-09/route.ts

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import fs from "fs";

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

    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get("permissionId");

    if (!permissionId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del permiso" },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { success: false, message: 'Permiso no encontrado' },
        { status: 404 }
      );
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
      return NextResponse.json(
        { success: false, message: 'Plantilla FT-RH-09 no encontrada' },
        { status: 500 }
      );
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

    const buffer = await workbook.xlsx.writeBuffer();

    const tipoEmpleado = perm.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-09-${tipoEmpleado}-${perm.EmployeeID}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar FT-RH-09 editable:", error);
    return NextResponse.json(
      { 
        success: false,
        message: error.sqlMessage || error.message || "Error al generar el documento" 
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