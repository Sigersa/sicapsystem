import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket } from "mysql2";

interface ProjectRow extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
  ProjectAddress: string;
  ClientName: string;
}

interface ConsumableClientRow extends RowDataPacket {
  ConsumableClientID: number;
  ProjectID: number;
  Date: string | null;
  Concept: string | null;
  MethodID: number | null;
  MethodName: string | null;
  Total: string | number | null;
  Observations: string | null;
  Archivos: string | null;
  Status: number | null;
  ApprovedBy: number | null;
  VoucherType: string | null;
  Establisment: string | null;
}

// Función auxiliar para formatear fecha DD/MM/YYYY
const formatDateForCell = (dateString: string): string => {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // NUEVO: Obtener parámetros de rango de fechas
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del proyecto" },
        { status: 400 }
      );
    }

    // Validar que ambas fechas estén presentes o ninguna
    if ((startDate && !endDate) || (!startDate && endDate)) {
      return NextResponse.json(
        { success: false, message: "Debe proporcionar ambas fechas (startDate y endDate) o ninguna" },
        { status: 400 }
      );
    }

    // Validar formato de fechas
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !dateRegex.test(startDate)) {
      return NextResponse.json(
        { success: false, message: "Formato de fecha inicial inválido. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (endDate && !dateRegex.test(endDate)) {
      return NextResponse.json(
        { success: false, message: "Formato de fecha final inválido. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Validar que la fecha inicial no sea mayor que la final
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { success: false, message: "La fecha inicial no puede ser mayor que la fecha final" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener datos del proyecto
    const [projectRows] = await connection.execute<ProjectRow[]>(
      `SELECT 
        p.ProjectID, 
        p.NameProject, 
        p.ProjectAddress, 
        c.ClientName
      FROM projects p 
      INNER JOIN clients c ON c.ClientID = p.ClientID
      WHERE p.ProjectID = ?`,
      [projectId]
    );

    if (!projectRows.length) {
      return NextResponse.json(
        { success: false, message: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const projectName = projectRows[0].NameProject || 'PROYECTO SIN NOMBRE';

    // NUEVO: Construir consulta con filtro de fechas opcional
    let consumableQuery = `
      SELECT 
        cc.ConsumableClientID,
        cc.ProjectID,
        cc.Date,
        cc.Concept,
        cc.MethodID,
        pm.MethodName,
        cc.Total,
        cc.Observations,
        cc.Archivos,
        cc.Status,
        cc.ApprovedBy,
        cc.VoucherType,
        cc.Establisment
      FROM consumableclient cc
      LEFT JOIN paymentmethods pm ON pm.MethodID = cc.MethodID
      WHERE cc.ProjectID = ?`;

    const queryParams: any[] = [projectId];

    // NUEVO: Agregar filtro de fechas si se proporcionaron
    if (startDate && endDate) {
      consumableQuery += ` AND cc.Date >= ? AND cc.Date <= ?`;
      queryParams.push(startDate, endDate);
    }

    consumableQuery += ` ORDER BY cc.ConsumableClientID ASC`;

    const [consumableRows] = await connection.execute<ConsumableClientRow[]>(
      consumableQuery,
      queryParams
    );

    // NUEVO: Si se filtró por fechas y no hay resultados, devolver error
    if (consumableRows.length === 0 && startDate && endDate) {
      return NextResponse.json(
        {
          success: false,
          message: `No se encontraron registros de consumibles en el rango de fechas seleccionado (${formatDateForCell(startDate)} a ${formatDateForCell(endDate)})`
        },
        { status: 404 }
      );
    }

    // Ruta de la plantilla CONSUMIBLES
    const templatePath = path.join(
      process.cwd(),
      "public",
      "project-manager-dashboard",
      "CONSUMIBLES.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      console.error(`Plantilla no encontrada en: ${templatePath}`);
      return NextResponse.json(
        { success: false, message: 'Plantilla CONSUMIBLES no encontrada' },
        { status: 500 }
      );
    }

    // Cargar la plantilla
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    ws.getCell("A2").value = `CONSUMIBLES EN SITIO ${projectName}`;
    ws.getCell("F2").value = `ACUMULADO CONSUMIBLES (${projectName})`;

    // NUEVO: Escribir el rango de fechas en alguna celda (opcional)
    if (startDate && endDate) {
      // Puedes ajustar la celda según la plantilla
      // ws.getCell("A4").value = `PERIODO: ${formatDateForCell(startDate)} AL ${formatDateForCell(endDate)}`;
    }

    // ============================================================
    // Escribir el número consecutivo en las celdas A3, A4, A5...
    // ============================================================
    const startRow = 6;
    consumableRows.forEach((transfer, index) => {
      const currentRow = startRow + index;
      ws.getCell(`A${currentRow}`).value = index + 1;
      ws.getCell(`B${currentRow}`).value = transfer.VoucherType || 'NO DISPONIBLE';
      ws.getCell(`C${currentRow}`).value = transfer.Establisment || 'NO DISPONIBLE';
      ws.getCell(`D${currentRow}`).value = Number(transfer.Total ?? 0);

      ws.getRow(currentRow).height = ws.getRow(6).height;
      ['A', 'B', 'C', 'D'].forEach((col) => {
        ws.getCell(`${col}${currentRow}`).style = { ...ws.getCell(`${col}6`).style };
      });
    });

    const subtotalRow = startRow + consumableRows.length + 1;
    const grandTotal = consumableRows.reduce(
      (sum, transfer) => sum + Number(transfer.Total ?? 0),
      0
    );

    const tenPercentValue = grandTotal * 0.10;
    const tenPercentRow = subtotalRow + 1;

    const lastDataRow = startRow + consumableRows.length - 1;
    const totalfinal = tenPercentValue + grandTotal;
    const totalfinalRow = tenPercentRow + 1;

    ws.getCell(`C${subtotalRow}`).value = "SUBTOTAL";
    ws.getCell(`D${subtotalRow}`).value = grandTotal;
    ws.getCell(`C${tenPercentRow}`).value = "10% ADMINISTRATIVO"
    ws.getCell(`D${tenPercentRow}`).value = tenPercentValue;
    ws.getCell(`C${totalfinalRow}`).value = "TOTAL";
    ws.getCell(`D${totalfinalRow}`).value = totalfinal;
    ws.getCell(`J6`).value = totalfinal;
    ws.getCell(`J7`).value = totalfinal;

    ['C', 'D'].forEach((col) => {
      const sourceCell = consumableRows.length > 0
        ? ws.getCell(`${col}${lastDataRow}`)
        : ws.getCell(`${col}22`);

      const totalCell = ws.getCell(`${col}${subtotalRow}`);
      totalCell.font = { ...sourceCell.font };
      totalCell.border = { ...sourceCell.border };
      totalCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) {
        totalCell.numFmt = sourceCell.numFmt;
      }

      const diez = ws.getCell(`${col}${tenPercentRow}`);
      diez.font = { ...sourceCell.font };
      diez.border = { ...sourceCell.border };
      diez.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) {
        diez.numFmt = sourceCell.numFmt;
      }

      const totalfinal = ws.getCell(`${col}${totalfinalRow}`);
      totalfinal.font = { ...sourceCell.font };
      totalfinal.border = { ...sourceCell.border };
      totalfinal.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) {
        totalfinal.numFmt = sourceCell.numFmt;
      }
    });

    ws.getCell(`D${subtotalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };

    ws.getCell(`D${tenPercentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };

    ws.getCell(`D${totalfinalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC6E0B4' },
    };

    // ============================================================
    // FORZAR QUE EL LIBRO SE ABRA EN LA PRIMERA HOJA
    // ============================================================
    workbook.views = [
      {
        x: 0,
        y: 0,
        width: 20000,
        height: 12000,
        firstSheet: 0,
        activeTab: 0,
        visibility: 'visible',
      } as any,
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    const safeProjectName = projectName
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);

    // NUEVO: Incluir el rango de fechas en el nombre del archivo si se filtró
    let fileName = `CONSUMIBLES-${safeProjectName}`;
    if (startDate && endDate) {
      fileName += `_${startDate}_a_${endDate}`;
    }
    fileName += '.xlsx';

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Error al generar CONSUMIBLES:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.sqlMessage || error.message || "Error al generar el documento",
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error("Error al cerrar la conexión:", error);
      }
    }
  }
}