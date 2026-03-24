// app/api/download/pdf/FT-RH-05/route.ts

import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";
import ConvertAPI from "convertapi";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("permissionId");
  const isPreview = searchParams.get("preview") === "1";

  if (!batchId) {
    return NextResponse.json(
      { error: "Se requiere el ID del permiso" },
      { status: 400 }
    );
  }

  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-05-${Date.now()}-${batchId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-05-${Date.now()}-${batchId}.pdf`
  );

  let connection;

  try {
    // Validar sesión
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

    // Obtener información del permiso y del empleado
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        emb.BatchID,
        emb.MovementType,
        emb.DateMovement,
        emb.ReasonForWithdrawal,
        em.MovementID,
        em.BatchID,
        em.EmployeeID,
        em.ProjectContractID,
        bp.Area,
        pj.NameProject,
        pj.AdminProjectID,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.SalaryIMSS, pc.SalaryIMSS) as SalaryIMSS,
        COALESCE(bpi.CURP, ppi.CURP) as CURP,
        COALESCE(bpi.NSS, ppi.NSS) as NSS,
        COALESCE(bpi.NCI, ppi.NCI) as NCI,
        COALESCE(bpi.UMF, ppi.UMF) as UMF,    
        COALESCE(admin_bp.FirstName) as AdminNombre,
        COALESCE(admin_bp.LastName) as AdminApellido,
        COALESCE(admin_bp.MiddleName) as AdminApellido2,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROYECTO'
        END as tipo
      FROM employee_movement_batches emb
      INNER JOIN employeeimssinfonavitmovements em ON em.BatchID = emb.BatchID 
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      LEFT JOIN employees e ON e.EmployeeID = pj.AdminProjectID
      LEFT JOIN basepersonnel admin_bp ON admin_bp.EmployeeID = e.EmployeeID
      WHERE em.BatchID = ?
      ORDER BY em.MovementID`,
      [batchId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Solicitud no encontrado' },
        { status: 404 }
      );
    }

    if (rows.length > 10) {
        return NextResponse.json(
            { success: false, message: 'El lote contiene más de 10 movimientos' },
            { status: 400 }
        );
        }

    const firstMov = rows[0];

    const adminName = [
          firstMov.AdminNombre || '',
          firstMov.AdminApellido || '',
          firstMov.AdminApellido2 || ''
        ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';
    
         const formatDate = (dateValue: any): string => {
              if (!dateValue) return 'NO ESPECIFICADO';
              
              try {
                const date = new Date(dateValue);
                // Verificar si es una fecha válida
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
                  "FT-RH-05.xlsx"
                );
    
            if (!fs.existsSync(templatePath)) {
              return NextResponse.json(
                { success: false, message: 'Plantilla FT-RH-05 no encontrada' },
                { status: 500 }
              );
            }
        
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(templatePath);
            const ws = workbook.getWorksheet(1)!;

    ws.getCell('D5').value = firstMov.NameProject || 'NO ESPECIFICADO';
       ws.getCell('D7').value = adminName || 'NO ESPECIFICADO';

      rows.forEach((mov, index) => {

      const rowNumber = 10 + index; 
      
      const employeeName = [
        mov.FirstName || '',
        mov.LastName || '',
        mov.MiddleName || ''
      ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

       ws.getCell(`A${rowNumber}`).value = employeeName || 'NO ESPECIFICADO';
       ws.getCell(`C${rowNumber}`).value = mov.Position || 'NO ESPECIFICADO';
       ws.getCell(`E${rowNumber}`).value = mov.NSS || 'NO ESPECIFICADO';
       ws.getCell(`F${rowNumber}`).value = mov.SalaryIMSS || 'NO ESPECIFICADO';
       ws.getCell(`G${rowNumber}`).value = mov.CURP || 'NO ESPECIFICADO';
       ws.getCell(`H${rowNumber}`).value = mov.MovementType || 'NO ESPECIFICADO';
       ws.getCell(`I${rowNumber}`).value = formatDate(mov.DateMovement) || 'NO ESPECIFICADO';
       ws.getCell(`J${rowNumber}`).value = mov.NCI || 'NO ESPECIFICADO';
       ws.getCell(`K${rowNumber}`).value = mov.UMF || 'NO ESPECIFICADO';
       ws.getCell(`L${rowNumber}`).value = mov.tipo || 'NO ESPECIFICADO';
       ws.getCell(`M${rowNumber}`).value = mov.ReasonForWithdrawal|| 'N/A';          
      });

    // Guardar Excel temporal
    await workbook.xlsx.writeFile(tempExcelPath);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    const fileName = `FT-RH-05-${batchId}.xlsx`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? `inline; filename="${fileName}"`
          : `attachment; filename="${fileName}"`,
      },
    });

  } catch (error: any) {
    console.error("Error al generar FT-RH-05 PDF:", error);
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