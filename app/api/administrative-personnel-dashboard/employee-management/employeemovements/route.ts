// app/api/administrative-personnel-dashboard/employee-management/employeepermissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { UTApi } from 'uploadthing/server';
import os from "os";
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import ConvertAPI from "convertapi";

const convertapi = new ConvertAPI(process.env.CONVERTAPI_SECRET!);
const utapi = new UTApi();

// Función para formatear fecha correctamente para MySQL (YYYY-MM-DD)
const formatearFechaMySQL = (fecha: string): string | null => {
  if (!fecha) return null;
  
  try {
    if (fecha.includes('T')) {
      return fecha.split('T')[0];
    }
    return fecha;
  } catch {
    return null;
  }
};

// Función para generar el PDF FT-RH-09
async function generatePermissionPDF(
  movementId: number
): Promise<{ pdfBuffer: ArrayBuffer; fileUrl: string }> {
  const tempExcelPath = path.join(
    os.tmpdir(),
    `FT-RH-10-${Date.now()}-${movementId}.xlsx`
  );
  const tempPdfPath = path.join(
    os.tmpdir(),
    `FT-RH-10-${Date.now()}-${movementId}.pdf`
  );

  let connection;

  try {
    connection = await getConnection();

    // Obtener información del permiso y del empleado
    const [rows] = await connection.execute<any[]>(
      `SELECT 
        em.MovementID,
        em.EmployeeID,
        em.MovementType,
        em.Specification,
        em.ApplicationDate,
        em.Duration,
        em.Former,
        em.New,
        em.StartDate,
        em.EndDate,
        em.Observations,
        bp.Area,
        pj.NameProject,
        -- Datos del empleado
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        COALESCE(bc.StartDate, pc.StartDate) as StartDatee,
        COALESCE(bpi.CURP, ppi.CURP) as CURP,
        COALESCE(bpi.RFC, ppi.RFC) as RFC,
        COALESCE(bpi.NSS, ppi.NSS) as NSS,
        -- Jefe directo
        COALESCE(jefe_bp.FirstName, jefe_pp.FirstName) as JefeFirstName,
        COALESCE(jefe_bp.LastName, jefe_pp.LastName) as JefeLastName,
        COALESCE(jefe_bp.MiddleName, jefe_pp.MiddleName) as JefeMiddleName,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeemovement em
      -- Datos del empleado (BASE)
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      -- Datos del empleado (PROJECT)
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
      LEFT JOIN projects pj ON pc.ProjectID = pj.ProjectID
      -- Jefe directo (BASE)
      LEFT JOIN basepersonnel jefe_bp ON bc.jefeDirectoId = jefe_bp.EmployeeID
      -- Jefe directo (PROJECT)
      LEFT JOIN projectpersonnel jefe_pp ON pc.jefeDirectoId = jefe_pp.EmployeeID
      WHERE em.MovementID = ?`,
      [movementId]
    );

    if (!rows || rows.length === 0) {
      throw new Error(`Registro de movimiento con ID ${movementId} no encontrado`);
    }

    const mov = rows[0];

   const employeeName = [
      mov.FirstName || '',
      mov.LastName || '',
      mov.MiddleName || ''
    ].filter(part => part && part.trim() !== '').join(' ').trim() || 'NO ESPECIFICADO';

     // Construir nombre completo del jefe directo
    const jefeDirectoNombre = [
      mov.JefeFirstName || '',
      mov.JefeLastName || '',
      mov.JefeMiddleName || ''
    ].filter(part => part.trim() !== '').join(' ') || "NO ESPECIFICADO";

    const formatDate = (dateValue: any): string => {
      if (!dateValue) return 'NO ESPECIFICADO';
    
    
 
      try {
        const date = new Date(dateValue);
        // Verificar si es una fecha válida
        if (isNaN(date.getTime())) {
          return 'NO ESPECIFICADO';
        }
        // Usar el mismo formato que en FT-RH-21: toLocaleDateString('es-MX')
        return date.toLocaleDateString('es-MX');
      } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'NO ESPECIFICADO';
      }
    };

    // Cargar plantilla Excel
        const templatePath = path.join(
          process.cwd(),
          "public",
          "administrative-personnel-dashboard",
          "personnel-management",
          "FT-RH-10.xlsx"
        );
    
        
    if (!fs.existsSync(templatePath)) {
      throw new Error('Plantilla FT-RH-09 no encontrada en: ' + templatePath);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

     ws.getCell('A6').value = mov.EmployeeID || 'NO ESPECIFICADO';
        ws.getCell('C6').value = mov.LastName || 'NO ESPECIFICADO';
        ws.getCell('H6').value = mov.MiddleName || 'NO ESPECIFICADO';
        ws.getCell('N6').value = mov.FirstName || 'NO ESPECIFICADO';
        ws.getCell('A9').value = mov.Position || 'NO ESPECIFICADO';
        ws.getCell('G9').value = mov.Area || 'N/A';
        ws.getCell('N9').value = mov.NameProject || 'N/A';
        ws.getCell('A12').value = mov.CURP || 'NO ESPECIFICADO';
        ws.getCell('F12').value = mov.RFC || 'NO ESPECIFICADO';
        ws.getCell('L12').value = mov.NSS || 'NO ESPECIFICADO'
        ws.getCell('P12').value = formatDate(mov.StartDatee) || 'NO ESPECIFICADO';
        if (mov.MovementType){
          const tipomovimiento = mov.MovementType.toUpperCase().trim();
          if (tipomovimiento === "PUESTO")  {
            ws.getCell("C16").value = mov.Specification;
            ws.getCell("G16").value = formatDate(mov.ApplicationDate);
            ws.getCell("I16").value = mov.Duration;
            ws.getCell("K16").value = mov.Former;
            ws.getCell("N16").value = mov.New;
            ws.getCell("P16").value = formatDate(mov.StartDate);
            ws.getCell("R16").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "SUELDO"){
            ws.getCell("C18").value = mov.Specification;
            ws.getCell("G18").value = formatDate(mov.ApplicationDate);
            ws.getCell("I18").value = mov.Duration;
            ws.getCell("K18").value = mov.Former;
            ws.getCell("N18").value = mov.New;
            ws.getCell("P18").value = formatDate(mov.StartDate);
            ws.getCell("R18").value = formatDate(mov.EndDate);
          } 
          else if (tipomovimiento === "PROYECTO/AREA")  {
            ws.getCell("C20").value = mov.Specification;
            ws.getCell("G20").value = formatDate(mov.ApplicationDate);
            ws.getCell("I20").value = mov.Duration; 
            ws.getCell("K20").value = mov.Former;
            ws.getCell("N20").value = mov.New;
            ws.getCell("P20").value = formatDate(mov.StartDate);
            ws.getCell("R20").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "VACACIONES") {
            ws.getCell("C22").value = mov.Specification;
            ws.getCell("G22").value = formatDate(mov.ApplicationDate);
            ws.getCell("I22").value = mov.Duration;
            ws.getCell("K22").value = mov.Former;
            ws.getCell("N22").value = mov.New;
            ws.getCell("P22").value = formatDate(mov.StartDate);
            ws.getCell("R22").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "COMISION") {
            ws.getCell("C24").value = mov.Specification;
            ws.getCell("G24").value = formatDate(mov.ApplicationDate);
            ws.getCell("I24").value = mov.Duration;
            ws.getCell("K24").value = mov.Former;
            ws.getCell("N24").value = mov.New;  
            ws.getCell("P24").value = formatDate(mov.StartDate);
            ws.getCell("R24").value = formatDate(mov.EndDate);
          }
          else if (tipomovimiento === "OTROS") {
            ws.getCell("C26").value = mov.Specification;
            ws.getCell("G26").value = formatDate(mov.ApplicationDate);
            ws.getCell("I26").value = mov.Duration;
            ws.getCell("K26").value = mov.Former;
            ws.getCell("N26").value = mov.New;
            ws.getCell("P26").value = formatDate(mov.StartDate);
            ws.getCell("R26").value = formatDate(mov.EndDate);
          }
          
        }
        ws.getCell('A30').value = mov.Observations || 'NO ESPECIFICADO';
        ws.getCell('B37').value = employeeName || 'NO ESPECIFICADO';
        ws.getCell('M37').value = jefeDirectoNombre || 'NO ESPECIFICADO';


    // Guardar Excel temporal
    await workbook.xlsx.writeFile(tempExcelPath);

    // Convertir a PDF usando ConvertAPI
    const result = await convertapi.convert("pdf", {
      File: tempExcelPath,
    });

    // Descargar el PDF
    const pdfResponse = await fetch(result.file.url);
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Subir a UploadThing
    const tipoEmpleado = mov.tipo || 'DESCONOCIDO';
    const fileName = `FT-RH-10-${tipoEmpleado}-${mov.EmployeeID}-${Date.now()}.pdf`;
    
    const file = new File([Buffer.from(pdfBuffer)], fileName, { type: 'application/pdf' });
    
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0] || !uploadResponse[0].data || !uploadResponse[0].data.url) {
      throw new Error('Error al subir el PDF a UploadThing');
    }
    
    const fileUrl = uploadResponse[0].data.url;

    return { pdfBuffer, fileUrl };

  } catch (error) {
    console.error('Error al generar PDF FT-RH-10:', error);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
    // Limpiar archivos temporales
    try {
      if (fs.existsSync(tempExcelPath)) {
        fs.unlinkSync(tempExcelPath);
      }
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
    } catch (cleanupError) {
      console.warn("Error al limpiar archivos temporales:", cleanupError);
    }
  }
}

// GET: Obtener todos los permisos de empleados
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

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    const [rows] = await connection.execute(`
      SELECT 
        em.MovementID,
        em.EmployeeID,
        em.MovementType,
        em.Specification,
        em.ApplicationDate,
        em.Duration,
        em.Former,
        em.New,
        em.StartDate,
        em.EndDate,
        em.Observations,
        em.FileURL, 
        e.Status,
        COALESCE(bp.FirstName, pp.FirstName) as FirstName,
        COALESCE(bp.LastName, pp.LastName) as LastName,
        COALESCE(bp.MiddleName, pp.MiddleName) as MiddleName,
        COALESCE(bp.Position, pc.Position) as Position,
        CASE 
          WHEN bp.EmployeeID IS NOT NULL THEN 'BASE'
          ELSE 'PROJECT'
        END as tipo
      FROM employeemovement em
      INNER JOIN employees e ON e.EmployeeID = em.EmployeeID
      LEFT JOIN basepersonnel bp ON em.EmployeeID = bp.EmployeeID
      LEFT JOIN projectpersonnel pp ON em.EmployeeID = pp.EmployeeID
      LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
      WHERE e.Status = 1
      ORDER BY em.ApplicationDate DESC, em.MovementID DESC
    `);

    const permissionRecords = rows as any[];

    return NextResponse.json({
      success: true,
      records: permissionRecords
    });

  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER MOVIMIENTOS',
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}

// POST: Crear nuevo permiso
export async function POST(request: NextRequest) {
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

    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      EmployeeID, 
      MovementType,
      Specification,
      Duration,
      Former,
      New,
      StartDate,
      EndDate,
      Observations,
    } = body;

    // Validaciones básicas
    if (!EmployeeID) {
      return NextResponse.json(
        { success: false, message: 'El ID del empleado es requerido' },
        { status: 400 }
      );
    }


    connection = await getConnection();
    await connection.beginTransaction();

    try {
      // Verificar que el empleado existe
      const [baseCheck] = await connection.execute(
        'SELECT EmployeeID FROM basepersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      )

      const [projectCheck] = await connection.execute(
        'SELECT EmployeeID FROM projectpersonnel WHERE EmployeeID = ?',
        [EmployeeID]
      );

      if ((baseCheck as any[]).length === 0 && (projectCheck as any[]).length === 0) {
        throw new Error('El empleado no existe');
      }

      // Insertar registro de permiso (sin DocumentURL por ahora)
      const [result] = await connection.execute(
        `INSERT INTO employeemovement
         (EmployeeID, MovementType, Specification, ApplicationDate, Duration, Former, New, StartDate, EndDate, Observations) 
         VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
        [
          EmployeeID,
          MovementType || null,
          Specification || null,
          Duration || null,
          Former,
          New,
          StartDate || null,
          EndDate || null,
          Observations || null
        ]
      );

      const movementId = (result as any).insertId;

      // CONFIRMAR LA TRANSACCIÓN PRIMERO
      await connection.commit();

      // AHORA generar el PDF con una nueva conexión (los datos ya están en la BD)
      let fileUrl = null;

      try {
        // Pequeña pausa para asegurar que la base de datos tenga el registro
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { fileUrl: pdfUrl } = await generatePermissionPDF(movementId);
        fileUrl = pdfUrl;
        
        // Actualizar el campo DocumentURL en la base de datos (usando nueva conexión)
        const updateConnection = await getConnection();
        try {
          await updateConnection.execute(
            `UPDATE employeemovement SET FileURL = ? WHERE MovementID = ?`,
            [pdfUrl, movementId]
          );
          console.log(`PDF subido a UploadThing y URL actualizada: ${pdfUrl}`);
        } finally {
          await updateConnection.release();
        }
      } catch (pdfError) {
        console.error('Error al generar/subir PDF:', pdfError);
        // No revertimos la transacción principal, solo registramos el error
      }

      return NextResponse.json({
        success: true,
        message: fileUrl ? 'Permiso creado exitosamente' : 'Permiso creado exitosamente (sin PDF)',
        movementId: movementId,
        fileUrl: fileUrl
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error al crear permiso:', error);
    
    let errorMessage = 'ERROR AL CREAR EL PERMISO';
    
    if (error instanceof Error) {
      if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: El empleado seleccionado no existe';
      } else if (error.message.includes('date value')) {
        errorMessage = 'ERROR: Formato de fecha incorrecto';
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}