// app/api/administrative-personnel-dashboard/employee-management/employeevacations/route.ts
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
    return 12;
  }
};

// Función para obtener los días totales usados en vacaciones
const getTotalUsedVacationDays = async (connection: any, employeeId: number): Promise<number> => {
  const [vacations] = await connection.execute(
    `SELECT SUM(Days) as totalUsed
     FROM employeevacations 
     WHERE EmployeeID = ?`,
    [employeeId]
  );
  
  return (vacations as any[])[0]?.totalUsed || 0;
};

// Función para generar y guardar el PDF del período de vacaciones (SOLO AL CREAR/ACTUALIZAR)
async function generateAndSaveVacationPDF(
  employeeId: number,
  vacationId: number,
  baseUrl: string,
  cookies?: string
): Promise<string | null> {
  try {
    console.log(`Generando PDF para EmployeeID: ${employeeId}, VacationID: ${vacationId}`);
    
    const url = `${baseUrl}/api/download/pdf/FT-RH-08?empleadoId=${employeeId}&vacationId=${vacationId}&save=1`;
    console.log('URL de generación:', url);
    
    const response = await fetch(url, {
      headers: {
        Cookie: cookies || ''
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error al generar PDF:', response.status, errorText);
      return null;
    }
    
    const result = await response.json();
    
    if (result.success && result.fileUrl) {
      console.log('PDF generado y URL obtenida:', result.fileUrl);
      return result.fileUrl;
    }
    
    console.log('No se pudo obtener la URL del PDF generado');
    return null;
  } catch (error) {
    console.error('Error en generateAndSaveVacationPDF:', error);
    return null;
  }
}

// Función para calcular fecha de término
const calculateEndDate = (startDate: string, days: number): string => {
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(startDateObj);
  endDateObj.setDate(endDateObj.getDate() + days);
  return endDateObj.toISOString().split('T')[0];
};

// GET: Obtener todos los empleados con sus períodos de vacaciones
export async function GET(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

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

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    const body = await req.json();
    let { EmployeeID, Days, StartDate, Observations } = body;

    if (!EmployeeID || !Days || !StartDate) {
      return NextResponse.json(
        { message: 'ALGUNOS CAMPOS SON REQUERIDOS' },
        { status: 400 }
      );
    }

    connection = await getConnection();
    
    await connection.beginTransaction();
    
    try {
      // Obtener fecha de inicio del contrato
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
      
      const daysToTake = parseFloat(Days);
      if (isNaN(daysToTake) || daysToTake <= 0) {
        throw new Error('LOS DÍAS DEBEN SER UN NÚMERO POSITIVO');
      }
      
      const totalUsedDays = await getTotalUsedVacationDays(connection, EmployeeID);
      const remainingDays = daysOfVacations - totalUsedDays;
      
      if (daysToTake > remainingDays) {
        throw new Error(`NO SE PUEDE AGREGAR EL PERÍODO. DÍAS DISPONIBLES: ${remainingDays}, DÍAS SOLICITADOS: ${daysToTake}`);
      }

      const startDateObj = new Date(StartDate);
      if (isNaN(startDateObj.getTime())) {
        throw new Error('LA FECHA DE INICIO NO ES VÁLIDA');
      }
      
      // Calcular fecha de término correctamente
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      const formattedEndDate = calculateEndDate(formattedStartDate, daysToTake);
      
      console.log('Fechas calculadas en POST:', {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        days: daysToTake
      });
      
      // Insertar registro sin FileURL por ahora
      const [vacationResult] = await connection.execute(
        `INSERT INTO employeevacations 
         (EmployeeID, Days, StampedDays, StartDate, EndDate, Observations, FileURL) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          EmployeeID, 
          Days, 
          Days,
          formattedStartDate, 
          formattedEndDate, 
          Observations || '',
          null
        ]
      );
      
      const insertedId = (vacationResult as any).insertId;
      
      // Confirmar la transacción
      await connection.commit();
      
      console.log(`Período de vacaciones creado con ID: ${insertedId}`);
      
      // Generar PDF después de confirmar la transacción
      let fileUrl = null;
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
        const cookies = req.headers.get('cookie') || '';
        
        fileUrl = await generateAndSaveVacationPDF(EmployeeID, insertedId, baseUrl, cookies);
        
        if (fileUrl) {
          console.log(`PDF generado exitosamente: ${fileUrl}`);
          // Actualizar FileURL en la base de datos
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE employeevacations SET FileURL = ? WHERE VacationID = ?`,
              [fileUrl, insertedId]
            );
            console.log(`URL actualizada en BD para VacationID: ${insertedId}`);
          } finally {
            await updateConnection.release();
          }
        } else {
          console.log('No se pudo generar el PDF');
        }
      } catch (pdfError) {
        console.error('Error al generar PDF:', pdfError);
      }
      
      // Obtener los días totales usados actualizados
      const updatedTotalUsedDays = await getTotalUsedVacationDays(connection, EmployeeID);
      
      return NextResponse.json(
        { 
          message: 'PERÍODO DE VACACIONES CREADO EXITOSAMENTE',
          vacationId: insertedId,
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          yearsOfSeniority: yearsOfSeniority,
          daysOfVacations: daysOfVacations,
          totalUsedDays: updatedTotalUsedDays,
          remainingDays: daysOfVacations - updatedTotalUsedDays,
          fileUrl: fileUrl,
          success: true 
        },
        { status: 201 }
      );
      
    } catch (error) {
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

// PUT: Actualizar observaciones o edición completa de vacaciones
export async function PUT(req: NextRequest) {
  let connection;
  
  try {
    const sessionId = req.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user || user.UserTypeID !== 2) {
      return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    
    // Obtener períodos de vacaciones de un empleado
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
          ev.Observations,
          ev.FileURL
         FROM employeevacations ev
         WHERE ev.EmployeeID = ?
         ORDER BY ev.StartDate DESC`,
        [employeeId]
      );
      
      return NextResponse.json(vacations, { status: 200 });
    }
    
    // Actualizar solo observaciones
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
    
    // Actualización completa del registro de vacaciones
    if (action === 'updatefull') {
      const body = await req.json();
      const { vacationId, EmployeeID, Days, StartDate, Observations } = body;
      
      if (!vacationId || !EmployeeID || !Days || !StartDate) {
        return NextResponse.json(
          { error: 'CAMPOS REQUERIDOS FALTANTES' },
          { status: 400 }
        );
      }
      
      connection = await getConnection();
      
      const startDateObj = new Date(StartDate);
      if (isNaN(startDateObj.getTime())) {
        return NextResponse.json(
          { error: 'LA FECHA DE INICIO NO ES VÁLIDA' },
          { status: 400 }
        );
      }
      
      const [originalRecord] = await connection.execute(
        'SELECT Days, FileURL FROM employeevacations WHERE VacationID = ?',
        [vacationId]
      );
      
      if (!(originalRecord as any[]).length) {
        return NextResponse.json(
          { error: 'REGISTRO NO ENCONTRADO' },
          { status: 404 }
        );
      }
      
      const originalDays = (originalRecord as any[])[0].Days;
      const oldFileUrl = (originalRecord as any[])[0].FileURL;
      
      const daysToTake = parseFloat(Days);
      if (isNaN(daysToTake) || daysToTake <= 0) {
        return NextResponse.json(
          { error: 'LOS DÍAS DEBEN SER UN NÚMERO POSITIVO' },
          { status: 400 }
        );
      }
      
      const [contractResult] = await connection.execute(
        `SELECT bc.StartDate 
         FROM basecontracts bc 
         INNER JOIN basepersonnel bp ON bc.BasePersonnelID = bp.BasePersonnelID
         WHERE bp.EmployeeID = ?`,
        [EmployeeID]
      );
      
      if (!(contractResult as any[]).length) {
        return NextResponse.json(
          { error: 'NO SE ENCONTRÓ LA FECHA DE INICIO DEL CONTRATO' },
          { status: 400 }
        );
      }
      
      const contractStartDate = (contractResult as any[])[0].StartDate;
      const yearsOfSeniority = calcularAniosAntiguedad(contractStartDate);
      const daysOfVacations = calcularDiasVacaciones(yearsOfSeniority);
      
      const totalUsedDays = await getTotalUsedVacationDays(connection, EmployeeID);
      const totalWithoutCurrent = totalUsedDays - originalDays;
      const remainingDays = daysOfVacations - totalWithoutCurrent;
      
      if (daysToTake > remainingDays) {
        return NextResponse.json(
          { 
            error: `NO SE PUEDE ACTUALIZAR EL PERÍODO. DÍAS DISPONIBLES: ${remainingDays}, DÍAS SOLICITADOS: ${daysToTake}` 
          },
          { status: 400 }
        );
      }
      
      // Calcular fecha de término correctamente
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      const formattedEndDate = calculateEndDate(formattedStartDate, daysToTake);
      
      console.log('Fechas calculadas en UPDATE:', {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        days: daysToTake
      });
      
      // Actualizar el registro
      await connection.execute(
        `UPDATE employeevacations 
         SET Days = ?, 
             StampedDays = ?, 
             StartDate = ?, 
             EndDate = ?, 
             Observations = ?,
             FileURL = NULL
         WHERE VacationID = ?`,
        [Days, Days, formattedStartDate, formattedEndDate, Observations || '', vacationId]
      );
      
      await connection.commit();
      
      // Generar nuevo PDF después de actualizar
      let newFileUrl = null;
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
        const cookies = req.headers.get('cookie') || '';
        newFileUrl = await generateAndSaveVacationPDF(EmployeeID, parseInt(vacationId), baseUrl, cookies);
        
        if (newFileUrl) {
          const updateConnection = await getConnection();
          try {
            await updateConnection.execute(
              `UPDATE employeevacations SET FileURL = ? WHERE VacationID = ?`,
              [newFileUrl, vacationId]
            );
            console.log(`URL actualizada para VacationID: ${vacationId}`);
          } finally {
            await updateConnection.release();
          }
        }
        
        // Eliminar archivo antiguo si existe y se generó uno nuevo
        if (oldFileUrl && newFileUrl) {
          try {
            const { UTApi } = await import('uploadthing/server');
            const utapi = new UTApi();
            const fileKey = oldFileUrl.match(/\/f\/([a-zA-Z0-9-_]+)/)?.[1];
            if (fileKey) {
              await utapi.deleteFiles([fileKey]);
              console.log(`Archivo antiguo eliminado: ${fileKey}`);
            }
          } catch (deleteError) {
            console.error('Error al eliminar archivo antiguo:', deleteError);
          }
        }
      } catch (pdfError) {
        console.error('Error al generar nuevo PDF:', pdfError);
      }
      
      return NextResponse.json(
        { 
          message: 'PERÍODO DE VACACIONES ACTUALIZADO EXITOSAMENTE',
          success: true,
          remainingDays: remainingDays - daysToTake,
          vacationId: vacationId,
          fileUrl: newFileUrl,
          startDate: formattedStartDate,
          endDate: formattedEndDate
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
    
    // Obtener FileURL antes de eliminar
    const [record] = await connection.execute(
      'SELECT FileURL FROM employeevacations WHERE VacationID = ?',
      [vacationId]
    );
    
    const fileUrl = (record as any[])[0]?.FileURL;
    
    await connection.execute(
      'DELETE FROM employeevacations WHERE VacationID = ?',
      [vacationId]
    );
    
    // Eliminar archivo de UploadThing si existe
    if (fileUrl) {
      try {
        const { UTApi } = await import('uploadthing/server');
        const utapi = new UTApi();
        const fileKey = fileUrl.match(/\/f\/([a-zA-Z0-9-_]+)/)?.[1];
        if (fileKey) {
          await utapi.deleteFiles([fileKey]);
          console.log(`Archivo eliminado de UploadThing: ${fileKey}`);
        }
      } catch (deleteError) {
        console.error('Error al eliminar archivo:', deleteError);
      }
    }
    
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