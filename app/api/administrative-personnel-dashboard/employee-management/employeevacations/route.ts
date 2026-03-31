import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

// Función para calcular años de antigüedad
const calcularAniosAntiguedad = (fechaInicio: string | Date): number => {
  if (!fechaInicio) return 0;
  
  const startDate = new Date(fechaInicio);
  const currentDate = new Date();
  
  let years = currentDate.getFullYear() - startDate.getFullYear();
  const monthDiff = currentDate.getMonth() - startDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < startDate.getDate())) {
    years--;
  }
  
  return years;
};

// Función para calcular días de vacaciones según años de antigüedad
const calcularDiasVacaciones = (aniosAntiguedad: number): number => {
  if (aniosAntiguedad >= 1 && aniosAntiguedad <= 5) {
    return 12 + (aniosAntiguedad - 1) * 2;
  } else if (aniosAntiguedad >= 6 && aniosAntiguedad <= 10) {
    return 22;
  } else if (aniosAntiguedad >= 11 && aniosAntiguedad <= 15) {
    return 24;
  } else if (aniosAntiguedad >= 16 && aniosAntiguedad <= 20) {
    return 26;
  } else if (aniosAntiguedad >= 21 && aniosAntiguedad <= 25) {
    return 28;
  } else if (aniosAntiguedad >= 26 && aniosAntiguedad <= 30) {
    return 30;
  } else if (aniosAntiguedad >= 31 && aniosAntiguedad <= 35) {
    return 32;
  } else if (aniosAntiguedad > 35) {
    return 32;
  } else {
    return 12; // Para antigüedad menor a 1 año
  }
};

// Función para normalizar texto a mayúsculas
const normalizarMayusculas = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase();
};

// GET: Obtener todos los empleados con sus períodos de vacaciones
export async function GET(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    connection = await getConnection();
    
    const [baseEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
        bp.BasePersonnelID,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bc.StartDate as ContractStartDate
      FROM basepersonnel bp
      INNER JOIN employees e ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
      ORDER BY bp.LastName, bp.FirstName
    `);

    // Procesar empleados para calcular antigüedad y días de vacaciones
    const employeesWithVacations = (baseEmployees as any[]).map(employee => {
      const yearsOfSeniority = calcularAniosAntiguedad(employee.ContractStartDate);
      const daysOfVacations = calcularDiasVacaciones(yearsOfSeniority);
      
      return {
        ...employee,
        YearsOfSeniority: yearsOfSeniority,
        DaysOfVacations: daysOfVacations
      };
    });

    return NextResponse.json(employeesWithVacations, { status: 200 });
    
  } catch (error) {
    console.error('Error fetching employees:', error);
    
    return NextResponse.json(
      { error: 'ERROR AL OBTENER LOS EMPLEADOS' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// POST: Crear un nuevo período de vacaciones
export async function POST(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    const body = await req.json();
    let { EmployeeID, Days, StartDate, Observations } = body;

    // Validaciones
    if (!EmployeeID || !Days || !StartDate) {
      return NextResponse.json(
        { message: 'ALGUNOS CAMPOS SON REQUERIDOS' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    
    // Iniciar transacción
    await connection.beginTransaction();
    
    try {
      // Obtener la fecha de inicio del contrato para calcular años de antigüedad
      const [contractResult] = await connection.execute(
        `SELECT bc.StartDate 
         FROM basecontracts bc 
         INNER JOIN basepersonnel bp ON bc.BasePersonnelID = bp.BasePersonnelID
         WHERE bp.EmployeeID = ?`,
        [EmployeeID]
      );

      if (!(contractResult as any[]).length) {
        throw new Error('NO SE ENCONTRÓ LA FECHA DE INICIO DEL CONTRATO');
      }

      const contractStartDate = (contractResult as any[])[0].StartDate;
      const yearsOfSeniority = calcularAniosAntiguedad(contractStartDate);
      const daysOfVacations = calcularDiasVacaciones(yearsOfSeniority);
      
      // Validar que los días solicitados sean válidos
      const daysToTake = parseFloat(Days);
      if (isNaN(daysToTake) || daysToTake <= 0) {
        throw new Error('LOS DÍAS DEBEN SER UN NÚMERO POSITIVO');
      }
      
      // Validar que los días solicitados no excedan los días disponibles
      if (daysToTake > daysOfVacations) {
        throw new Error(`LOS DÍAS SOLICITADOS (${Days}) EXCEDEN LOS DÍAS DISPONIBLES (${daysOfVacations})`);
      }

      // Validar que la fecha de inicio sea válida
      const startDateObj = new Date(StartDate);
      if (isNaN(startDateObj.getTime())) {
        throw new Error('LA FECHA DE INICIO NO ES VÁLIDA');
      }
      
      // Calcular fecha de término sumando los días a la fecha de inicio
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(endDateObj.getDate() + daysToTake);
      
      // Formatear fechas para MySQL
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      const formattedEndDate = endDateObj.toISOString().split('T')[0];
      
      // Insertar en employeevacations
      const [vacationResult] = await connection.execute(
        `INSERT INTO employeevacations 
         (EmployeeID, Days, StampedDays, StartDate, EndDate, Observations) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          EmployeeID, 
          Days, 
          Days, // StampedDays igual a Days
          formattedStartDate, 
          formattedEndDate, 
          Observations || ''
        ]
      );
      
      // Confirmar transacción
      await connection.commit();
      
      return NextResponse.json(
        { 
          message: 'PERÍODO DE VACACIONES CREADO EXITOSAMENTE',
          vacationId: (vacationResult as any).insertId,
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          yearsOfSeniority: yearsOfSeniority,
          daysOfVacations: daysOfVacations,
          success: true 
        },
        { status: 201 }
      );
      
    } catch (error) {
      // Revertir transacción en caso de error
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error creating vacation period:', error);
    
    return NextResponse.json(
      { 
        message: 'ERROR AL CREAR EL PERÍODO DE VACACIONES',
        error: error instanceof Error ? error.message : 'ERROR DESCONOCIDO'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

// PUT: Actualizar observaciones de vacaciones u obtener períodos de vacaciones
export async function PUT(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // Si action es 'get', obtener períodos de vacaciones
    if (action === 'get') {
      const employeeId = url.searchParams.get('employeeId');
      
      if (!employeeId) {
        return NextResponse.json(
          { error: 'ID DE EMPLEADO REQUERIDO' },
          { status: 400 }
        );
      }

      connection = await getConnection();
      
      const [vacations] = await connection.execute(
        `SELECT 
          ev.VacationID,
          ev.EmployeeID,
          ev.Days,
          ev.StampedDays,
          ev.StartDate,
          ev.EndDate,
          ev.Observations
         FROM employeevacations ev
         WHERE ev.EmployeeID = ?
         ORDER BY ev.StartDate DESC`,
        [employeeId]
      );
      
      return NextResponse.json(vacations, { status: 200 });
    }
    
    // Si action es 'update', actualizar observaciones
    if (action === 'update') {
      const body = await req.json();
      const { vacationId, observations } = body;
      
      if (!vacationId) {
        return NextResponse.json(
          { error: 'ID DE REGISTRO REQUERIDO' },
          { status: 400 }
        );
      }
      
      connection = await getConnection();
      
      await connection.execute(
        'UPDATE employeevacations SET Observations = ? WHERE VacationID = ?',
        [observations || '', vacationId]
      );
      
      return NextResponse.json(
        { 
          message: 'OBSERVACIONES ACTUALIZADAS EXITOSAMENTE',
          success: true 
        },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: 'ACCIÓN NO VÁLIDA' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error in PUT:', error);
    
    return NextResponse.json(
      { error: 'ERROR AL PROCESAR LA SOLICITUD' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}

// DELETE: Eliminar un período de vacaciones
export async function DELETE(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    const url = new URL(req.url);
    const vacationId = url.searchParams.get('id');
    
    if (!vacationId) {
      return NextResponse.json(
        { error: 'ID DE REGISTRO REQUERIDO' },
        { status: 400 }
      );
    }
    
    connection = await getConnection();
    
    await connection.execute(
      'DELETE FROM employeevacations WHERE VacationID = ?',
      [vacationId]
    );
    
    return NextResponse.json(
      { 
        message: 'PERÍODO DE VACACIONES ELIMINADO EXITOSAMENTE',
        success: true 
      },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('Error in DELETE:', error);
    
    return NextResponse.json(
      { error: 'ERROR AL ELIMINAR EL PERÍODO DE VACACIONES' },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}