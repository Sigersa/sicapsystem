import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import * as ExcelJS from 'exceljs';

interface TableDefinition {
  name: string;
  table: string;
}

export async function POST(request: NextRequest) {
  let connection;

  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;
    
    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    
    if (!user) {
      return NextResponse.json({ error: "SESIÓN INVÁLIDA" }, { status: 401 });
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();

    // Parsear el cuerpo de la solicitud
    const body = await request.json();
    const { type, projectId, startDate, endDate, paymentMethod } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Debe especificar un tipo de reporte' },
        { status: 400 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema Sigersa';
    workbook.created = new Date();
    let reportName = 'reporte.xlsx';

    switch (type) {
      case 'resumen':
        if (!projectId) {
          return NextResponse.json(
            { error: 'Falta projectId' },
            { status: 400 }
          );
        }

        const [projectRows] = await connection.execute(
          'SELECT ProjectID, ProjectType, NameProject, ProjectBudget FROM projects WHERE ProjectID = ?',
          [projectId]
        );
        
        if (!projectRows || (projectRows as any[]).length === 0) {
          return NextResponse.json(
            { error: 'Proyecto no encontrado' },
            { status: 404 }
          );
        }
        
        const project = (projectRows as any[])[0];

        // Obtener nombre del método de pago si se especificó filtro
        let metodoPagoNombre = '';
        if (paymentMethod) {
          const [methodRows] = await connection.execute(
            'SELECT MethodName FROM paymentmethods WHERE MethodID = ?',
            [paymentMethod]
          );
          if (methodRows && (methodRows as any[]).length > 0) {
            metodoPagoNombre = (methodRows as any[])[0].MethodName;
          }
        }

        reportName = `resumen_proyecto_${projectId}`;
        if (paymentMethod) {
          const safeMethodName = metodoPagoNombre.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          reportName += `_${safeMethodName}`;
        }
        reportName += '.xlsx';

        const tables = getTablesByProjectType(project.ProjectType);
        const resumenSheet = workbook.addWorksheet('Resumen Gastos');
        prepararResumenGastos(resumenSheet);

        const resumenData: { categoria: string; total: number }[] = [];
        for (const { name, table } of tables) {
          const total = await exportTableToSheet(
            connection,
            workbook,
            name,
            table,
            projectId,
            paymentMethod
          );
          resumenData.push({ categoria: name, total });
        }

        llenarResumenGastos(resumenSheet, resumenData);

        // Agregar información del filtro si existe
        if (paymentMethod && metodoPagoNombre) {
          resumenSheet.addRow({});
          resumenSheet.addRow({ categoria: 'Filtro aplicado:', total: '' });
          resumenSheet.addRow({ categoria: 'Método de Pago', total: metodoPagoNombre });
        }
        break;

      case 'utilidad':
        if (!projectId) {
          return NextResponse.json(
            { error: 'Falta projectId' },
            { status: 400 }
          );
        }
        reportName = `utilidad_proyecto_${projectId}.xlsx`;

        const [utilProjectRows] = await connection.execute(
          'SELECT ProjectID, NameProject, ProjectBudget FROM projects WHERE ProjectID = ?',
          [projectId]
        );
        
        if (!utilProjectRows || (utilProjectRows as any[]).length === 0) {
          return NextResponse.json(
            { error: 'Proyecto no encontrado' },
            { status: 404 }
          );
        }
        
        const utilProject = (utilProjectRows as any[])[0];

        const totalGastos = await calculateTotalExpenses(
          connection,
          utilProject.ProjectID
        );
        
        const budget = parseFloat(String(utilProject.ProjectBudget));
        const utilidad = budget - totalGastos;
        const utilidadPorcentaje = budget > 0 ? (utilidad / budget) : 0;

        const utilidadSheet = workbook.addWorksheet('Utilidad');
        utilidadSheet.addRow(['Proyecto', utilProject.NameProject]);
        utilidadSheet.addRow(['Presupuesto', budget]);
        utilidadSheet.addRow(['Gastos Totales', totalGastos]);
        utilidadSheet.addRow(['Utilidad', utilidad]);
        utilidadSheet.addRow(['% Utilidad', utilidadPorcentaje]);

        // Aplicar formatos numéricos
        utilidadSheet.getColumn(2).numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
        utilidadSheet.getRow(5).getCell(2).numFmt = '0.00%';
        
        // Estilo para encabezados
        utilidadSheet.getRow(1).font = { bold: true };
        utilidadSheet.getRow(2).font = { bold: true };
        utilidadSheet.getRow(3).font = { bold: true };
        utilidadSheet.getRow(4).font = { bold: true };
        utilidadSheet.getRow(5).font = { bold: true };
        break;

      case 'rentabilidad':
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Faltan fechas de inicio o fin' },
            { status: 400 }
          );
        }
        reportName = `rentabilidad_${startDate}_${endDate}.xlsx`;

        const rentSheet = workbook.addWorksheet('Rentabilidad');
        rentSheet.columns = [
          { header: 'Proyecto', key: 'name', width: 30 },
          { header: 'Presupuesto', key: 'budget', width: 15 },
          { header: 'Gastos Totales', key: 'expenses', width: 15 },
          { header: 'Rentabilidad', key: 'profitability', width: 15 },
          { header: '% Rentabilidad', key: 'profit_percent', width: 15 }
        ];

        const [projectsRows] = await connection.execute(
          'SELECT ProjectID, NameProject, ProjectBudget FROM projects WHERE Status = 1'
        );

        for (const p of (projectsRows as any[])) {
          const gastos = await calculateTotalExpenses(
            connection,
            p.ProjectID,
            startDate,
            endDate
          );
          const budget = parseFloat(String(p.ProjectBudget));
          const profit = budget - gastos;
          const percent = budget > 0 ? (profit / budget) : 0;
          
          rentSheet.addRow({
            name: p.NameProject,
            budget: budget,
            expenses: gastos,
            profitability: profit,
            profit_percent: percent
          });
        }

        // Aplicar formatos numéricos
        rentSheet.getColumn(2).numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
        rentSheet.getColumn(3).numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
        rentSheet.getColumn(4).numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
        rentSheet.getColumn(5).numFmt = '0.00%';

        // Estilo para encabezados
        rentSheet.getRow(1).font = { bold: true };
        rentSheet.autoFilter = 'A1:E1';
        break;

      default:
        return NextResponse.json(
          { error: 'Tipo de reporte no válido' },
          { status: 400 }
        );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="${reportName}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });

  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json(
      { error: 'Error al generar el reporte' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

function getTablesByProjectType(projectType: number): TableDefinition[] {
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
    // Consultas específicas para cada tabla con orden de columnas personalizado
    let query = '';
    
    if (tableName === 'lodging') {
      query = `
        SELECT 
          t.LodgingID,
          t.PlaceAccommodation, 
          t.CheckInDate, 
          DATE_ADD(t.CheckInDate, INTERVAL t.Nights DAY) as CheckOutDate,
          t.Fee, 
          t.Nights, 
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'payroll') {
      query = `
        SELECT 
          t.PayrollID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'toolsequipment') {
      query = `
        SELECT 
          t.ToolsequipmentID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'personneltransfer') {
      query = `
        SELECT 
          t.PersonnelTransferID,
          t.Date,
          t.MeansOfTransportation,
          t.StartingPoint,
          t.ArrivalPoint,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'infrastructuretransfer') {
      query = `
        SELECT 
          t.InfrastructureTransferID,
          t.Date,
          t.Vehicle,
          t.StartingPoint,
          t.ArrivalPoint,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'loans') {
      query = `
        SELECT 
          t.LoansID,
          t.Date,
          t.Beneficiary,
          t.Total,
          t.FirstDiscount,
          t.NumberOfPayments,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'administrativeconsumable') {
      query = `
        SELECT 
          t.AdministrativeConsumableID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'epp') {
      query = `
        SELECT 
          t.EppID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'localtransportationfuel') {
      query = `
        SELECT 
          t.FuelID,
          t.Date,
          t.Vehicle,
          t.Liters,
          t.LiterCost,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'financingservices') {
      query = `
        SELECT 
          t.FinancingServicesID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'fuelclient') {
      query = `
        SELECT 
          t.FuelClientID,
          t.Date,
          t.Liters,
          t.LitersCost,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'consumableclient') {
      query = `
        SELECT 
          t.ConsumableClientID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'waterice') {
      query = `
        SELECT 
          t.WaterIceID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'operativeconsumable') {
      query = `
        SELECT 
          t.OperativeConsumableID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'infrastructureservices') {
      query = `
        SELECT 
          t.InfrastructureServiceID,
          t.Concept,
          t.Date,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'installationmaterials') {
      query = `
        SELECT 
          t.InstallationMaterialID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'outsourcedservices') {
      query = `
        SELECT 
          t.OutsourcedServiceID,
          t.Date,
          t.Concept,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'uniondues') {
      query = `
        SELECT 
          t.UnionDuesID,
          t.Date,
          t.Concept,
          t.StartDate,
          t.EndDate,
          t.Total,
          pm.MethodName,
          t.Observations,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else {
      // Consulta genérica para tablas no especificadas
      query = `
        SELECT 
          t.*,
          pm.MethodName,
          t.Archivos
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    }

    // Agregar filtro por método de pago si se especificó
    const queryParams: any[] = [projectId];
    if (paymentMethod) {
      query += ` AND t.MethodID = ?`;
      queryParams.push(paymentMethod);
    }

    const [rows] = await connection.execute(query, queryParams);
    
    if (!rows || (rows as any[]).length === 0) return 0;

    const sanitizedSheetName = sheetName
      .replace(/[*?:\\\/[\]]/g, ' ')
      .substring(0, 31)
      .trim();

    const sheet = workbook.addWorksheet(sanitizedSheetName);
    
    // Mapeo específico para cada tabla con orden consistente
    const columnTranslations: Record<string, Record<string, string>> = {
      lodging: {
        'LodgingID': 'ID Hospedaje',
        'PlaceAccommodation': 'Lugar de Hospedaje',
        'CheckInDate': 'Fecha Inicio',
        'CheckOutDate': 'Fecha Término',
        'Fee': 'Tarifa por Noche',
        'Nights': 'Noches',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      payroll: {
        'PayrollID': 'ID Nómina',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      toolsequipment: {
        'ToolsequipmentID': 'ID Herramienta/Equipo',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      personneltransfer: {
        'PersonnelTransferID': 'ID Traslado Personal',
        'Date': 'Fecha',
        'MeansOfTransportation': 'Medio de Transporte',
        'StartingPoint': 'Punto de Partida',
        'ArrivalPoint': 'Punto de Llegada',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      infrastructuretransfer: {
        'InfrastructureTransferID': 'ID Traslado Infraestructura',
        'Date': 'Fecha',
        'Vehicle': 'Vehículo',
        'StartingPoint': 'Punto de Partida',
        'ArrivalPoint': 'Punto de Llegada',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      loans: {
        'LoansID': 'ID Préstamo',
        'Date': 'Fecha',
        'Beneficiary': 'Beneficiario',
        'Total': 'Total',
        'FirstDiscount': 'Primer Descuento',
        'NumberOfPayments': 'Número de Pagos',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      administrativeconsumable: {
        'AdministrativeConsumableID': 'ID Consumible Administrativo',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      epp: {
        'EppID': 'ID EPP',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      localtransportationfuel: {
        'FuelID': 'ID Combustible',
        'Date': 'Fecha',
        'Vehicle': 'Vehículo',
        'Liters': 'Litros',
        'LiterCost': 'Costo por Litro',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      financingservices: {
        'FinancingServicesID': 'ID Servicio Financiamiento',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      fuelclient: {
        'FuelClientID': 'ID Combustible Cliente',
        'Date': 'Fecha',
        'Liters': 'Litros',
        'LitersCost': 'Costo por Litro',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      consumableclient: {
        'ConsumableClientID': 'ID Consumible Cliente',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      waterice: {
        'WaterIceID': 'ID Agua/Hielo',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      operativeconsumable: {
        'OperativeConsumableID': 'ID Consumible Operativo',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      infrastructureservices: {
        'InfrastructureServiceID': 'ID Servicio Infraestructura',
        'Concept': 'Concepto',
        'Date': 'Fecha',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      installationmaterials: {
        'InstallationMaterialID': 'ID Material Instalación',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      outsourcedservices: {
        'OutsourcedServiceID': 'ID Servicio Subcontratado',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      },
      uniondues: {
        'UnionDuesID': 'ID Cuota Sindical',
        'Date': 'Fecha',
        'Concept': 'Concepto',
        'StartDate': 'Fecha Inicio',
        'EndDate': 'Fecha Fin',
        'Total': 'Total',
        'MethodName': 'Método Pago',
        'Observations': 'Observaciones',
        'Archivos': 'Archivos'
      }
    };

    // Obtener columnas en el orden exacto de la consulta
    const allColumns = Object.keys((rows as any[])[0]);
    
    // Crear columnas en el orden específico
    sheet.columns = allColumns.map(key => ({ 
      header: columnTranslations[tableName]?.[key] || key, 
      key, 
      width: 20,
      style: key.toLowerCase().includes('date') ? { numFmt: 'dd/mm/yyyy' } : 
             key === 'Total' || key.toLowerCase().includes('cost') || key.toLowerCase().includes('fee') || 
             key.toLowerCase().includes('price') || key.toLowerCase().includes('amount') ? 
             { numFmt: '"$"#,##0.00;[Red]\-"$"#,##0.00' } : 
             undefined
    }));

    // Función para convertir valores a números cuando sea apropiado
    const parseNumericValue = (value: any, key: string): any => {
      if (value === null || value === undefined) return value;
      
      // Si es un campo numérico, convertirlo a número
      if (key === 'Total' || key.toLowerCase().includes('cost') || 
          key.toLowerCase().includes('fee') || key.toLowerCase().includes('price') || 
          key.toLowerCase().includes('amount') || key === 'Nights' || 
          key === 'Liters' || key === 'LiterCost' || key === 'LitersCost' ||
          key === 'FirstDiscount' || key === 'NumberOfPayments') {
        const num = parseFloat(value);
        return isNaN(num) ? value : num;
      }
      
      return value;
    };

    (rows as any[]).forEach((row: any) => {
      const rowData: Record<string, any> = {};
      
      // Procesar campos especiales
      allColumns.forEach(col => {
        if (col === 'Archivos' && row[col]) {
          try {
            const archivosData = JSON.parse(row[col]);
            if (Array.isArray(archivosData)) {
              rowData[col] = archivosData.map((a: any) => a.nombre).join(', ');
            } else {
              rowData[col] = row[col];
            }
          } catch {
            rowData[col] = row[col];
          }
        } else {
          // Convertir valores numéricos a números
          rowData[col] = parseNumericValue(row[col], col);
        }
      });
      
      sheet.addRow(rowData);
    });

    // Aplicar estilo de encabezado
    sheet.getRow(1).font = { bold: true };

    // Aplicar formato numérico a todas las filas para las columnas numéricas
    allColumns.forEach((col, colIndex) => {
      if (col === 'Total' || col.toLowerCase().includes('cost') || 
          col.toLowerCase().includes('fee') || col.toLowerCase().includes('price') || 
          col.toLowerCase().includes('amount')) {
        for (let i = 2; i <= (rows as any[]).length + 1; i++) {
          const cell = sheet.getCell(i, colIndex + 1);
          if (typeof cell.value === 'number') {
            cell.numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
          }
        }
      } else if (col.toLowerCase().includes('date')) {
        for (let i = 2; i <= (rows as any[]).length + 1; i++) {
          const cell = sheet.getCell(i, colIndex + 1);
          if (cell.value instanceof Date) {
            cell.numFmt = 'dd/mm/yyyy';
          }
        }
      }
    });

    return (rows as any[]).reduce((sum: number, r: any) => sum + (parseFloat(r.Total) || 0), 0);
  } catch (error) {
    console.error(`Error exportando ${tableName}:`, error);
    return 0;
  }
}

function prepararResumenGastos(sheet: ExcelJS.Worksheet): void {
  sheet.columns = [
    { header: "Categoría", key: "categoria", width: 40 },
    { header: "Total", key: "total", width: 20 }
  ];
  sheet.getRow(1).font = { bold: true };
}

function llenarResumenGastos(
  sheet: ExcelJS.Worksheet,
  resumenData: { categoria: string; total: number }[]
): void {
  let granTotal = 0;
  resumenData.forEach(item => {
    const row = sheet.addRow({ 
      categoria: item.categoria, 
      total: parseFloat(item.total.toString()) 
    });
    granTotal += item.total;
  });
  
  sheet.addRow({});
  const totalRow = sheet.addRow({ 
    categoria: "TOTAL GENERAL", 
    total: parseFloat(granTotal.toString()) 
  });
  totalRow.font = { bold: true };
  
  // Aplicar formato de moneda a la columna total
  sheet.getColumn(2).numFmt = '"$"#,##0.00;[Red]\-"$"#,##0.00';
}

async function calculateTotalExpenses(
  connection: any,
  projectId: number,
  startDate?: string,
  endDate?: string
): Promise<number> {
  const tableDateColumns: Record<string, string> = {
    lodging: 'CheckInDate',
    payroll: 'Date',
    toolsequipment: 'Date',
    personneltransfer: 'Date',
    infrastructuretransfer: 'Date',
    loans: 'Date',
    administrativeconsumable: 'Date',
    epp: 'Date',
    localtransportationfuel: 'Date',
    financingservices: 'Date',
    fuelclient: 'Date',
    consumableclient: 'Date',
    waterice: 'Date',
    operativeconsumable: 'Date',
    infrastructureservices: 'Date',
    installationmaterials: 'Date',
    outsourcedservices: 'Date',
    uniondues: 'Date'
  };

  const tables = Object.keys(tableDateColumns);
  let total = 0;
  
  for (const table of tables) {
    try {
      let query = `SELECT SUM(Total) as sumTotal FROM ${table} WHERE ProjectID = ? AND Status = 1`;
      const params: any[] = [projectId];

      if (startDate && endDate) {
        if (table === 'lodging') {
          query += ` AND (CheckInDate <= ? AND DATE_ADD(CheckInDate, INTERVAL Nights DAY) >= ?)`;
          params.push(endDate, startDate);
        } else {
          const dateColumn = tableDateColumns[table];
          query += ` AND ${dateColumn} BETWEEN ? AND ?`;
          params.push(startDate, endDate);
        }
      }

      const [rows] = await connection.execute(query, params);
      const tableTotal = parseFloat((rows as any[])[0]?.sumTotal) || 0;
      total += tableTotal;
    } catch (error) {
      console.error(`Error calculando total para tabla ${table}:`, error);
    }
  }
  
  return total;
}