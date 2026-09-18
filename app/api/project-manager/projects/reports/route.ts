import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';
import * as ExcelJS from 'exceljs';

// Helper para validar sesión
async function getAuthenticatedUser(request: NextRequest) {
  const sessionId = request.cookies.get('session')?.value;
  if (!sessionId) return null;
  return await validateAndRenewSession(sessionId);
}

export async function GET(request: NextRequest) {
  let connection;

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const paymentMethod = searchParams.get('paymentMethod');

    if (!projectId) {
      return NextResponse.json({ error: 'ProjectID es requerido' }, { status: 400 });
    }

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = user.EmployeeID;

    connection = await getConnection();

    // Validar que el usuario tenga acceso a este proyecto
    const [projectData]: any = await connection.execute(
      `SELECT ProjectID, ProjectType, NameProject 
       FROM projects 
       WHERE ProjectID = ? AND AdminProjectID = ?`,
      [projectId, employeeId]
    );

    if (!projectData || projectData.length === 0) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o no tienes acceso' },
        { status: 404 }
      );
    }

    const { ProjectType, NameProject } = projectData[0];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema GERSA';
    workbook.created = new Date();

    const tables = getTablesByProjectType(ProjectType);

    // Primero creamos la hoja de resumen vacía
    const resumenSheet = workbook.addWorksheet("Resumen Gastos");
    prepararResumenGastos(resumenSheet);

    const resumenData: { categoria: string; total: number }[] = [];
    for (const { name, table } of tables) {
      const total = await exportTableToSheet(
        connection,
        workbook,
        name,
        table,
        parseInt(projectId),
        paymentMethod
      );
      resumenData.push({ categoria: name, total });
    }

    if (resumenData.length > 0 && resumenData.some(r => r.total > 0)) {
      // Actualizamos la hoja de resumen con los datos
      llenarResumenGastos(resumenSheet, resumenData);

      // Reordenamos las hojas para que el resumen quede primero
      workbook.worksheets.sort((a, b) => {
        if (a.name === "Resumen Gastos") return -1;
        if (b.name === "Resumen Gastos") return 1;
        return 0;
      });
    } else {
      return NextResponse.json(
        { error: 'No se encontraron datos para exportar' },
        { status: 404 }
      );
    }

    const buffer = await workbook.xlsx.writeBuffer();

    // Usar el nombre real del proyecto para el archivo
    const safeProjectName = NameProject.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    // Agregar información del filtro al nombre del archivo si aplica
    let reportName = `reporte_gastos_${safeProjectName}`;
    if (paymentMethod) {
      const [methodData]: any = await connection.execute(
        'SELECT MethodName FROM paymentmethods WHERE MethodID = ?',
        [paymentMethod]
      );
      if (methodData && methodData.length > 0) {
        const methodName = methodData[0].MethodName
          .replace(/[^a-zA-Z0-9]/g, '_')
          .toLowerCase();
        reportName += `_${methodName}`;
      }
    }
    reportName += '.xlsx';

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename=${reportName}`);
    headers.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return new NextResponse(buffer as any, { status: 200, headers });

  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json(
      { error: 'Error al generar el reporte' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

function getTablesByProjectType(projectType: number) {
  if (projectType === 1) {
    return [
      { name: 'Hospedajes', table: 'lodging' },
      { name: 'Nóminas', table: 'payroll' },
      { name: 'Herramientas/Equipos', table: 'toolsequipment' },
      { name: 'Traslado de Personal a Sitio', table: 'personneltransfer' },
      { name: 'Traslado Infraestructura', table: 'infrastructuretransfer' },
      { name: 'Préstamos', table: 'loans' },
      { name: 'Consumibles Administrativos', table: 'administrativeconsumable' },
      { name: 'EPP', table: 'epp' },
      { name: 'Combustible de Transportación Local', table: 'localtransportationfuel' },
      { name: 'Servicios de financiamiento (Cliente)', table: 'financingservices' },
      { name: 'Combustible (Cliente)', table: 'fuelclient' },
      { name: 'Consumibles (Cliente)', table: 'consumableclient' },
      { name: 'Agua y Hielo (Cliente)', table: 'waterice' }
    ];
  } else {
    return [
      { name: 'Hospedajes', table: 'lodging' },
      { name: 'Nóminas', table: 'payroll' },
      { name: 'Herramientas/Equipos', table: 'toolsequipment' },
      { name: 'Traslado de Personal a Sitio', table: 'personneltransfer' },
      { name: 'Traslado de Infraestructura', table: 'infrastructuretransfer' },
      { name: 'Préstamos', table: 'loans' },
      { name: 'Consumibles Administrativos', table: 'administrativeconsumable' },
      { name: 'EPP', table: 'epp' },
      { name: 'Consumibles Operativos', table: 'operativeconsumable' },
      { name: 'Combustible de Transportación Local', table: 'localtransportationfuel' },
      { name: 'Servicios de Financiamiento (Cliente)', table: 'financingservices' },
      { name: 'Servicios de Infraestructura en Sitio', table: 'infrastructureservices' },
      { name: 'Materiales de Instalación', table: 'installationmaterials' },
      { name: 'Servicios Subcontratados', table: 'outsourcedservices' },
      { name: 'Cuotas Sindicales', table: 'uniondues' }
    ];
  }
}

async function exportTableToSheet(
  connection: any,
  workbook: ExcelJS.Workbook,
  sheetName: string,
  tableName: string,
  projectId: number,
  paymentMethod: string | null
): Promise<number> {
  try {
    // Verificar si la tabla tiene columna EmployeeID (nueva estructura)
    const [checkColumns]: any = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = ? 
         AND COLUMN_NAME = 'EmployeeID'`,
      [tableName]
    );

    const hasEmployeeId = checkColumns.length > 0;

    let query = `
      SELECT 
        t.*,
        p.NameProject as NombreProyecto,
        pm.MethodName as MetodoPago
        ${hasEmployeeId ? ', e.FirstName as NombreUsuario' : ''}
      FROM ${tableName} t
      LEFT JOIN projects p ON t.ProjectID = p.ProjectID
      LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID
      ${hasEmployeeId ? 'LEFT JOIN employees e ON t.EmployeeID = e.EmployeeID' : ''}
      WHERE t.ProjectID = ? AND t.Status = 1
    `;

    const queryParams: any[] = [projectId];

    // Agregar filtro por método de pago si se especificó
    if (paymentMethod) {
      query += ` AND t.MethodID = ?`;
      queryParams.push(paymentMethod);
    }

    const [rows]: any = await connection.execute(query, queryParams);
    if (!rows || rows.length === 0) return 0;

    // Ajuste para lodging (CheckOutDate)
    if (tableName === 'lodging') {
      rows.forEach((row: any) => {
        if (row.CheckInDate && row.Nights) {
          const checkIn = new Date(row.CheckInDate);
          checkIn.setDate(checkIn.getDate() + Number(row.Nights));
          row.CheckOutDate = checkIn;
        }
      });
    }

    const safeSheetName = sheetName.replace(/[\\/*?:[\]]/g, "_").substring(0, 31);
    const sheet = workbook.addWorksheet(safeSheetName);

    const excludedColumns = [
      'Status', 'ProjectID', 'MethodID', 'EmployeeID', 'UserID',
      'createdAt', 'updatedAt', 'id', 'status',
      'SessionID', 'SessionToken', 'ExpiresAt', 'LastActivity'
    ];

    const allColumns = Object.keys(rows[0]).filter(key => !excludedColumns.includes(key));
    const columnKeys = getColumnOrder(tableName, allColumns);

    // Definir las columnas con sus formatos
    sheet.columns = columnKeys.map(key => {
      const columnDef: Partial<ExcelJS.Column> = {
        header: formatHeader(key),
        key,
        width: 20
      };

      // Aplicar formato numérico a columnas monetarias
      if (
        key.toLowerCase().includes('total') ||
        key.toLowerCase().includes('amount') ||
        key.toLowerCase().includes('fee') ||
        key.toLowerCase().includes('price')
      ) {
        columnDef.style = { numFmt: '"$"#,##0.00;[Red]-"$"#,##0.00' };
      }

      // Aplicar formato de fecha
      if (key.toLowerCase().includes('date')) {
        columnDef.style = { numFmt: 'dd/mm/yyyy' };
      }

      return columnDef;
    });

    sheet.getRow(1).font = { bold: true };

    let totalTabla = 0;
    rows.forEach((row: any) => {
      const rowData: Record<string, any> = {};
      columnKeys.forEach(key => {
        rowData[key] = formatCellValue(row[key], key);
      });
      const addedRow = sheet.addRow(rowData);

      // Aplicar formato a celdas específicas después de agregar la fila
      columnKeys.forEach((key, colIndex) => {
        const cell = addedRow.getCell(colIndex + 1);

        if (
          key.toLowerCase().includes('total') ||
          key.toLowerCase().includes('amount') ||
          key.toLowerCase().includes('fee') ||
          key.toLowerCase().includes('price')
        ) {
          if (!isNaN(parseFloat(cell.value?.toString() || ''))) {
            cell.numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
          }
        }

        if (key.toLowerCase().includes('date') && cell.value instanceof Date) {
          cell.numFmt = 'dd/mm/yyyy';
        }
      });

      totalTabla += Number(row['Total'] ?? row['Amount'] ?? 0) || 0;
    });

    // Ajustar el ancho de las columnas
    sheet.columns.forEach(column => {
      if (!column.key || !column.values) return;
      const headerLength = column.header?.toString().length || 0;
      const dataLength = Math.max(
        ...column.values.slice(1).map((v: any) => (v ? v.toString().length : 0))
      );
      column.width = Math.min(Math.max(headerLength, dataLength) + 2, 50);
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return totalTabla;

  } catch (error) {
    console.error(`Error al exportar ${tableName}:`, error);
    return 0;
  }
}

function getColumnOrder(tableName: string, allColumns: string[]): string[] {
  const tableIdCol = allColumns.find(c =>
    c.toLowerCase().endsWith('id') &&
    c !== 'ProjectID' &&
    c !== 'MethodID'
  );

  const startColumns = ['NombreProyecto', tableIdCol || ''];
  const endColumns = ['Observations', 'Archivos'];

  switch (tableName) {
    case 'lodging':
      return [
        ...startColumns,
        'PlaceAccommodation',
        'MetodoPago',
        'CheckInDate',
        'CheckOutDate',
        'Fee',
        'Nights',
        'Total',
        ...endColumns
      ].filter(c => c && (allColumns.includes(c) || c === 'CheckOutDate'));

    case 'infrastructureservices':
      return [
        ...startColumns,
        'Date',
        'Concept',
        'MetodoPago',
        'Total',
        ...endColumns
      ].filter(c => c && allColumns.includes(c));

    default:
      const middleColumns = ['Date', 'Concept', 'MetodoPago'].filter(c =>
        allColumns.includes(c)
      );

      return [
        ...startColumns,
        ...middleColumns,
        ...allColumns.filter(
          c =>
            !startColumns.includes(c) &&
            !middleColumns.includes(c) &&
            !endColumns.includes(c)
        ),
        ...endColumns.filter(c => allColumns.includes(c))
      ];
  }
}

function formatCellValue(value: any, key: string = ''): any {
  // Convertir strings numéricos a number para columnas monetarias
  if (
    typeof value === 'string' &&
    !isNaN(parseFloat(value)) &&
    (key.toLowerCase().includes('total') ||
      key.toLowerCase().includes('amount') ||
      key.toLowerCase().includes('fee') ||
      key.toLowerCase().includes('price'))
  ) {
    return parseFloat(value);
  }

  if (value instanceof Date) {
    return value;
  } else if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  } else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => item.nombre || item.name || item)
          .join(', ');
      }
    } catch {}
  }
  return value ?? '';
}

function prepararResumenGastos(sheet: ExcelJS.Worksheet) {
  sheet.columns = [
    { header: 'Categoría', key: 'categoria', width: 40 },
    {
      header: 'Total',
      key: 'total',
      width: 20,
      style: { numFmt: '"$"#,##0.00;[Red]-"$"#,##0.00' }
    }
  ];
  sheet.getRow(1).font = { bold: true };
}

function llenarResumenGastos(
  sheet: ExcelJS.Worksheet,
  resumenData: { categoria: string; total: number }[]
) {
  // Limpiar datos existentes (excepto encabezados)
  while (sheet.rowCount > 1) {
    sheet.spliceRows(2, 1);
  }

  let granTotal = 0;
  resumenData.forEach(item => {
    const row = sheet.addRow({ categoria: item.categoria, total: item.total });
    row.getCell('total').numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    granTotal += item.total;
  });

  sheet.addRow({});
  const totalRow = sheet.addRow({ categoria: 'TOTAL GENERAL', total: granTotal });
  totalRow.font = { bold: true };
  totalRow.getCell('total').numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
}

function formatHeader(key: string): string {
  const headerMap: Record<string, string> = {
    NombreProyecto: 'Proyecto',
    MetodoPago: 'Método de Pago',
    NombreUsuario: 'Usuario',
    Date: 'Fecha',
    Concept: 'Concepto',
    Total: 'Total',
    Observations: 'Observaciones',
    PlaceAccommodation: 'Lugar de Alojamiento',
    CheckInDate: 'Fecha de Inicio',
    CheckOutDate: 'Fecha de Término',
    Fee: 'Tarifa',
    Nights: 'Noches',
    Archivos: 'Archivos Adjuntos',
    InfrastructureServiceID: 'ID Servicio Infraestructura'
  };
  return headerMap[key] || key;
}