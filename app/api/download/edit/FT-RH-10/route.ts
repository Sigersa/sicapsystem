// app/api/download/edit/FT-RH-10/route.ts

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
    const movementId = searchParams.get("movementId");

    if (!movementId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del movimiento" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener información del movimiento y del empleado
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        em.MovementID,
        em.EmployeeID,
        em.MovementType,
        em.Specification,
        em.ApplicationDate,
        em.Duration,
        em.Former,
        em.New,
        em.StartDate,
        em.EndDate,
        em.Observations,
        bp.Area,
        pj.NameProject,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.StartDate, pj.StartDate) as StartDatee,
        COALESCE(bppi.CURP, pppi.CURP) as CURP,
        COALESCE(bppi.RFC, pppi.RFC) as RFC,
        COALESCE(bppi.NSS, pppi.NSS) as NSS,
        bc.JefeDirectoID,
        pj.AdminProjectID,
        COALESCE(bpp.FirstName, ppp.FirstName) as JefeFirstName,
        COALESCE(bpp.LastName, ppp.LastName) as JefeLastName,
        COALESCE(bpp.MiddleName, ppp.MiddleName) as JefeMiddleName,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeemovement em
      LEFT JOIN basepersonnel bp ON bp.EmployeeID = em.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bppi ON bppi.BasePersonnelID = bp.BasePersonnelID
      LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
      LEFT JOIN projectpersonnel pp ON pp.EmployeeID = em.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo pppi ON pppi.ProjectPersonnelID = pp.ProjectPersonnelID
      LEFT JOIN projects pj ON pj.ProjectID = pc.ProjectID
      LEFT JOIN employees e ON e.EmployeeID = pj.AdminProjectID
      LEFT JOIN employees ee ON ee.EmployeeID = bc.JefeDirectoID
      LEFT JOIN basepersonnel bpp ON bpp.EmployeeID = ee.EmployeeID
      LEFT JOIN basepersonnel ppp ON ppp.EmployeeID = e.EmployeeID
      WHERE em.MovementID = ? AND (
        bp.EmployeeID IS NOT NULL
        OR pc.Status = 1)`,
      [movementId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Movimiento no encontrado' },
        { status: 404 }
      );
    }

    const mov = rows[0];

    const employeeName = [
      mov.FirstName || '',
      mov.LastName || '',
      mov.MiddleName || ''
    ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

    // Construir nombre completo del jefe directo
    const jefeDirectoNombre = [
      mov.JefeFirstName || '',
      mov.JefeLastName || '',
      mov.JefeMiddleName || ''
    ].filter(part => part && part.trim() !== '').join(' ') || "NO ESPECIFICADO";

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

    // Función para determinar el valor de la fecha de fin
    const getEndDateValue = (duration: string | null, endDate: any): string => {
      // Si la duración es INDETERMINADO, mostrar N/A
      if (duration && duration.toUpperCase() === 'INDETERMINADO') {
        return 'N/A';
      }
      // Si hay fecha de fin, formatearla
      if (endDate) {
        return formatDate(endDate);
      }
      // Si no hay fecha de fin y no es indeterminado, mostrar NO ESPECIFICADO
      return 'NO ESPECIFICADO';
    };

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-10.xlsx"
    );
    
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { success: false, message: 'Plantilla FT-RH-10 no encontrada' },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Datos del empleado
    ws.getCell('A6').value = mov.EmployeeID || 'NO ESPECIFICADO';
    ws.getCell('C6').value = mov.LastName || 'NO ESPECIFICADO';
    ws.getCell('H6').value = mov.MiddleName || 'NO ESPECIFICADO';
    ws.getCell('N6').value = mov.FirstName || 'NO ESPECIFICADO';
    ws.getCell('A9').value = mov.Position || 'NO ESPECIFICADO';
    ws.getCell('G9').value = mov.Area || 'N/A';
    ws.getCell('N9').value = mov.NameProject || 'N/A';
    ws.getCell('A12').value = mov.CURP || 'NO ESPECIFICADO';
    ws.getCell('F12').value = mov.RFC || 'NO ESPECIFICADO';
    ws.getCell('L12').value = mov.NSS || 'NO ESPECIFICADO';
    ws.getCell('P12').value = formatDate(mov.StartDatee) || 'NO ESPECIFICADO';

    // Datos del movimiento según el tipo
    if (mov.MovementType) {
      const tipomovimiento = mov.MovementType.toUpperCase().trim();
      
      // Determinar la fila según el tipo de movimiento
      let row = 16;
      if (tipomovimiento === "PUESTO") row = 16;
      else if (tipomovimiento === "SUELDO") row = 18;
      else if (tipomovimiento === "PROYECTO/AREA") row = 20;
      else if (tipomovimiento === "VACACIONES") row = 22;
      else if (tipomovimiento === "COMISION") row = 24;
      else if (tipomovimiento === "OTROS") row = 26;
      
      // Determinar el valor de la fecha de fin
      const endDateValue = getEndDateValue(mov.Duration, mov.EndDate);
      
      ws.getCell(`C${row}`).value = mov.Specification || 'NO ESPECIFICADO';
      ws.getCell(`G${row}`).value = formatDate(mov.ApplicationDate);
      ws.getCell(`I${row}`).value = mov.Duration || 'NO ESPECIFICADO';
      ws.getCell(`K${row}`).value = mov.Former || 'NO ESPECIFICADO';
      ws.getCell(`N${row}`).value = mov.New || 'NO ESPECIFICADO';
      ws.getCell(`P${row}`).value = formatDate(mov.StartDate);
      ws.getCell(`R${row}`).value = endDateValue;
    }

    ws.getCell('A30').value = mov.Observations || 'NO ESPECIFICADO';
    ws.getCell('B37').value = employeeName || 'NO ESPECIFICADO';
    ws.getCell('M37').value = jefeDirectoNombre || 'NO ESPECIFICADO';

    const buffer = await workbook.xlsx.writeBuffer();
    
    const tipoEmpleado = mov.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-10-${tipoEmpleado}-${mov.EmployeeID}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar FT-RH-10 editable:", error);
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