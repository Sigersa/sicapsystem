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
        { success: false, message: "Se requiere el ID de la incidencia" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener información de la incidencia y del empleado
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
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.StartDate, pc.StartDate) as StartDatee,
        COALESCE(bpi.CURP, ppi.CURP) as CURP,
        COALESCE(bpi.RFC, ppi.RFC) as RFC,
        COALESCE(bpi.NSS, ppi.NSS) as NSS,
        -- Jefe directo
        COALESCE(jefe_bp.FirstName, jefe_pp.FirstName) as JefeFirstName,
        COALESCE(jefe_bp.LastName, jefe_pp.LastName) as JefeLastName,
        COALESCE(jefe_bp.MiddleName, jefe_pp.MiddleName) as JefeMiddleName,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeemovement em
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      -- Jefe directo (BASE)
      LEFT JOIN basepersonnel jefe_bp ON bc.jefeDirectoId = jefe_bp.EmployeeID
      -- Jefe directo (PROJECT)
      LEFT JOIN projectpersonnel jefe_pp ON pc.jefeDirectoId = jefe_pp.EmployeeID
      WHERE em.MovementID = ?`,
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
    ].filter(part => part.trim() !== '').join(' ') || "NO ESPECIFICADO";

    const formatDate = (dateValue: any): string => {
      if (!dateValue) return 'NO ESPECIFICADO';
      
      try {
        const date = new Date(dateValue);
        // Verificar si es una fecha válida
        if (isNaN(date.getTime())) {
          return 'NO ESPECIFICADO';
        }
        // Usar el mismo formato que en FT-RH-21: toLocaleDateString('es-MX')
        return date.toLocaleDateString('es-MX');
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'NO ESPECIFICADO';
      }
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

        ws.getCell('A6').value = mov.EmployeeID || 'NO ESPECIFICADO';
        ws.getCell('C6').value = mov.LastName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = mov.MiddleName || 'NO ESPECIFICADO';
        ws.getCell('N6').value = mov.FirstName || 'NO ESPECIFICADO';
        ws.getCell('A9').value = mov.Position || 'NO ESPECIFICADO';
        ws.getCell('G9').value = mov.Area || 'N/A';
        ws.getCell('N9').value = mov.NameProject || 'N/A';
        ws.getCell('A12').value = mov.CURP || 'NO ESPECIFICADO';
        ws.getCell('F12').value = mov.RFC || 'NO ESPECIFICADO';
        ws.getCell('L12').value = mov.NSS || 'NO ESPECIFICADO'
        ws.getCell('P12').value = formatDate(mov.StartDatee) || 'NO ESPECIFICADO';
        if (mov.MovementType){
          const tipomovimiento = mov.MovementType.toUpperCase().trim();
          if (tipomovimiento === "PUESTO")  {
            ws.getCell("C16").value = mov.Specification;
            ws.getCell("G16").value = formatDate(mov.ApplicationDate);
            ws.getCell("I16").value = mov.Duration;
            ws.getCell("K16").value = mov.Former;
            ws.getCell("N16").value = mov.New;
            ws.getCell("P16").value = formatDate(mov.StartDate);
            ws.getCell("R16").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "SUELDO"){
            ws.getCell("C18").value = mov.Specification;
            ws.getCell("G18").value = formatDate(mov.ApplicationDate);
            ws.getCell("I18").value = mov.Duration;
            ws.getCell("K18").value = mov.Former;
            ws.getCell("N18").value = mov.New;
            ws.getCell("P18").value = formatDate(mov.StartDate);
            ws.getCell("R18").value = formatDate(mov.EndDate);
          } 
          else if (tipomovimiento === "PROYECTO/AREA")  {
            ws.getCell("C20").value = mov.Specification;
            ws.getCell("G20").value = formatDate(mov.ApplicationDate);
            ws.getCell("I20").value = mov.Duration; 
            ws.getCell("K20").value = mov.Former;
            ws.getCell("N20").value = mov.New;
            ws.getCell("P20").value = formatDate(mov.StartDate);
            ws.getCell("R20").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "VACACIONES") {
            ws.getCell("C22").value = mov.Specification;
            ws.getCell("G22").value = formatDate(mov.ApplicationDate);
            ws.getCell("I22").value = mov.Duration;
            ws.getCell("K22").value = mov.Former;
            ws.getCell("N22").value = mov.New;
            ws.getCell("P22").value = formatDate(mov.StartDate);
            ws.getCell("R22").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "COMISION") {
            ws.getCell("C24").value = mov.Specification;
            ws.getCell("G24").value = formatDate(mov.ApplicationDate);
            ws.getCell("I24").value = mov.Duration;
            ws.getCell("K24").value = mov.Former;
            ws.getCell("N24").value = mov.New;  
            ws.getCell("P24").value = formatDate(mov.StartDate);
            ws.getCell("R24").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "OTROS") {
            ws.getCell("C26").value = mov.Specification;
            ws.getCell("G26").value = formatDate(mov.ApplicationDate);
            ws.getCell("I26").value = mov.Duration;
            ws.getCell("K26").value = mov.Former;
            ws.getCell("N26").value = mov.New;
            ws.getCell("P26").value = formatDate(mov.StartDate);
            ws.getCell("R26").value = formatDate(mov.EndDate);
          }
          
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