// app/api/excel/generate/route.ts
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { getConnection } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { validateAndRenewSession } from "@/lib/auth";

type AnyRow = RowDataPacket & Record<string, any>;

async function getUserFromSession() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session")?.value;

    if (!sessionId) {
      return null;
    }

    return await validateAndRenewSession(sessionId);
  } catch (error) {
    console.error("Error getting user from session:", error);
    return null;
  }
}

function safeUnmerge(
  sheet: ExcelJS.Worksheet,
  rangeOrCoords: string | { sr: number; sc: number; er: number; ec: number }
) {
  try {
    if (typeof rangeOrCoords === "string") {
      try {
        sheet.unMergeCells(rangeOrCoords);
      } catch {}
    } else {
      try {
        sheet.unMergeCells(rangeOrCoords.sr, rangeOrCoords.sc, rangeOrCoords.er, rangeOrCoords.ec);
      } catch {}
    }
  } catch {}
}

function safeMergeCoords(sheet: ExcelJS.Worksheet, sr: number, sc: number, er: number, ec: number) {
  try {
    safeUnmerge(sheet, { sr, sc, er, ec });
    try {
      sheet.mergeCells(sr, sc, er, ec);
    } catch {}
  } catch {}
}

const formatDDMMYYYY = (d?: string | Date) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
};

// Función para limpiar completamente una fila
function limpiarFilaCompleta(sheet: ExcelJS.Worksheet, fila: number) {
  try {
    const row = sheet.getRow(fila);
    if (!row) return;

    for (let col = 1; col <= (sheet.actualColumnCount || 50); col++) {
      try {
        const cell = row.getCell(col);
        cell.value = "";
        cell.numFmt = "";
        cell.font = {};
        cell.fill = { type: "pattern", pattern: "none" } as ExcelJS.Fill;
        cell.border = {};
      } catch {}
    }
  } catch (error) {
    console.error("Error limpiando fila:", error);
  }
}

export async function POST(req: Request) {
  let connection;
  try {
    // Verificar sesión
    const user = await getUserFromSession();
    if (!user) {
      return NextResponse.json(
        { message: "No autorizado - usuario no autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      projectName,
      date,
      startDate,
      endDate,
      fechaCajaChica,
      montoCajaChica,
      fechaDeposito,
      montoDeposito,
      fechaSaldoAnterior,
      montoSaldoAnterior,
    } = body || {};

    if (!projectName)
      return NextResponse.json({ message: "Project name is required" }, { status: 400 });
    if (!startDate || !endDate)
      return NextResponse.json({ message: "Start and end dates are required" }, { status: 400 });
    if (new Date(startDate) > new Date(endDate))
      return NextResponse.json(
        { message: "Start date cannot be after end date" },
        { status: 400 }
      );

    connection = await getConnection();

    // Obtener el nombre completo del administrador del proyecto asignado al proyecto.
    // En el nuevo esquema: projects.CreatedBy → systemusers → basepersonnel/projectpersonnel
    let fullName = "No asignado";
    try {
      const [rowsUD] = await connection.query<RowDataPacket[]>(
        `SELECT
           NULLIF(TRIM(CONCAT_WS(' ',
             COALESCE(NULLIF(bp.FirstName, ''), NULLIF(pp.FirstName, '')),
             COALESCE(NULLIF(bp.MiddleName, ''), NULLIF(pp.MiddleName, '')),
             COALESCE(NULLIF(bp.LastName, ''), NULLIF(pp.LastName, ''))
           )), '') AS fullName
         FROM projects p
         LEFT JOIN systemusers u ON p.CreatedBy = u.SystemUserID
         LEFT JOIN basepersonnel bp ON u.EmployeeID = bp.EmployeeID
         LEFT JOIN projectpersonnel pp ON u.EmployeeID = pp.EmployeeID
         WHERE p.NameProject = ?
         LIMIT 1`,
        [projectName]
      );
      if (rowsUD?.[0]?.fullName) fullName = String(rowsUD[0].fullName).trim();
    } catch (err) {
      console.error("Error obteniendo nombre del administrador:", err);
    }

    const templatePath = path.join(process.cwd(), "public", "excel", "FT-CP-003.xlsx");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ message: "Excel template not found" }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.getWorksheet(1);
    if (!sheet) return NextResponse.json({ message: "Worksheet not found" }, { status: 500 });

    // Limpiar filas con contenido fijo duplicado
    const filasALimpiar: number[] = [];
    for (let fila = 1; fila <= 100; fila++) {
      try {
        const row = sheet.getRow(fila);
        if (row) {
          for (let col = 1; col <= (sheet.actualColumnCount || 50); col++) {
            try {
              const cell = row.getCell(col);
              if (cell.value && typeof cell.value === "string") {
                const valor = cell.value.toString().toLowerCase();
                if (
                  valor.includes("subtotal") ||
                  valor.includes("disponible en caja") ||
                  valor.includes("comprobó") ||
                  valor.includes("revisó") ||
                  valor.includes("nombre y firma") ||
                  valor.includes("cuentas por pagar") ||
                  (valor.includes("nota") && valor.includes("formato"))
                ) {
                  if (!filasALimpiar.includes(fila)) {
                    filasALimpiar.push(fila);
                  }
                  break;
                }
              }
            } catch {}
          }
        }
      } catch {}
    }

    for (const fila of filasALimpiar) {
      limpiarFilaCompleta(sheet, fila);
    }

    // Encabezados y campos fijos
    safeMergeCoords(sheet, 6, 5, 6, 13);
    sheet.getCell("E6").value = projectName;
    safeMergeCoords(sheet, 6, 1, 6, 3);
    sheet.getCell("A6").value = formatDDMMYYYY(date);
    sheet.getCell("A6").numFmt = "dd/mm/yyyy";
    safeMergeCoords(sheet, 8, 2, 8, 7);
    sheet.getCell("B8").value = fullName;
    safeMergeCoords(sheet, 9, 2, 9, 7);
    sheet.getCell("B9").value = "Administrador de Proyectos";
    safeMergeCoords(sheet, 8, 11, 8, 13);
    const periodoCell = sheet.getCell("K8");
    periodoCell.value = `${formatDDMMYYYY(startDate)} - ${formatDDMMYYYY(endDate)}`;
    periodoCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    // Fecha y montos de depósito, caja chica y saldo anterior
    try {
      if (fechaDeposito) {
        safeMergeCoords(sheet, 9, 13, 9, 13);
        sheet.getCell("M9").value = formatDDMMYYYY(fechaDeposito);
        sheet.getCell("M9").numFmt = "dd/mm/yyyy";
        sheet.getCell("M9").alignment = { horizontal: "center", vertical: "middle" };
      }

      if (montoDeposito !== undefined && montoDeposito !== null && montoDeposito !== "") {
        safeMergeCoords(sheet, 9, 9, 9, 10);
        const numericAmount = Number(String(montoDeposito).replace(/,/g, ""));
        sheet.getCell("I9").value = isNaN(numericAmount) ? 0 : numericAmount;
        sheet.getCell("I9").numFmt = '"$"#,##0.00';
        sheet.getCell("I9").alignment = { horizontal: "center", vertical: "middle" };
      }

      if (fechaCajaChica) {
        safeMergeCoords(sheet, 10, 13, 10, 13);
        sheet.getCell("M10").value = formatDDMMYYYY(fechaCajaChica);
        sheet.getCell("M10").numFmt = "dd/mm/yyyy";
        sheet.getCell("M10").alignment = { horizontal: "center", vertical: "middle" };
      }

      if (montoCajaChica !== undefined && montoCajaChica !== null && montoCajaChica !== "") {
        safeMergeCoords(sheet, 10, 9, 10, 10);
        const numericAmount = Number(String(montoCajaChica).replace(/,/g, ""));
        sheet.getCell("I10").value = isNaN(numericAmount) ? 0 : numericAmount;
        sheet.getCell("I10").numFmt = '"$"#,##0.00';
        sheet.getCell("I10").alignment = { horizontal: "center", vertical: "middle" };
      }

      if (fechaSaldoAnterior) {
        safeMergeCoords(sheet, 11, 13, 11, 13);
        sheet.getCell("M11").value = formatDDMMYYYY(fechaSaldoAnterior);
        sheet.getCell("M11").numFmt = "dd/mm/yyyy";
        sheet.getCell("M11").alignment = { horizontal: "center", vertical: "middle" };
      }

      if (montoSaldoAnterior !== undefined && montoSaldoAnterior !== null && montoSaldoAnterior !== "") {
        safeMergeCoords(sheet, 11, 9, 11, 10);
        const numericAmount = Number(String(montoSaldoAnterior).replace(/,/g, ""));
        sheet.getCell("I11").value = isNaN(numericAmount) ? 0 : numericAmount;
        sheet.getCell("I11").numFmt = '"$"#,##0.00';
        sheet.getCell("I11").alignment = { horizontal: "center", vertical: "middle" };
      }
    } catch (err) {
      console.error("Error al insertar datos de depósito/caja/saldo:", err);
    }

    // Consultas
    const queries = [
      {
        sql: `SELECT Concept, Date, Total FROM administrativeconsumable WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "administrativeconsumable",
      },
      {
        sql: `SELECT Concept, Date, Total FROM consumableclient WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "consumableclient",
      },
      {
        sql: `SELECT Concept, Date, Total FROM epp WHERE Date BETWEEN ? AND ? AND PROJECTID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "epp",
      },
      {
        sql: `SELECT Concept, Date, Total FROM financingservices WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "financingservices",
      },
      {
        sql: `SELECT Concept, Date, Total FROM infrastructureservices WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "infrastructureservices",
      },
      {
        sql: `SELECT Concept, Date, Total FROM installationmaterials WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "installationmaterials",
      },
      {
        sql: `SELECT Beneficiary, Observations, Date, Total FROM loans WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT PROJECTID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "loans",
      },
      {
        sql: `SELECT Liters, LitersCost, Observations, Date, Total FROM fuelclient WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "fuelclient",
      },
      {
        sql: `SELECT Vehicle, StartingPoint, ArrivalPoint, Date, Total FROM infrastructuretransfer WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "infrastructuretransfer",
      },
      {
        sql: `SELECT Vehicle, Liters, Observations, Date, Total FROM localtransportationfuel WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "localtransportationfuel",
      },
      {
        sql: `SELECT PlaceAccommodation, CheckInDate AS Date, Total FROM lodging WHERE CheckInDate BETWEEN ? AND ? AND PROJECTID = (SELECT PROJECTID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "lodging",
      },
      {
        sql: `SELECT Concept, Date, Total FROM operativeconsumable WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "operativeconsumable",
      },
      {
        sql: `SELECT Concept, Date, Total FROM outsourcedservices WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "outsourcedservices",
      },
      {
        sql: `SELECT Concept, Date, Total FROM payroll WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "payroll",
      },
      {
        sql: `SELECT MeansOfTransportation, StartingPoint, ArrivalPoint, Date, Total FROM personneltransfer WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "personneltransfer",
      },
      {
        sql: `SELECT Concept, Date, Total FROM toolsequipment WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "toolsequipment",
      },
      {
        sql: `SELECT Concept, Date, Total FROM uniondues WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "uniondues",
      },
      {
        sql: `SELECT Concept, Date, Total FROM waterice WHERE Date BETWEEN ? AND ? AND ProjectID = (SELECT ProjectID FROM projects WHERE NameProject = ?) AND MethodID = 3`,
        params: [startDate, endDate, projectName],
        source: "waterice",
      },
    ];

    const collected: { text: string; total: number; dateNum: number; fechaStr: string }[] = [];

    // Recolección de filas desde DB
    for (const q of queries) {
      try {
        const [rows] = await connection.query<AnyRow[]>(q.sql, q.params);
        if (!rows) continue;

        for (const r of rows) {
          let text = "";
          let dateValue: any = null;
          let totalValue = Number(r.Total || 0);

          switch (q.source) {
            case "administrativeconsumable":
            case "consumableclient":
            case "epp":
            case "financingservices":
            case "infrastructureservices":
            case "operativeconsumable":
            case "outsourcedservices":
            case "payroll":
            case "toolsequipment":
            case "uniondues":
            case "waterice":
            case "installationmaterials":
              text = r.Concept ? String(r.Concept).trim() : "";
              dateValue = r.Date;
              break;
            case "loans":
              text = r.Beneficiary ? String(r.Beneficiary).trim() : "";
              dateValue = r.Date;
              break;
            case "fuelclient": {
              const lit = r.Liters ? `${r.Liters} Lt` : "";
              const obsF = r.Observations ? String(r.Observations).trim() : "";
              text = [lit, obsF].filter(Boolean).join(", ");
              dateValue = r.Date;
              break;
            }
            case "infrastructuretransfer": {
              const v = r.Vehicle || "";
              const st = r.StartingPoint || "";
              const ar = r.ArrivalPoint || "";
              const ruta = st && ar ? `${st} - ${ar}` : st || ar;
              text = [v, ruta].filter(Boolean).join(", ");
              dateValue = r.Date;
              break;
            }
            case "localtransportationfuel": {
              const vv = r.Vehicle ? String(r.Vehicle).trim() : "";
              const ll = r.Liters ? `${r.Liters} Lt` : "";
              const oo = r.Observations ? String(r.Observations).trim() : "";
              text = [vv, ll, oo].filter(Boolean).join(", ");
              dateValue = r.Date;
              break;
            }
            case "personneltransfer": {
              const mt = r.MeansOfTransportation || "";
              const stt = r.StartingPoint || "";
              const arr = r.ArrivalPoint || "";
              const ruta2 = stt && arr ? `${stt} - ${arr}` : stt || arr;
              text = [mt, ruta2].filter(Boolean).join(", ");
              dateValue = r.Date;
              break;
            }
            case "lodging":
              text = r.PlaceAccommodation ? String(r.PlaceAccommodation).trim() : "";
              dateValue = r.Date;
              break;
          }

          if (text.trim() !== "") {
            const dateObj = new Date(dateValue);
            collected.push({
              text: text.trim(),
              total: Number(isNaN(totalValue) ? 0 : totalValue),
              dateNum: isNaN(dateObj.getTime()) ? 0 : dateObj.getTime(),
              fechaStr: isNaN(dateObj.getTime()) ? String(dateValue) : formatDDMMYYYY(dateObj),
            });
          }
        }
      } catch (err) {
        console.error(`Error querying source ${q.source}:`, err);
      }
    }

    // Orden por fecha
    collected.sort((a, b) => a.dateNum - b.dateNum);

    const filaInicio = 15;
    const sourceRow = sheet.getRow(filaInicio);
    const totalCols = sheet.actualColumnCount || 50;

    // Asegurar merges de la fila base
    safeMergeCoords(sheet, filaInicio, 1, filaInicio, 2);
    safeMergeCoords(sheet, filaInicio, 3, filaInicio, 6);
    safeMergeCoords(sheet, filaInicio, 7, filaInicio, 8);
    safeMergeCoords(sheet, filaInicio, 9, filaInicio, 11);
    safeMergeCoords(sheet, filaInicio, 12, filaInicio, 13);

    // Función para ajustar alto de fila según texto
    function ajustarAlturaFila(row: ExcelJS.Row, texto: string) {
      try {
        if (!texto) return;
        const aproxCharsPorLinea = 50;
        const partes = String(texto).split(/\r\n|\r|\n/);
        let lineas = 0;
        for (const p of partes) {
          lineas += Math.max(1, Math.ceil(p.length / aproxCharsPorLinea));
        }
        const alturaLinea = 15;
        const nuevaAltura = Math.max(18, alturaLinea * lineas);
        try {
          row.height = nuevaAltura;
        } catch {}
      } catch (err) {}
    }

    let lastDataRow = filaInicio;

    if (collected.length === 0) {
      // Sin registros
      sheet.getCell(filaInicio, 3).value = "";
      sheet.getCell(filaInicio, 9).value = 0;
      sheet.getCell(filaInicio, 9).numFmt = '"$"#,##0.00';
      sheet.getCell(filaInicio, 12).value = 0;
      sheet.getCell(filaInicio, 12).numFmt = '"$"#,##0.00';
      sheet.getCell(filaInicio, 13).value = 0;
      sheet.getCell(filaInicio, 13).numFmt = '"$"#,##0.00';

      // SUBTOTAL
      const subtotalRow = filaInicio + 1;
      safeMergeCoords(sheet, subtotalRow, 9, subtotalRow, 11);
      sheet.getCell(subtotalRow, 9).value = "Subtotal";
      sheet.getCell(subtotalRow, 9).alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell(subtotalRow, 9).font = { bold: true };

      safeMergeCoords(sheet, subtotalRow, 12, subtotalRow, 13);
      sheet.getCell(subtotalRow, 12).value = 0;
      sheet.getCell(subtotalRow, 12).numFmt = '"$"#,##0.00';
      sheet.getCell(subtotalRow, 12).font = { bold: true };
      sheet.getCell(subtotalRow, 12).alignment = { horizontal: "center", vertical: "middle" };

      try {
        const subtotalCell = sheet.getCell(subtotalRow, 9);
        subtotalCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        const subtotalValueCell = sheet.getCell(subtotalRow, 12);
        subtotalValueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      } catch (err) {
        console.error("Error aplicando bordes a SUBTOTAL:", err);
      }

      // DISPONIBLE EN CAJA
      const disponibleRow = subtotalRow + 1;
      safeMergeCoords(sheet, disponibleRow, 9, disponibleRow, 11);
      sheet.getCell(disponibleRow, 9).value = "Disponible en caja";
      sheet.getCell(disponibleRow, 9).alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell(disponibleRow, 9).font = { bold: true };

      safeMergeCoords(sheet, disponibleRow, 12, disponibleRow, 13);
      sheet.getCell(disponibleRow, 12).value = { formula: `L${subtotalRow}-M13` };
      sheet.getCell(disponibleRow, 12).numFmt = '"$"#,##0.00';
      sheet.getCell(disponibleRow, 12).font = { bold: true };
      sheet.getCell(disponibleRow, 12).alignment = { horizontal: "center", vertical: "middle" };

      try {
        const disponibleCell = sheet.getCell(disponibleRow, 9);
        disponibleCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        const disponibleValueCell = sheet.getCell(disponibleRow, 12);
        disponibleValueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      } catch (err) {
        console.error("Error aplicando bordes a DISPONIBLE EN CAJA:", err);
      }

      try {
        sheet.getCell(filaInicio, 3).alignment = { wrapText: true };
        ajustarAlturaFila(sheet.getRow(filaInicio), "");
      } catch {}

      lastDataRow = disponibleRow;

    } else {
      // Primer registro
      for (let c = 1; c <= totalCols; c++) {
        try {
          const sc = sourceRow.getCell(c);
          const tc = sheet.getRow(filaInicio).getCell(c);
          if (sc.font) tc.font = { ...sc.font };
          if (sc.fill) tc.fill = { ...sc.fill };
          if (sc.border) tc.border = { ...sc.border };
          if (sc.alignment) tc.alignment = { ...sc.alignment };
          if (sc.numFmt) tc.numFmt = sc.numFmt;
        } catch {}
      }

      sheet.getCell(filaInicio, 1).value = collected[0].fechaStr;
      sheet.getCell(filaInicio, 1).numFmt = "dd/mm/yyyy";
      sheet.getCell(filaInicio, 3).value = collected[0].text;

      try {
        const cell = sheet.getCell(filaInicio, 3);
        cell.alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
      } catch {}

      ajustarAlturaFila(sheet.getRow(filaInicio), collected[0].text);
      sheet.getCell(filaInicio, 9).value = collected[0].total;
      sheet.getCell(filaInicio, 9).numFmt = '"$"#,##0.00';
      sheet.getCell(filaInicio, 12).value = { formula: `I${filaInicio}` };
      sheet.getCell(filaInicio, 12).numFmt = '"$"#,##0.00';
      sheet.getCell(filaInicio, 13).value = { formula: `I${filaInicio}` };
      sheet.getCell(filaInicio, 13).numFmt = '"$"#,##0.00';

      // Registros adicionales
      for (let i = 1; i < collected.length; i++) {
        const insertAt = filaInicio + i;
        sheet.spliceRows(insertAt, 0, []);
        const newRow = sheet.getRow(insertAt);

        try {
          newRow.height = sourceRow.height;
        } catch {}

        for (let c = 1; c <= totalCols; c++) {
          try {
            const sc = sourceRow.getCell(c);
            const nc = newRow.getCell(c);
            if (sc.font) nc.font = { ...sc.font };
            if (sc.fill) nc.fill = { ...sc.fill };
            if (sc.border) nc.border = { ...sc.border };
            if (sc.alignment) nc.alignment = { ...sc.alignment };
            if (sc.numFmt) nc.numFmt = sc.numFmt;
          } catch {}
        }

        safeMergeCoords(sheet, insertAt, 1, insertAt, 2);
        safeMergeCoords(sheet, insertAt, 3, insertAt, 6);
        safeMergeCoords(sheet, insertAt, 7, insertAt, 8);
        safeMergeCoords(sheet, insertAt, 9, insertAt, 11);
        safeMergeCoords(sheet, insertAt, 12, insertAt, 13);

        newRow.getCell(1).value = collected[i].fechaStr;
        newRow.getCell(1).numFmt = "dd/mm/yyyy";
        newRow.getCell(3).value = collected[i].text;

        try {
          newRow.getCell(3).alignment = { wrapText: true, vertical: "middle", horizontal: "left" };
        } catch {}

        ajustarAlturaFila(newRow, collected[i].text);
        newRow.getCell(9).value = collected[i].total;
        newRow.getCell(9).numFmt = '"$"#,##0.00';
        newRow.getCell(12).value = { formula: `I${insertAt}` };
        newRow.getCell(12).numFmt = '"$"#,##0.00';
        newRow.getCell(13).value = { formula: `I${insertAt}` };
        newRow.getCell(13).numFmt = '"$"#,##0.00';
      }

      // SUBTOTAL
      const subtotalRow = filaInicio + collected.length;
      const sumStart = filaInicio;
      const sumEnd = filaInicio + collected.length - 1;

      safeMergeCoords(sheet, subtotalRow, 9, subtotalRow, 11);
      sheet.getCell(subtotalRow, 9).value = "Subtotal";
      sheet.getCell(subtotalRow, 9).alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell(subtotalRow, 9).font = { bold: true };

      safeMergeCoords(sheet, subtotalRow, 12, subtotalRow, 13);
      sheet.getCell(subtotalRow, 12).value = { formula: `SUM(L${sumStart}:L${sumEnd})` };
      sheet.getCell(subtotalRow, 12).numFmt = '"$"#,##0.00';
      sheet.getCell(subtotalRow, 12).font = { bold: true };
      sheet.getCell(subtotalRow, 12).alignment = { horizontal: "center", vertical: "middle" };

      try {
        const subtotalCell = sheet.getCell(subtotalRow, 9);
        subtotalCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        const subtotalValueCell = sheet.getCell(subtotalRow, 12);
        subtotalValueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      } catch (err) {
        console.error("Error aplicando bordes a SUBTOTAL:", err);
      }

      // DISPONIBLE EN CAJA
      const disponibleRow = subtotalRow + 1;
      safeMergeCoords(sheet, disponibleRow, 9, disponibleRow, 11);
      sheet.getCell(disponibleRow, 9).value = "Disponible en caja";
      sheet.getCell(disponibleRow, 9).alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell(disponibleRow, 9).font = { bold: true };

      safeMergeCoords(sheet, disponibleRow, 12, disponibleRow, 13);
      sheet.getCell(disponibleRow, 12).value = { formula: `L${subtotalRow}-M13` };
      sheet.getCell(disponibleRow, 12).numFmt = '"$"#,##0.00';
      sheet.getCell(disponibleRow, 12).font = { bold: true };
      sheet.getCell(disponibleRow, 12).alignment = { horizontal: "center", vertical: "middle" };

      try {
        const disponibleCell = sheet.getCell(disponibleRow, 9);
        disponibleCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        const disponibleValueCell = sheet.getCell(disponibleRow, 12);
        disponibleValueCell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      } catch (err) {
        console.error("Error aplicando bordes a DISPONIBLE EN CAJA:", err);
      }

      lastDataRow = disponibleRow;
    }

    const comproboRow = lastDataRow + 6;

    // COMPROBÓ
    safeMergeCoords(sheet, comproboRow, 1, comproboRow, 3);
    sheet.getCell(comproboRow, 1).value = "COMPROBÓ";
    sheet.getCell(comproboRow, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(comproboRow, 1).font = { bold: true };

    // REVISÓ
    safeMergeCoords(sheet, comproboRow, 9, comproboRow, 13);
    sheet.getCell(comproboRow, 9).value = "REVISÓ";
    sheet.getCell(comproboRow, 9).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(comproboRow, 9).font = { bold: true };

    // NOMBRE Y FIRMA
    const firmaRow = comproboRow + 3;
    safeMergeCoords(sheet, firmaRow, 1, firmaRow, 3);
    sheet.getCell(firmaRow, 1).value = "NOMBRE Y FIRMA";
    sheet.getCell(firmaRow, 1).alignment = { horizontal: "center", vertical: "middle" };

    try {
      const nombreFirmaCell = sheet.getCell(firmaRow, 1);
      nombreFirmaCell.border = {
        top: { style: "thin" },
        left: undefined,
        bottom: undefined,
        right: undefined,
      };
    } catch (err) {
      console.error("Error aplicando borde a NOMBRE Y FIRMA:", err);
    }

    // CUENTAS POR PAGAR
    safeMergeCoords(sheet, firmaRow, 9, firmaRow, 13);
    sheet.getCell(firmaRow, 9).value = "CUENTAS POR PAGAR";
    sheet.getCell(firmaRow, 9).alignment = { horizontal: "center", vertical: "middle" };

    const notaRow = firmaRow + 5;
    safeMergeCoords(sheet, notaRow, 1, notaRow, 13);
    sheet.getCell(notaRow, 1).value =
      "NOTA:  Este formato debe  acompañarse de los documentos originales que comprueben los movimientos listados";
    sheet.getCell(notaRow, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(notaRow, 1).font = { bold: false };

    // Guardar archivo y devolver
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="prueba.xlsx"',
      },
    });
  } catch (error: any) {
    console.error("Error generating file:", error);
    return NextResponse.json(
      { message: "Error generating file", detail: error?.message },
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