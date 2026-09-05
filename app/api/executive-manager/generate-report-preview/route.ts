import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket } from 'mysql2';

interface TableDefinition {
  name: string;
  table: string;
}

interface ProjectRow extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
  ProjectBudget: string | number;
  ProjectType: number;
}

interface MethodRow extends RowDataPacket {
  MethodName: string;
}

interface TableDetailRow extends RowDataPacket {
  [key: string]: any;
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

    let previewData: any = {
      tipoReporte: type
    };

    switch (type) {
      case 'resumen':
        if (!projectId) {
          return NextResponse.json(
            { error: 'Falta projectId' },
            { status: 400 }
          );
        }

        const [projectRows] = await connection.execute(
          'SELECT ProjectID, NameProject, ProjectBudget, ProjectType FROM projects WHERE ProjectID = ?',
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
        let metodoPagoFiltro = '';
        if (paymentMethod) {
          const [methodRows] = await connection.execute(
            'SELECT MethodName FROM paymentmethods WHERE MethodID = ?',
            [paymentMethod]
          );
          if (methodRows && (methodRows as any[]).length > 0) {
            metodoPagoFiltro = (methodRows as any[])[0].MethodName;
          }
        }

        previewData.proyecto = project.NameProject;
        previewData.presupuesto = parseFloat(String(project.ProjectBudget));
        previewData.metodoPagoFiltro = metodoPagoFiltro || undefined;

        const tables = getTablesByProjectType(project.ProjectType);
        const categorias: any[] = [];

        for (const { name, table } of tables) {
          const { total, detalles, columnas } = await getTableDetails(
            connection,
            table,
            projectId,
            paymentMethod
          );
          if (total > 0 || detalles.length > 0) {
            categorias.push({ 
              categoria: name, 
              total,
              detalles,
              columnas 
            });
          }
        }

        previewData.categorias = categorias;
        previewData.gastosTotales = categorias.reduce((sum, cat) => sum + cat.total, 0);
        break;

      case 'utilidad':
        if (!projectId) {
          return NextResponse.json(
            { error: 'Falta projectId' },
            { status: 400 }
          );
        }

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

        previewData.proyecto = utilProject.NameProject;
        previewData.presupuesto = budget;
        previewData.gastosTotales = totalGastos;
        previewData.utilidad = utilidad;
        previewData.porcentajeUtilidad = utilidadPorcentaje;
        break;

      case 'rentabilidad':
        if (!startDate || !endDate) {
          return NextResponse.json(
            { error: 'Faltan fechas de inicio o fin' },
            { status: 400 }
          );
        }

        previewData.fechaInicio = startDate;
        previewData.fechaFin = endDate;

        const [projectsRows] = await connection.execute(
          'SELECT ProjectID, NameProject, ProjectBudget FROM projects WHERE Status = 1'
        );

        const proyectosRentabilidad = [];
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
          
          proyectosRentabilidad.push({
            proyecto: p.NameProject,
            presupuesto: budget,
            gastos: gastos,
            rentabilidad: profit,
            porcentaje: percent
          });
        }

        previewData.proyectosRentabilidad = proyectosRentabilidad;
        break;

      default:
        return NextResponse.json(
          { error: 'Tipo de reporte no válido' },
          { status: 400 }
        );
    }

    return NextResponse.json(previewData);

  } catch (error) {
    console.error('Error generando vista previa:', error);
    return NextResponse.json(
      { error: 'Error al generar la vista previa' },
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

async function getTableDetails(
  connection: any,
  tableName: string,
  projectId: number | string,
  paymentMethod: string | null
): Promise<{total: number, detalles: any[], columnas: string[]}> {
  try {
    let query = '';
    
    // Consultas específicas para cada tabla con nombres de columnas correctos
    if (tableName === 'lodging') {
      query = `
        SELECT 
          t.LodgingID,
          t.PlaceAccommodation as 'Lugar de Hospedaje', 
          t.CheckInDate as 'Fecha Inicio', 
          DATE_ADD(t.CheckInDate, INTERVAL t.Nights DAY) as 'Fecha Término',
          t.Fee as 'Tarifa por Noche', 
          t.Nights as 'Noches', 
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'payroll') {
      query = `
        SELECT 
          t.PayrollID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'toolsequipment') {
      query = `
        SELECT 
          t.ToolsequipmentID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'personneltransfer') {
      query = `
        SELECT 
          t.PersonnelTransferID,
          t.Date as 'Fecha',
          t.MeansOfTransportation as 'Medio de Transporte',
          t.StartingPoint as 'Punto de Partida',
          t.ArrivalPoint as 'Punto de Llegada',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'infrastructuretransfer') {
      query = `
        SELECT 
          t.InfrastructureTransferID,
          t.Date as 'Fecha',
          t.Vehicle as 'Vehículo',
          t.StartingPoint as 'Punto de Partida',
          t.ArrivalPoint as 'Punto de Llegada',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'loans') {
      query = `
        SELECT 
          t.LoansID,
          t.Date as 'Fecha',
          t.Beneficiary as 'Beneficiario',
          t.Total as 'Total',
          t.FirstDiscount as 'Primer Descuento',
          t.NumberOfPayments as 'Número de Pagos',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'administrativeconsumable') {
      query = `
        SELECT 
          t.AdministrativeConsumableID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'epp') {
      query = `
        SELECT 
          t.EppID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'localtransportationfuel') {
      query = `
        SELECT 
          t.FuelID,
          t.Date as 'Fecha',
          t.Vehicle as 'Vehículo',
          t.Liters as 'Litros',
          t.LiterCost as 'Costo por Litro',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'financingservices') {
      query = `
        SELECT 
          t.FinancingServicesID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'fuelclient') {
      query = `
        SELECT 
          t.FuelClientID,
          t.Date as 'Fecha',
          t.Liters as 'Litros',
          t.LitersCost as 'Costo por Litro',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'consumableclient') {
      query = `
        SELECT 
          t.ConsumableClientID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'waterice') {
      query = `
        SELECT 
          t.WaterIceID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'operativeconsumable') {
      query = `
        SELECT 
          t.OperativeConsumableID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'infrastructureservices') {
      query = `
        SELECT 
          t.InfrastructureServiceID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'installationmaterials') {
      query = `
        SELECT 
          t.InstallationMaterialID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'outsourcedservices') {
      query = `
        SELECT 
          t.OutsourcedServiceID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else if (tableName === 'uniondues') {
      query = `
        SELECT 
          t.UnionDuesID,
          t.Date as 'Fecha',
          t.Concept as 'Concepto',
          t.Total as 'Total',
          pm.MethodName as 'Método Pago',
          t.Observations as 'Observaciones'
        FROM ${tableName} t 
        LEFT JOIN paymentmethods pm ON t.MethodID = pm.MethodID 
        WHERE t.ProjectID = ? AND t.Status = 1
      `;
    } else {
      // Consulta genérica para tablas no especificadas
      query = `
        SELECT 
          t.*,
          pm.MethodName as 'Método Pago'
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
    
    if (!rows || (rows as any[]).length === 0) {
      return { total: 0, detalles: [], columnas: [] };
    }

    // Obtener columnas y mapear nombres
    const columnas = Object.keys((rows as any[])[0]).filter(col => 
      !['ProjectID', 'Status', 'MethodID', 'Archivos'].includes(col)
    );

    // Calcular total
    const total = (rows as any[]).reduce((sum: number, row: any) => sum + (parseFloat(row.Total) || 0), 0);

    // Formatear fechas y valores para la vista previa
    const detallesFormateados = (rows as any[]).map((row: any) => {
      const detalle: any = {};
      columnas.forEach(col => {
        let value = row[col];
        
        // Formatear fechas
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0];
        }
        
        // Formatear valores numéricos
        if (typeof value === 'number' && col.toLowerCase().includes('total')) {
          value = parseFloat(value.toFixed(2));
        }
        
        detalle[col] = value;
      });
      return detalle;
    });

    return {
      total,
      detalles: detallesFormateados,
      columnas
    };
  } catch (error) {
    console.error(`Error obteniendo detalles para tabla ${tableName}:`, error);
    return { total: 0, detalles: [], columnas: [] };
  }
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