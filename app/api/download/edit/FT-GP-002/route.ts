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
  AdminFirstName: string | null;
  AdminLastName: string | null;
  AdminMiddleName: string | null;
  NameProjectManager: string | null;
}

interface PersonnelTransferRow extends RowDataPacket {
  PersonnelTransferID: number;
  Date: string | null;
  MeansOfTransportation: string | null;
  StartingPoint: string | null;
  ArrivalPoint: string | null;
  MethodID: number;
  Total: string | number | null;
  Observations: string | null;
  Status: number | null;
  VoucherType: string | null;
  ProjectPersonnelID: number;
  FullName: string;
  Position: string | null;
}

interface EmployeeTransferDetail extends RowDataPacket {
  PersonnelTransferID: number;
  ProjectPersonnelID: number;
  Date: string | null;
  VoucherType: string | null;
  StartingPoint: string | null;
  ArrivalPoint: string | null;
  Total: string | number | null;
  Archivos: string | null; // JSON string con array de adjuntos
}

interface Adjunto {
  nombre: string;
  url: string;
  tipo: string;
  key: string;
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

// Función para sanitizar nombres de hojas de Excel
const sanitizeSheetName = (name: string, fallback: string): string => {
  let sanitized = (name || fallback)
    .replace(/[\\\/\?\*\[\]:]/g, '')
    .trim();
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }
  if (!sanitized) {
    sanitized = fallback;
  }
  return sanitized;
};

// Función para parsear el campo Archivos (JSON string)
const parseArchivos = (raw: string | null): Adjunto[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && item.url)
      .map((item) => ({
        nombre: item.nombre || 'Archivo',
        url: item.url,
        tipo: item.tipo || '',
        key: item.key || '',
      }));
  } catch {
    return [];
  }
};

// Determina si un adjunto es una imagen soportada por ExcelJS
const isImageAdjunto = (adjunto: Adjunto): boolean => {
  const tipo = (adjunto.tipo || '').toLowerCase();
  if (tipo.startsWith('image/')) {
    // ExcelJS solo soporta jpeg, png y gif (no webp, no bmp)
    if (tipo === 'image/webp' || tipo === 'image/bmp') return false;
    return true;
  }
  const ext = adjunto.url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif'].includes(ext);
};

// Devuelve la extensión compatible con ExcelJS
const getImageExtension = (adjunto: Adjunto): 'jpeg' | 'png' | 'gif' => {
  const tipo = (adjunto.tipo || '').toLowerCase();
  if (tipo === 'image/png') return 'png';
  if (tipo === 'image/gif') return 'gif';
  if (tipo === 'image/jpeg' || tipo === 'image/jpg') return 'jpeg';

  const ext = adjunto.url.split('?')[0].split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'png';
  if (ext === 'gif') return 'gif';
  return 'jpeg';
};

// ============================================================
// Lectura de dimensiones reales de imágenes desde el Buffer
// (sin dependencias externas)
// ============================================================

// PNG: bytes 16-23 => width (4 bytes BE) + height (4 bytes BE)
const getPngSize = (buf: Buffer): { width: number; height: number } | null => {
  try {
    if (buf.length < 24) return null;
    if (
      buf[0] !== 0x89 ||
      buf[1] !== 0x50 ||
      buf[2] !== 0x4e ||
      buf[3] !== 0x47
    ) {
      return null;
    }
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
};

// GIF: bytes 6-9 => width (2 bytes LE) + height (2 bytes LE)
const getGifSize = (buf: Buffer): { width: number; height: number } | null => {
  try {
    if (buf.length < 10) return null;
    const sig = buf.toString('ascii', 0, 3);
    if (sig !== 'GIF') return null;
    const width = buf.readUInt16LE(6);
    const height = buf.readUInt16LE(8);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
};

// JPEG: recorrer marcadores hasta encontrar SOF0..SOF15 (excepto SOF4, SOF8, SOF12)
const getJpegSize = (buf: Buffer): { width: number; height: number } | null => {
  try {
    if (buf.length < 4) return null;
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // SOI

    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      while (offset < buf.length && buf[offset] === 0xff) offset++;
      if (offset >= buf.length) break;

      const marker = buf[offset];
      offset++;

      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker >= 0xd0 && marker <= 0xd7) continue;
      if (marker === 0x01) continue;

      if (offset + 1 >= buf.length) break;
      const segmentLength = buf.readUInt16BE(offset);
      if (segmentLength < 2) break;

      const isSOF =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;

      if (isSOF) {
        if (offset + 7 > buf.length) break;
        const height = buf.readUInt16BE(offset + 3);
        const width = buf.readUInt16BE(offset + 5);
        if (!width || !height) return null;
        return { width, height };
      }

      offset += segmentLength;
    }
    return null;
  } catch {
    return null;
  }
};

const getImageSize = (
  buffer: Buffer,
  extension: 'jpeg' | 'png' | 'gif'
): { width: number; height: number } | null => {
  if (extension === 'png') return getPngSize(buffer);
  if (extension === 'gif') return getGifSize(buffer);
  return getJpegSize(buffer);
};

// Descarga una imagen y devuelve un Buffer
const fetchImageBuffer = async (url: string): Promise<Buffer | null> => {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Error al descargar imagen ${url}: HTTP ${res.status}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error(`Error al descargar imagen ${url}:`, err);
    return null;
  }
};

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

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!projectId) {
      return NextResponse.json(
        { success: false, message: "Se requiere el ID del proyecto" },
        { status: 400 }
      );
    }

    if ((startDate && !endDate) || (!startDate && endDate)) {
      return NextResponse.json(
        { success: false, message: "Debe proporcionar ambas fechas (startDate y endDate) o ninguna" },
        { status: 400 }
      );
    }

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

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { success: false, message: "La fecha inicial no puede ser mayor que la fecha final" },
        { status: 400 }
      );
    }

    connection = await getConnection();

    // Obtener datos del proyecto, cliente, administrador y project manager externo
    const [rows] = await connection.execute<ProjectRow[]>(
      `SELECT 
            p.ProjectID, 
            p.NameProject, 
            p.ProjectAddress, 
            c.ClientName,
            bp.FirstName AS AdminFirstName,
            bp.LastName AS AdminLastName,
            bp.MiddleName AS AdminMiddleName,
            epm.NameProjectManager
        FROM projects p 
        INNER JOIN clients c ON c.ClientID = p.ClientID
        LEFT JOIN basepersonnel bp ON bp.EmployeeID = p.AdminProjectID
        LEFT JOIN externalprojectmanager epm ON epm.ExternalProjectManagerID = p.ExternalProjectManagerID
        WHERE p.ProjectID = ?`,
      [projectId]
    );

    if (!rows.length) {
      return NextResponse.json(
        { success: false, message: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const projectName = rows[0].NameProject || 'PROYECTO SIN NOMBRE';
    const projectAddress = rows[0].ProjectAddress || 'DIRECCIÓN NO DISPONIBLE';
    const clientName = rows[0].ClientName || 'CLIENTE NO DISPONIBLE';

    const adminFirstName = rows[0].AdminFirstName || '';
    const adminLastName = rows[0].AdminLastName || '';
    const adminMiddleName = rows[0].AdminMiddleName || '';
    const adminFullName = [adminFirstName, adminLastName, adminMiddleName]
      .filter((part) => part && part.trim() !== '')
      .join(' ')
      .trim() || 'ADMINISTRADOR NO DISPONIBLE';

    const projectManagerName =
      (rows[0].NameProjectManager && rows[0].NameProjectManager.trim()) ||
      'PROJECT MANAGER NO DISPONIBLE';

    // Consulta con agregaciones para agrupar por empleado
    let personnelTransfersQuery = `
      SELECT 
        MIN(pt.PersonnelTransferID) AS PersonnelTransferID,
        MIN(pt.Date) AS Date,
        GROUP_CONCAT(DISTINCT pt.MeansOfTransportation SEPARATOR ', ') AS MeansOfTransportation,
        GROUP_CONCAT(DISTINCT CONCAT(pt.StartingPoint, ' - ', pt.ArrivalPoint) SEPARATOR ', ') AS Route,
        MIN(pt.MethodID) AS MethodID,
        SUM(pt.Total) AS Total,
        GROUP_CONCAT(DISTINCT pt.Observations SEPARATOR ' | ') AS Observations,
        MIN(pt.Status) AS Status,
        MIN(pt.VoucherType) AS VoucherType,
        pt.ProjectPersonnelID,
        CONCAT(pp.FirstName, ' ', pp.LastName, ' ', pp.MiddleName) AS FullName,
        pc.Position
      FROM personneltransfer pt
      INNER JOIN projectpersonnel pp 
          ON pp.ProjectPersonnelID = pt.ProjectPersonnelID
      LEFT JOIN projectcontracts pc
          ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
      WHERE pt.ProjectID = ?`;

    const queryParams: any[] = [projectId];

    if (startDate && endDate) {
      personnelTransfersQuery += ` AND pt.Date >= ? AND pt.Date <= ?`;
      queryParams.push(startDate, endDate);
    }

    personnelTransfersQuery += `
      GROUP BY 
        pt.ProjectPersonnelID,
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        pc.Position
      ORDER BY pt.ProjectPersonnelID ASC;`;

    const [personnelTransfers] = await connection.execute<PersonnelTransferRow[]>(
      personnelTransfersQuery,
      queryParams
    );

    if (personnelTransfers.length === 0 && startDate && endDate) {
      return NextResponse.json(
        { 
          success: false, 
          message: `No se encontraron registros de traslado en el rango de fechas seleccionado (${formatDateForCell(startDate)} a ${formatDateForCell(endDate)})` 
        },
        { status: 404 }
      );
    }

    // ============================================================
    // Obtener los registros DETALLADOS por empleado (incluye Archivos)
    // ============================================================
    let detailQuery = `
      SELECT 
        pt.PersonnelTransferID,
        pt.ProjectPersonnelID,
        pt.Date,
        pt.VoucherType,
        pt.StartingPoint,
        pt.ArrivalPoint,
        pt.Total,
        pt.Archivos
      FROM personneltransfer pt
      WHERE pt.ProjectID = ?`;

    const detailParams: any[] = [projectId];

    if (startDate && endDate) {
      detailQuery += ` AND pt.Date >= ? AND pt.Date <= ?`;
      detailParams.push(startDate, endDate);
    }

    detailQuery += ` ORDER BY pt.ProjectPersonnelID ASC, pt.Date ASC, pt.PersonnelTransferID ASC;`;

    const [detailRows] = await connection.execute<EmployeeTransferDetail[]>(
      detailQuery,
      detailParams
    );

    // Agrupar los detalles por ProjectPersonnelID
    const detailsByPersonnel: { [key: number]: EmployeeTransferDetail[] } = {};
    detailRows.forEach((row) => {
      if (!detailsByPersonnel[row.ProjectPersonnelID]) {
        detailsByPersonnel[row.ProjectPersonnelID] = [];
      }
      detailsByPersonnel[row.ProjectPersonnelID].push(row);
    });

    const templatePath = path.join(
      process.cwd(),
      "public",
      "project-manager-dashboard",
      "FT-GP-002.xlsx"
    );

    if (!fs.existsSync(templatePath)) {
      console.error(`Plantilla no encontrada en: ${templatePath}`);
      return NextResponse.json(
        { success: false, message: 'Plantilla FT-GP-002 no encontrada' },
        { status: 500 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Guardamos el ID de la primera hoja para activarla al final
    const firstSheetId = ws.id;

    const totalPersonas = personnelTransfers.length;

    // Encabezados y datos del proyecto
    ws.getCell("C20").value = `MOVILIZACIÓN A SITIO ${projectAddress}`;
    ws.getCell("J9").value = projectName || 'PROYECTO SIN NOMBRE';
    ws.getCell("C9").value = projectAddress || 'DIRECCIÓN NO DISPONIBLE';
    ws.getCell("J8").value = clientName || 'CLIENTE NO DISPONIBLE';
    ws.getCell("C10").value = adminFullName;
    ws.getCell("J11").value = projectManagerName;

    ws.getCell("A22").value = `MOVILIZACIÓN A SITIO DE ${totalPersonas} ${totalPersonas === 1 ? 'PERSONA' : 'PERSONAS'} SOLICITADAS EN ${projectAddress}`;

    if (startDate && endDate) {
      ws.getCell("J7").value = `${formatDateForCell(startDate)} AL ${formatDateForCell(endDate)}`;
    } else {
      ws.getCell("J7").value = 'TODAS LAS FECHAS';
    }

    // ============================================================
    // PIE DE PÁGINA EN LA PRIMERA HOJA
    // ============================================================
    const refCell = ws.getCell("A15");
    const refFontName = refCell.font?.name || "Arial";
    const refFontSize = refCell.font?.size || 10;

    const fontCmd = `&"${refFontName}"&${refFontSize}`;

    const footerLeft = `${fontCmd}&U${adminFullName}&U\nPOR SIGERSA INNOVACIONES`;
    const footerCenter = ``;
    const footerRight = `${fontCmd}SUP.ADTVO.:`;

    ws.headerFooter.oddFooter = `&L${footerLeft}&C${footerCenter}&R${footerRight}`;
    ws.headerFooter.evenFooter = `&L${footerLeft}&C${footerCenter}&R${footerRight}`;

    const startRow = 26;
    personnelTransfers.forEach((transfer, index) => {
      const currentRow = startRow + index;

      ws.getCell(`A${currentRow}`).value = transfer.FullName || 'NO DISPONIBLE';
      ws.getCell(`E${currentRow}`).value = transfer.Position || 'NO DISPONIBLE';
      ws.getCell(`G${currentRow}`).value = transfer.Route || 'NO DISPONIBLE';
      ws.getCell(`K${currentRow}`).value = Number(transfer.Total ?? 0);
      ws.getCell(`I${currentRow}`).value = 1;
      ws.getCell(`M${currentRow}`).value = 'Serv.';
      ws.getCell(`N${currentRow}`).value = Number(transfer.Total ?? 0);

      ws.getRow(currentRow).height = ws.getRow(26).height;
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach((col) => {
        ws.getCell(`${col}${currentRow}`).style = { ...ws.getCell(`${col}26`).style };
      });
    });

    const totalRow = startRow + personnelTransfers.length + 1;
    const grandTotal = personnelTransfers.reduce(
      (sum, transfer) => sum + Number(transfer.Total ?? 0),
      0
    );

    // Fila TOTAL en la hoja principal (copia estilo del último registro)
    const lastDataRow = startRow + personnelTransfers.length - 1;

    ws.getCell(`M${totalRow}`).value = "TOTAL";
    ws.getCell(`N${totalRow}`).value = grandTotal;

    ['M', 'N'].forEach((col) => {
      const sourceCell = personnelTransfers.length > 0
        ? ws.getCell(`${col}${lastDataRow}`)
        : ws.getCell(`${col}22`);

      const totalCell = ws.getCell(`${col}${totalRow}`);
      totalCell.font = { ...sourceCell.font };
      totalCell.border = { ...sourceCell.border };
      totalCell.alignment = { ...sourceCell.alignment };
      if (sourceCell.numFmt) {
        totalCell.numFmt = sourceCell.numFmt;
      }
    });

    ws.getCell(`M${totalRow}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF00' },
    };

    // ============================================================
    // Escribir en la hoja RELACION_PERSONAL
    // ============================================================
    const wsRelacion = workbook.getWorksheet("RELACION_PERSONAL");
    if (wsRelacion) {
      const relacionStartRow = 2;
      const relacionColumns = ['A', 'B', 'C', 'D', 'E'];

      personnelTransfers.forEach((transfer, index) => {
        const currentRow = relacionStartRow + index;

        wsRelacion.getCell(`A${currentRow}`).value = index + 1;
        wsRelacion.getCell(`B${currentRow}`).value = transfer.FullName || 'NO DISPONIBLE';
        wsRelacion.getCell(`C${currentRow}`).value = transfer.Position || 'NO DISPONIBLE';
        wsRelacion.getCell(`D${currentRow}`).value = transfer.Date
          ? formatDateForCell(transfer.Date)
          : 'NO DISPONIBLE';
        wsRelacion.getCell(`E${currentRow}`).value = Number(transfer.Total ?? 0);

        if (currentRow !== relacionStartRow) {
          wsRelacion.getRow(currentRow).height = wsRelacion.getRow(relacionStartRow).height;
          relacionColumns.forEach((col) => {
            wsRelacion.getCell(`${col}${currentRow}`).style = {
              ...wsRelacion.getCell(`${col}${relacionStartRow}`).style,
            };
          });
        }
      });

      const relacionTotalRow = relacionStartRow + personnelTransfers.length;
      const relacionLastDataRow = relacionStartRow + personnelTransfers.length - 1;

      const relacionTotalCell = wsRelacion.getCell(`E${relacionTotalRow}`);
      relacionTotalCell.value = grandTotal;

      if (personnelTransfers.length > 0) {
        const sourceCell = wsRelacion.getCell(`E${relacionLastDataRow}`);
        relacionTotalCell.font = { ...sourceCell.font };
        relacionTotalCell.border = { ...sourceCell.border };
        relacionTotalCell.alignment = { ...sourceCell.alignment };
        if (sourceCell.numFmt) {
          relacionTotalCell.numFmt = sourceCell.numFmt;
        }
      }

      relacionTotalCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' },
      };
    }

    // ============================================================
    // Crear una hoja por cada trabajador basada en ESQUELETO
    // ============================================================
    const wsEsqueleto = workbook.getWorksheet("ESQUELETO");

    if (wsEsqueleto) {
      const employeeColumns = ['A', 'B', 'C'];

      for (let index = 0; index < personnelTransfers.length; index++) {
        const transfer = personnelTransfers[index];

        const employeeName = transfer.FullName || `TRABAJADOR_${index + 1}`;
        const fallbackName = `TRABAJADOR_${index + 1}`;
        let sheetName = sanitizeSheetName(employeeName, fallbackName);

        let finalSheetName = sheetName;
        let counter = 1;
        while (workbook.getWorksheet(finalSheetName)) {
          const suffix = `_${counter}`;
          finalSheetName = sheetName.substring(0, 31 - suffix.length) + suffix;
          counter++;
        }

        const newSheet = workbook.addWorksheet(finalSheetName);

        wsEsqueleto.columns.forEach((col, colIndex) => {
          if (col && col.width) {
            newSheet.getColumn(colIndex + 1).width = col.width;
          }
        });

        wsEsqueleto.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          const newRow = newSheet.getRow(rowNumber);
          newRow.height = row.height;

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const newCell = newRow.getCell(colNumber);
            newCell.value = cell.value;
            newCell.style = { ...cell.style };
            if (cell.numFmt) {
              newCell.numFmt = cell.numFmt;
            }
          });

          newRow.commit();
        });

        const mergedRanges = (wsEsqueleto as any).model?.merges || [];
        mergedRanges.forEach((range: string) => {
          try {
            newSheet.mergeCells(range);
          } catch (e) {
            // Ignorar si ya está combinada
          }
        });

        newSheet.getCell("A1").value = projectName || 'PROYECTO SIN NOMBRE';
        newSheet.getCell("A3").value = employeeName;

        const employeeDetails = detailsByPersonnel[transfer.ProjectPersonnelID] || [];
        const detailStartRow = 5;

        let employeeTotal = 0;

        employeeDetails.forEach((detail, detailIndex) => {
          const currentRow = detailStartRow + detailIndex;

          newSheet.getCell(`A${currentRow}`).value = detail.VoucherType || 'NO DISPONIBLE';

          const route = [detail.StartingPoint, detail.ArrivalPoint]
            .filter((p) => p && p.trim() !== '')
            .join(' - ');
          newSheet.getCell(`B${currentRow}`).value = route || 'NO DISPONIBLE';

          const monto = Number(detail.Total ?? 0);
          newSheet.getCell(`C${currentRow}`).value = monto;
          employeeTotal += monto;
        });

        const lastGeneratedRow = detailStartRow + employeeDetails.length - 1;

        for (let r = detailStartRow + 1; r <= lastGeneratedRow; r++) {
          newSheet.getRow(r).height = newSheet.getRow(detailStartRow).height;
          employeeColumns.forEach((col) => {
            newSheet.getCell(`${col}${r}`).style = {
              ...newSheet.getCell(`${col}${detailStartRow}`).style,
            };
          });
        }

        const montoRefCell = newSheet.getCell(`C${detailStartRow}`);
        const montoFont = { ...montoRefCell.font };
        const montoBorder = { ...montoRefCell.border };
        const montoAlignment = { ...montoRefCell.alignment };
        const montoNumFmt = montoRefCell.numFmt;

        const colBRefCell = newSheet.getCell(`B${detailStartRow}`);
        const colBFont = { ...colBRefCell.font };
        const colBBorder = { ...colBRefCell.border };
        const colBAlignment = { ...colBRefCell.alignment };

        // ============================================
        // Fila del TOTAL (columna C con fondo amarillo)
        // ============================================
        const totalEmployeeRow =
          employeeDetails.length > 0
            ? detailStartRow + employeeDetails.length
            : detailStartRow;

        const totalCell = newSheet.getCell(`C${totalEmployeeRow}`);
        totalCell.value = employeeTotal;
        totalCell.font = { ...montoFont };
        totalCell.border = { ...montoBorder };
        totalCell.alignment = { ...montoAlignment };
        if (montoNumFmt) totalCell.numFmt = montoNumFmt;
        totalCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' },
        };

        // ============================================
        // Fila del 8% - FONDO BLANCO, B: "8% ADMINISTRATIVO"
        // ============================================
        const eightPercentRow = totalEmployeeRow + 1;
        const eightPercentValue = employeeTotal * 0.08;

        const eightPercentLabelCell = newSheet.getCell(`B${eightPercentRow}`);
        eightPercentLabelCell.value = '8% ADMINISTRATIVO';
        eightPercentLabelCell.font = { ...colBFont };
        eightPercentLabelCell.border = { ...colBBorder };
        eightPercentLabelCell.alignment = { ...colBAlignment };
        eightPercentLabelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' },
        };

        const eightPercentCell = newSheet.getCell(`C${eightPercentRow}`);
        eightPercentCell.value = eightPercentValue;
        eightPercentCell.font = { ...montoFont };
        eightPercentCell.border = { ...montoBorder };
        eightPercentCell.alignment = { ...montoAlignment };
        if (montoNumFmt) eightPercentCell.numFmt = montoNumFmt;
        eightPercentCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' },
        };

        // ============================================
        // Fila del TOTAL CON 8% - FONDO #C6E0B4, B: "TOTAL"
        // ============================================
        const totalWithEightRow = eightPercentRow + 1;
        const totalWithEightValue = employeeTotal + eightPercentValue;

        const totalWithEightLabelCell = newSheet.getCell(`B${totalWithEightRow}`);
        totalWithEightLabelCell.value = 'TOTAL';
        totalWithEightLabelCell.font = { ...colBFont };
        totalWithEightLabelCell.border = { ...colBBorder };
        totalWithEightLabelCell.alignment = { ...colBAlignment };
        totalWithEightLabelCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6E0B4' },
        };

        const totalWithEightCell = newSheet.getCell(`C${totalWithEightRow}`);
        totalWithEightCell.value = totalWithEightValue;
        totalWithEightCell.font = { ...montoFont };
        totalWithEightCell.border = { ...montoBorder };
        totalWithEightCell.alignment = { ...montoAlignment };
        if (montoNumFmt) totalWithEightCell.numFmt = montoNumFmt;
        totalWithEightCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6E0B4' },
        };

        // ============================================
        // COMPROBANTES ADJUNTOS (imágenes + links)
        // ============================================
        const archivosMap = new Map<string, Adjunto>();
        employeeDetails.forEach((detail) => {
          const adjuntos = parseArchivos(detail.Archivos ?? null);
          adjuntos.forEach((adj) => {
            if (!archivosMap.has(adj.url)) {
              archivosMap.set(adj.url, adj);
            }
          });
        });
        const archivos = Array.from(archivosMap.values());

        if (archivos.length > 0) {
          const titleRow = totalWithEightRow + 2;
          const titleCell = newSheet.getCell(`A${titleRow}`);
          titleCell.value = 'COMPROBANTES ADJUNTOS';
          titleCell.font = { bold: true, size: 12 };

          const imagenes = archivos.filter(isImageAdjunto);
          const otros = archivos.filter((a) => !isImageAdjunto(a));

          const COLS_IMAGENES = 3;
          const MAX_IMG_SIZE = 220;
          const ROW_HEIGHT_PX = 20;

          // Descargamos todas las imágenes primero
          const imagenesDescargadas: Array<{
            adjunto: Adjunto;
            buffer: Buffer | null;
            extension: 'jpeg' | 'png' | 'gif';
            width: number;
            height: number;
          }> = [];

          for (const adj of imagenes) {
            const buffer = await fetchImageBuffer(adj.url);
            const extension = getImageExtension(adj);

            let width = 0;
            let height = 0;
            if (buffer) {
              const size = getImageSize(buffer, extension);
              if (size) {
                const ratio = Math.min(
                  MAX_IMG_SIZE / size.width,
                  MAX_IMG_SIZE / size.height,
                  1
                );
                width = Math.max(1, Math.round(size.width * ratio));
                height = Math.max(1, Math.round(size.height * ratio));
              } else {
                width = MAX_IMG_SIZE;
                height = MAX_IMG_SIZE;
              }
            }

            imagenesDescargadas.push({
              adjunto: adj,
              buffer,
              extension,
              width,
              height,
            });
          }

          const imagesStartRow = titleRow + 1;

          // Filtrar solo las imágenes que se descargaron correctamente
          const imagenesValidas = imagenesDescargadas.filter((i) => i.buffer);

          // Calcular grupos y alturas solo con las válidas
          const rowGroups = Math.ceil(imagenesValidas.length / COLS_IMAGENES);

          const rowStepPerGroup: number[] = [];
          for (let g = 0; g < rowGroups; g++) {
            let maxHeightPx = ROW_HEIGHT_PX;
            for (let c = 0; c < COLS_IMAGENES; c++) {
              const item = imagenesValidas[g * COLS_IMAGENES + c];
              if (item && item.height > maxHeightPx) {
                maxHeightPx = item.height;
              }
            }
            rowStepPerGroup.push(Math.ceil(maxHeightPx / ROW_HEIGHT_PX));
          }

          const groupStartRows: number[] = [];
          let accumulated = imagesStartRow - 1; // 0-based
          for (let g = 0; g < rowGroups; g++) {
            groupStartRows.push(accumulated);
            accumulated += rowStepPerGroup[g];
          }

          // Insertar las imágenes
          imagenesValidas.forEach((item, i) => {
            try {
              const imageId = workbook.addImage({
                buffer: item.buffer as any,
                extension: item.extension,
              });

              const colIndex = i % COLS_IMAGENES;
              const rowGroup = Math.floor(i / COLS_IMAGENES);
              const targetRowIndex = groupStartRows[rowGroup];

              newSheet.addImage(imageId, {
                tl: { col: colIndex, row: targetRowIndex },
                ext: { width: item.width, height: item.height },
                editAs: 'oneCell',
              } as any);
            } catch (err) {
              console.error(`Error al embeber imagen ${item.adjunto.url}:`, err);
            }
          });

          // Reservar el espacio vertical
          for (let g = 0; g < rowGroups; g++) {
            const step = rowStepPerGroup[g];
            for (let r = 0; r < step; r++) {
              const rowNumber = (groupStartRows[g] + 1) + r;
              const row = newSheet.getRow(rowNumber);
              if (!row.height || row.height < ROW_HEIGHT_PX) {
                row.height = ROW_HEIGHT_PX;
              }
            }
          }

          // ============================================================
          // Otros archivos (PDFs, Excels, etc.) como hipervínculos
          // ============================================================
          if (otros.length > 0) {
            // CORRECCIÓN: calcular otrosStartRow de forma segura
            // cuando no hay imágenes (rowGroups === 0)
            let otrosStartRow: number;

            if (rowGroups === 0) {
              // No hay imágenes: los documentos van justo debajo del título
              otrosStartRow = imagesStartRow;
            } else {
              // Hay imágenes: los documentos van después del último grupo
              const lastGroupIndex = rowGroups - 1;
              otrosStartRow =
                groupStartRows[lastGroupIndex] +
                1 +                       // pasar a 1-based
                rowStepPerGroup[lastGroupIndex] +
                1;                        // una fila de separación
            }

            const otrosTitleCell = newSheet.getCell(`A${otrosStartRow}`);

            otros.forEach((adj, i) => {
              const row = otrosStartRow + i;
              const linkCell = newSheet.getCell(`A${row}`);
              linkCell.value = {
                text: `${adj.nombre}`,
                hyperlink: adj.url,
                tooltip: adj.url,
              } as any;
              linkCell.font = {
                color: { argb: 'FF0563C1' },
                underline: true,
              };
            });
          }
        }
      }

      // Eliminar la hoja ESQUELETO al final
      const esqueletoToRemove = workbook.getWorksheet("ESQUELETO");
      if (esqueletoToRemove) {
        workbook.removeWorksheet(esqueletoToRemove.id);
      }
    }

    // ============================================================
    // Forzar que el libro se abra en la PRIMERA hoja
    // ============================================================
    const firstSheet = workbook.getWorksheet(firstSheetId) || workbook.worksheets[0];
    if (firstSheet) {
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
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const safeProjectName = projectName
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);

    let fileName = `FT-GP-002-${safeProjectName}`;
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
    console.error("Error al generar FT-GP-002:", error);
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