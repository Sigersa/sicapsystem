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

interface FuelClientRow extends RowDataPacket {
  FuelClientID: number;
  ProjectID: number;
  Date: string | null;
  Liters: number | null;
  LitersCost: number | null;
  Total: string | number | null;
  MethodID: number | null;
  MethodName: string | null;
  Observations: string | null;
  Archivos: string | null;
  Status: number | null;
  ApprovedBy: number | null;
  VoucherType: string | null;
  Establisment: string | null;
  FuelType: number | null;
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

    // Parámetros de rango de fechas
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

    // Construir consulta con filtro de fechas opcional
    let fuelQuery = `
      SELECT 
        fc.FuelClientID,
        fc.ProjectID,
        fc.Date,
        fc.Liters,
        fc.LitersCost,
        fc.Total,
        fc.MethodID,
        pm.MethodName,
        fc.Observations,
        fc.Archivos,
        fc.Status,
        fc.ApprovedBy,
        fc.VoucherType,
        fc.Establisment,
        fc.FuelType
      FROM fuelclient fc
      LEFT JOIN paymentmethods pm ON pm.MethodID = fc.MethodID
      WHERE fc.ProjectID = ?`;

    const queryParams: any[] = [projectId];

    // Agregar filtro de fechas si se proporcionaron
    if (startDate && endDate) {
      fuelQuery += ` AND fc.Date >= ? AND fc.Date <= ?`;
      queryParams.push(startDate, endDate);
    }

    fuelQuery += ` ORDER BY fc.FuelClientID ASC`;

    const [fuelRows] = await connection.execute<FuelClientRow[]>(
      fuelQuery,
      queryParams
    );

    // Si se filtró por fechas y no hay resultados, devolver error
    if (fuelRows.length === 0 && startDate && endDate) {
      return NextResponse.json(
        {
          success: false,
          message: `No se encontraron registros de combustible en el rango de fechas seleccionado (${formatDateForCell(startDate)} a ${formatDateForCell(endDate)})`
        },
        { status: 404 }
      );
    }

    // Ruta de la plantilla COMBUSTIBLE_CLIENTE
    const templatePath = path.join(
      process.cwd(),
      "public",
      "project-manager-dashboard",
      "COMBUSTIBLE_CLIENTE.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      console.error(`Plantilla no encontrada en: ${templatePath}`);
      return NextResponse.json(
        { success: false, message: 'Plantilla COMBUSTIBLE_CLIENTE no encontrada' },
        { status: 500 }
      );
    }

    // Cargar la plantilla
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // ============================================================
    // SEPARAR REGISTROS POR TIPO DE COMBUSTIBLE
    // ============================================================
    const dieselRows = fuelRows.filter((r) => Number(r.FuelType) === 1);
    const gasLpRows = fuelRows.filter((r) => Number(r.FuelType) === 2);

    // ============================================================
    // TÍTULOS DINÁMICOS (por si quieres conservarlos)
    // ============================================================
    ws.getCell("A2").value = `DIESEL (${projectName})`;
    ws.getCell("F2").value = `GAS LP (${projectName})`;
    ws.getCell("L2").value = `ACUMULADO DIESEL Y GAS LP (${projectName})`;

    if (startDate && endDate) {
      // Puedes descomentar si quieres imprimir el período
      // ws.getCell("A4").value = `PERIODO: ${formatDateForCell(startDate)} AL ${formatDateForCell(endDate)}`;
    }

    // ============================================================
    // ESCRIBIR DIESEL (FuelType === 1) → columnas A, B, C, D
    // ============================================================
    const startRow = 6;

    dieselRows.forEach((fuel, index) => {
      const currentRow = startRow + index;
      ws.getCell(`A${currentRow}`).value = index + 1;                                 // ITEM
      ws.getCell(`B${currentRow}`).value = fuel.VoucherType || 'NO DISPONIBLE';       // COMPROBANTE
      ws.getCell(`C${currentRow}`).value = fuel.Establisment || 'NO DISPONIBLE';      // ESTABLECIMIENTO
      ws.getCell(`D${currentRow}`).value = Number(fuel.Total ?? 0);                   // TOTAL

      // Copiar estilo de la fila 6 (fila de plantilla)
      ws.getRow(currentRow).height = ws.getRow(6).height;
      ['A', 'B', 'C', 'D'].forEach((col) => {
        ws.getCell(`${col}${currentRow}`).style = { ...ws.getCell(`${col}6`).style };
      });
    });

    // Calcular subtotal/total de DIESEL
    const dieselSubtotalRow = startRow + dieselRows.length + 1;
    const dieselGrandTotal = dieselRows.reduce(
      (sum, fuel) => sum + Number(fuel.Total ?? 0),
      0
    );

    const dieselTenPercentValue = dieselGrandTotal * 0.10;
    const dieselTenPercentRow = dieselSubtotalRow + 1;
    const dieselTotalFinal = dieselTenPercentValue + dieselGrandTotal;
    const dieselTotalFinalRow = dieselTenPercentRow + 1;

    ws.getCell(`C${dieselSubtotalRow}`).value = "SUBTOTAL";
    ws.getCell(`D${dieselSubtotalRow}`).value = dieselGrandTotal;
    ws.getCell(`C${dieselTenPercentRow}`).value = "10% ADMINISTRATIVO";
    ws.getCell(`D${dieselTenPercentRow}`).value = dieselTenPercentValue;
    ws.getCell(`C${dieselTotalFinalRow}`).value = "TOTAL";
    ws.getCell(`D${dieselTotalFinalRow}`).value = dieselTotalFinal;
    ws.getCell("P6").value = dieselTotalFinal;
    // Aplicar estilos a los totales de DIESEL
    const lastDieselDataRow = dieselRows.length > 0
      ? startRow + dieselRows.length - 1
      : 6;

    ['C', 'D'].forEach((col) => {
      const sourceCell = ws.getCell(`${col}${lastDieselDataRow}`);

      const subtotalCell = ws.getCell(`${col}${dieselSubtotalRow}`);
      subtotalCell.font = { ...sourceCell.font };
      subtotalCell.border = { ...sourceCell.border };
      subtotalCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) subtotalCell.numFmt = sourceCell.numFmt;

      const diezCell = ws.getCell(`${col}${dieselTenPercentRow}`);
      diezCell.font = { ...sourceCell.font };
      diezCell.border = { ...sourceCell.border };
      diezCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) diezCell.numFmt = sourceCell.numFmt;

      const totalCell = ws.getCell(`${col}${dieselTotalFinalRow}`);
      totalCell.font = { ...sourceCell.font };
      totalCell.border = { ...sourceCell.border };
      totalCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) totalCell.numFmt = sourceCell.numFmt;
    });

    ws.getCell(`D${dieselSubtotalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };

    ws.getCell(`D${dieselTenPercentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };

    ws.getCell(`D${dieselTotalFinalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC6E0B4' },
    };

    // ============================================================
    // ESCRIBIR GAS LP (FuelType === 2) → columnas F, G, H, I (o J)
    // ============================================================
    gasLpRows.forEach((fuel, index) => {
      const currentRow = startRow + index;
      ws.getCell(`F${currentRow}`).value = index + 1;                                 // ITEM
      ws.getCell(`G${currentRow}`).value = fuel.VoucherType || 'NO DISPONIBLE';
      ws.getCell(`I${currentRow}`).value = `${fuel.Liters} LITROS` || 'NO DISPONIBLE';    // COMPROBANTE
      ws.getCell(`H${currentRow}`).value = fuel.Establisment || 'NO DISPONIBLE';      // ESTABLECIMIENTO
      ws.getCell(`J${currentRow}`).value = Number(fuel.Total ?? 0);                   // TOTAL

      // Copiar estilo de la fila 6 (fila de plantilla)
      ws.getRow(currentRow).height = ws.getRow(6).height;
      ['F', 'G', 'H', 'I', 'J'].forEach((col) => {
        ws.getCell(`${col}${currentRow}`).style = { ...ws.getCell(`${col}6`).style };
      });
    });

    // Calcular subtotal/total de GAS LP
    const gasSubtotalRow = startRow + gasLpRows.length + 1;
    const gasGrandTotal = gasLpRows.reduce(
      (sum, fuel) => sum + Number(fuel.Total ?? 0),
      0
    );

    const gasTenPercentValue = gasGrandTotal * 0.10;
    const gasTenPercentRow = gasSubtotalRow + 1;
    const gasTotalFinal = gasTenPercentValue + gasGrandTotal;
    const gasTotalFinalRow = gasTenPercentRow + 1;

    ws.getCell(`I${gasSubtotalRow}`).value = "SUBTOTAL";
    ws.getCell(`J${gasSubtotalRow}`).value = gasGrandTotal;
    ws.getCell(`I${gasTenPercentRow}`).value = "10% ADMINISTRATIVO";
    ws.getCell(`J${gasTenPercentRow}`).value = gasTenPercentValue;
    ws.getCell(`I${gasTotalFinalRow}`).value = "TOTAL";
    ws.getCell(`J${gasTotalFinalRow}`).value = gasTotalFinal;
    ws.getCell("P7").value = gasTotalFinal;

    // Aplicar estilos a los totales de GAS LP
    const lastGasDataRow = gasLpRows.length > 0
      ? startRow + gasLpRows.length - 1
      : 6;

    ['I', 'J'].forEach((col) => {
      const sourceCell = ws.getCell(`${col}${lastGasDataRow}`);

      const subtotalCell = ws.getCell(`${col}${gasSubtotalRow}`);
      subtotalCell.font = { ...sourceCell.font };
      subtotalCell.border = { ...sourceCell.border };
      subtotalCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) subtotalCell.numFmt = sourceCell.numFmt;

      const diezCell = ws.getCell(`${col}${gasTenPercentRow}`);
      diezCell.font = { ...sourceCell.font };
      diezCell.border = { ...sourceCell.border };
      diezCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) diezCell.numFmt = sourceCell.numFmt;

      const totalCell = ws.getCell(`${col}${gasTotalFinalRow}`);
      totalCell.font = { ...sourceCell.font };
      totalCell.border = { ...sourceCell.border };
      totalCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) totalCell.numFmt = sourceCell.numFmt;
    });

    ws.getCell(`J${gasSubtotalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };

    ws.getCell(`J${gasTenPercentRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' },
    };

    ws.getCell(`J${gasTotalFinalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC6E0B4' },
    };

    // ============================================================
    // ACUMULADO DIESEL Y GAS LP (columna L / J según plantilla)
    // ============================================================
    // Si tu plantilla tiene la columna L como "ACUMULADO DIESEL Y GAS LP",
    // aquí se escribiría el total combinado.
    const grandTotal = dieselGrandTotal + gasGrandTotal;
    const grandTenPercent = grandTotal * 0.10;
    const grandTotalFinal = grandTotal + grandTenPercent;
    const finalfinal = dieselTotalFinal + gasTotalFinal;

    ws.getCell("P8").value = finalfinal;
    // Nota: Ajusta las celdas según tu plantilla real (L6, L7, etc.)
    // Ejemplo:
    // ws.getCell("L6").value = grandTotal;
    // ws.getCell("L7").value = grandTotalFinal;

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

    let fileName = `COMBUSTIBLE_CLIENTE-${safeProjectName}`;
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
    console.error("Error al generar archivo:", error);
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