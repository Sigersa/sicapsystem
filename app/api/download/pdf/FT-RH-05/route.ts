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
  const batchId = searchParams.get("batchId");
  const isPreview = searchParams.get("preview") === "1";

  if (!batchId) {
    return NextResponse.json(
      { error: "Se requiere el ID del lote" },
      { status: 400 }
    );
  }

  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-05-${Date.now()}-${batchId}.xlsx`
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

    // Primero, obtener los datos del batch
    const [batchRows] = await connection.execute<any[]>(
      `SELECT 
        emb.BatchID,
        emb.MovementType,
        emb.DateMovement,
        emb.ReasonForWithdrawal,
        emb.FileURL
      FROM employee_movement_batches emb
      WHERE emb.BatchID = ?`,
      [batchId]
    );

    if (!batchRows || batchRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Lote no encontrado' },
        { status: 404 }
      );
    }

    const batch = batchRows[0];

    // Obtener los empleados del lote con sus datos
    const [employeeRows] = await connection.execute<any[]>(
      `SELECT 
        em.MovementID,
        em.EmployeeID,
        em.BaseContractID,
        em.ProjectContractID,
        -- Datos del empleado (BASE)
        bp.FirstName as BaseFirstName,
        bp.LastName as BaseLastName,
        bp.MiddleName as BaseMiddleName,
        bp.Position as BasePosition,
        bp.Area as BaseArea,
        bc.SalaryIMSS as BaseSalaryIMSS,
        bpi.CURP as BaseCURP,
        bpi.NSS as BaseNSS,
        bpi.NCI as BaseNCI,
        bpi.UMF as BaseUMF,
        -- Datos del empleado (PROJECT)
        pp.FirstName as ProjectFirstName,
        pp.LastName as ProjectLastName,
        pp.MiddleName as ProjectMiddleName,
        pc.Position as ProjectPosition,
        pc.SalaryIMSS as ProjectSalaryIMSS,
        ppi.CURP as ProjectCURP,
        ppi.NSS as ProjectNSS,
        ppi.NCI as ProjectNCI,
        ppi.UMF as ProjectUMF,
        -- Datos del proyecto
        pj.NameProject,
        pj.AdminProjectID,
        -- Datos del administrador
        admin_bp.FirstName as AdminNombre,
        admin_bp.LastName as AdminApellido,
        admin_bp.MiddleName as AdminApellido2,
        -- Determinar el tipo
        CASE 
          WHEN em.BaseContractID IS NOT NULL THEN 'BASE'
          WHEN em.ProjectContractID IS NOT NULL THEN 'PROYECTO'
          ELSE 'NO ESPECIFICADO'
        END as tipo
      FROM employeeimssinfonavitmovements em
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID AND em.BaseContractID IS NOT NULL
      LEFT JOIN basecontracts bc ON em.BaseContractID = bc.ContractID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID AND em.ProjectContractID IS NOT NULL
      LEFT JOIN projectcontracts pc ON em.ProjectContractID = pc.ContractID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      -- Datos del proyecto (solo para PROJECT)
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      -- Datos del administrador del proyecto
      LEFT JOIN employees e ON e.EmployeeID = pj.AdminProjectID
      LEFT JOIN basepersonnel admin_bp ON admin_bp.EmployeeID = e.EmployeeID
      WHERE em.BatchID = ?
      ORDER BY em.MovementID`,
      [batchId]
    );

    if (!employeeRows || employeeRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No se encontraron empleados en este lote' },
        { status: 404 }
      );
    }

    if (employeeRows.length > 10) {
      return NextResponse.json(
        { success: false, message: 'El lote contiene más de 10 movimientos' },
        { status: 400 }
      );
    }

    // Obtener el nombre del proyecto y administrador del primer empleado PROJECT
    let projectName = 'NO ESPECIFICADO';
    let adminName = 'NO ESPECIFICADO';

    // Buscar un empleado PROJECT para obtener los datos del proyecto
    const projectEmployee = employeeRows.find(row => row.tipo === 'PROYECTO');
    if (projectEmployee) {
      projectName = projectEmployee.NameProject || 'NO ESPECIFICADO';
      adminName = [
        projectEmployee.AdminNombre || '',
        projectEmployee.AdminApellido || '',
        projectEmployee.AdminApellido2 || ''
      ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';
    }

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
    
    ws.getCell('D5').value = projectName;
    ws.getCell('D7').value = adminName;

    // Procesar cada empleado
    employeeRows.forEach((mov, index) => {
      const rowNumber = 10 + index;
      
      // Obtener los datos según el tipo
      let firstName, lastName, middleName, position, salaryIMSS, curp, nss, nci, umf;
      
      if (mov.tipo === 'BASE') {
        firstName = mov.BaseFirstName;
        lastName = mov.BaseLastName;
        middleName = mov.BaseMiddleName;
        position = mov.BasePosition;
        salaryIMSS = mov.BaseSalaryIMSS;
        curp = mov.BaseCURP;
        nss = mov.BaseNSS;
        nci = mov.BaseNCI;
        umf = mov.BaseUMF;
      } else if (mov.tipo === 'PROYECTO') {
        firstName = mov.ProjectFirstName;
        lastName = mov.ProjectLastName;
        middleName = mov.ProjectMiddleName;
        position = mov.ProjectPosition;
        salaryIMSS = mov.ProjectSalaryIMSS;
        curp = mov.ProjectCURP;
        nss = mov.ProjectNSS;
        nci = mov.ProjectNCI;
        umf = mov.ProjectUMF;
      } else {
        firstName = 'NO ESPECIFICADO';
        lastName = '';
        middleName = '';
        position = 'NO ESPECIFICADO';
        salaryIMSS = null;
        curp = 'NO ESPECIFICADO';
        nss = 'NO ESPECIFICADO';
        nci = 'NO ESPECIFICADO';
        umf = null;
      }

      const employeeName = [
        firstName || '',
        lastName || '',
        middleName || ''
      ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

      ws.getCell(`A${rowNumber}`).value = employeeName;
      ws.getCell(`C${rowNumber}`).value = position || 'NO ESPECIFICADO';
      ws.getCell(`E${rowNumber}`).value = nss || 'NO ESPECIFICADO';
      ws.getCell(`F${rowNumber}`).value = salaryIMSS || 'NO ESPECIFICADO';
      ws.getCell(`G${rowNumber}`).value = curp || 'NO ESPECIFICADO';
      ws.getCell(`H${rowNumber}`).value = batch.MovementType || 'NO ESPECIFICADO';
      ws.getCell(`I${rowNumber}`).value = formatDate(batch.DateMovement);
      ws.getCell(`J${rowNumber}`).value = nci || 'NO ESPECIFICADO';
      ws.getCell(`K${rowNumber}`).value = umf || 'NO ESPECIFICADO';
      ws.getCell(`L${rowNumber}`).value = mov.tipo || 'NO ESPECIFICADO';
      ws.getCell(`M${rowNumber}`).value = batch.ReasonForWithdrawal || 'N/A';
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

    const fileName = `FT-RH-05-${batchId}.pdf`;

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
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}