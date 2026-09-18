import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { validateAndRenewSession } from '@/lib/auth';

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
    const [projectRows]: any = await connection.execute(
      `SELECT ProjectID, NameProject, ProjectBudget, ProjectType 
       FROM projects 
       WHERE ProjectID = ? AND AdminProjectID = ?`,
      [projectId, employeeId]
    );

    if (!projectRows || projectRows.length === 0) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado o no tienes acceso' },
        { status: 404 }
      );
    }

    const project = projectRows[0];

    // Obtener nombre del método de pago si se especificó filtro
    let metodoPagoFiltro = '';
    if (paymentMethod) {
      const [methodRows]: any = await connection.execute(
        'SELECT MethodName FROM paymentmethods WHERE MethodID = ?',
        [paymentMethod]
      );
      if (methodRows && methodRows.length > 0) {
        metodoPagoFiltro = methodRows[0].MethodName;
      }
    }

    const previewData: any = {
      tipoReporte: 'resumen',
      proyecto: project.NameProject,
      presupuesto: parseFloat(project.ProjectBudget) || 0,
      metodoPagoFiltro: metodoPagoFiltro || undefined
    };

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

    // Calcular utilidad
    previewData.utilidad = previewData.presupuesto - previewData.gastosTotales;
    previewData.porcentajeUtilidad =
      previewData.presupuesto > 0
        ? previewData.utilidad / previewData.presupuesto
        : 0;

    return NextResponse.json(previewData);

  } catch (error) {
    console.error('Error generando vista previa:', error);
    return NextResponse.json(
      { error: 'Error al generar la vista previa' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

interface TableDefinition {
  name: string;
  table: string;
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
  projectId: string,
  paymentMethod: string | null
): Promise<{ total: number; detalles: any[]; columnas: string[] }> {
  try {
    let query = ``;

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
    if (paymentMethod) {
      query += ` AND t.MethodID = ?`;
    }

    const queryParams: any[] = [projectId];
    if (paymentMethod) {
      queryParams.push(paymentMethod);
    }

    const [rows]: any = await connection.execute(query, queryParams);

    if (!rows || rows.length === 0) {
      return { total: 0, detalles: [], columnas: [] };
    }

    // Obtener columnas y mapear nombres
    const columnas = Object.keys(rows[0]).filter(
      col => !['ProjectID', 'Status', 'MethodID', 'Archivos'].includes(col)
    );

    // Calcular total
    const total = rows.reduce(
      (sum: number, row: any) => sum + (parseFloat(row.Total) || 0),
      0
    );

    // Formatear fechas y valores para la vista previa
    const detallesFormateados = rows.map((row: any) => {
      const detalle: any = {};
      columnas.forEach(col => {
        let value = row[col];

        // Formatear fechas
        if (value instanceof Date) {
          value = value.toISOString().split('T')[0]; // Formato YYYY-MM-DD
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