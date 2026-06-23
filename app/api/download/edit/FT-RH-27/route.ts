// app/api/download/edit/FT-RH-27/route.ts
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
    const batchId = searchParams.get("batchId");

    if (!batchId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID de la incidencia" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener información de la incidencia y del empleado
    const [batchRows] = await connection.execute<any[]>(
     `SELECT 
                eib.BatchID,
                eib.BatchDate,
                eib.EmployeeID,
                COALESCE(bp.FirstName, pp.FirstName) as FirstName,
                COALESCE(bp.LastName, pp.LastName) as LastName,
                COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
                COALESCE(bp.Position, pc.Position) as Position,
                COALESCE(bc.StartDate, pj.StartDate) as StartDate,
                bp.Area,
                pj.NameProject,
                CASE 
                    WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
                    ELSE 'PROJECT'
                END as tipo
            FROM employee_incidence_batches eib
            LEFT JOIN basepersonnel bp ON eib.EmployeeID = bp.EmployeeID
            LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
            LEFT JOIN projectpersonnel pp ON eib.EmployeeID = pp.EmployeeID
            LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
            LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
            WHERE eib.BatchID = ?`,
            [batchId]
    );

     if (!batchRows || batchRows.length === 0) {
            throw new Error(`Batch con ID ${batchId} no encontrado`);
        }


        const batch = batchRows[0];

         // Obtener todas las incidencias del lote
        const [incidenceRows] = await connection.execute<any[]>(
            `SELECT 
                IncidenceNumber,
                IncidenceDate,
                Description,
                Rule
            FROM employee_incidence_details 
            WHERE BatchID = ?
            ORDER BY IncidenceNumber`,
            [batchId]
        );

        if (incidenceRows.length === 0) {
            throw new Error('No se encontraron incidencias para este lote');
        }

    // Función para formatear fecha
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

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "administrative-personnel-dashboard",
      "personnel-management",
      "FT-RH-27.xlsx"
    );
    
   if (!fs.existsSync(templatePath)) {
               throw new Error('Plantilla FT-RH-27 no encontrada en: ' + templatePath);
           }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    const employeeName = [
      batch.FirstName || '',
      batch.MiddleName || '',
      batch.LastName || ''
    ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

       ws.getCell('A6').value = batch.LastName || 'NO ESPECIFICADO';
        ws.getCell('E6').value = batch.MiddleName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = batch.FirstName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = batch.FirstName || 'NO ESPECIFICADO';
        ws.getCell('A9').value = formatDate(batch.StartDate);
        ws.getCell('C9').value = batch.Position || 'NO ESPECIFICADO';
        ws.getCell('G9').value = batch.NameProject || 'N/A';
        ws.getCell('I9').value = batch.Area || 'N/A';
        ws.getCell('E20').value = employeeName || 'NO ESPECIFICADO';

        // Llenar cada incidencia en filas consecutivas (12, 13, 14, 15)
        incidenceRows.forEach((inc, index) => {
            const rowNumber = 12 + index; // Fila 12, 13, 14, 15
            ws.getCell(`A${rowNumber}`).value = inc.IncidenceNumber || 'NO ESPECIFICADO';
            ws.getCell(`B${rowNumber}`).value = formatDate(inc.IncidenceDate);
            ws.getCell(`D${rowNumber}`).value = inc.Description || 'NO ESPECIFICADO';
            ws.getCell(`H${rowNumber}`).value = inc.Rule || 'NO ESPECIFICADO';
        });
        
       const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `FT-RH-27.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar FT-RH-05 editable:", error);
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