import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";

// Interface para el error de MySQL
interface MySqlError {
  code: string;
  errno: number;
  sqlMessage: string;
  sqlState: string;
}

export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const formData = await request.json();
    
    // Validación básica de campos requeridos
    const requiredFields = [
      'nombre', 'apellidoPaterno', 'nss', 'curp', 'rfc',
      'fechaNacimiento', 'telefono', 'email', 'puesto',
      'fechaIngreso', 'salario', 'calle', 'numeroExterior',
      'colonia', 'municipio', 'estado', 'codigoPostal'
    ];
    
    for (const field of requiredFields) {
      if (!formData[field]?.trim()) {
        return NextResponse.json(
          { success: false, message: `El campo ${field} es requerido` },
          { status: 400 }
        );
      }
    }

    // Validar formato de CURP (18 caracteres)
    if (formData.curp && formData.curp.length !== 18) {
      return NextResponse.json(
        { success: false, message: 'La CURP debe tener 18 caracteres' },
        { status: 400 }
      );
    }

    // Validar formato de NSS (11 dígitos)
    if (formData.nss && !/^\d{11}$/.test(formData.nss)) {
      return NextResponse.json(
        { success: false, message: 'El NSS debe tener 11 dígitos' },
        { status: 400 }
      );
    }

    // Validar RFC (12-13 caracteres)
    if (formData.rfc && (formData.rfc.length < 12 || formData.rfc.length > 13)) {
      return NextResponse.json(
        { success: false, message: 'El RFC debe tener entre 12 y 13 caracteres' },
        { status: 400 }
      );
    }

    // Validar formato de email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      return NextResponse.json(
        { success: false, message: 'El email no tiene un formato válido' },
        { status: 400 }
      );
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();
    
    // Iniciar transacción
    await connection.beginTransaction();

    try {
      // 1. Insertar en basepersonnel
      const [basePersonnelResult] = await connection.execute(
        `INSERT INTO basepersonnel 
         (FirstName, LastName, MiddleName, Position, WorkSchedule, Salary, Area) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          formData.nombre,
          formData.apellidoPaterno,
          formData.apellidoMaterno || null,
          formData.puesto, // Position = Puesto
          formData.horarioLaboral || null,
          parseFloat(formData.salario.replace(/[^0-9.-]+/g, "")) || 0,
          formData.departamento || null
        ]
      );

      const basePersonnelId = (basePersonnelResult as any).insertId;

      // 2. Insertar en la tabla employees (siempre con EmployeeType = 'BASE')
      await connection.execute(
        `INSERT INTO employees (EmployeeType, BasePersonnelID) VALUES (?, ?)`,
        ['BASE', basePersonnelId]
      );

      // 3. Insertar en basepersonnelpersonalinfo
      // Construir la dirección completa
      const direccionCompleta = `${formData.calle} ${formData.numeroExterior}${
        formData.numeroInterior ? ' Int. ' + formData.numeroInterior : ''
      }, Col. ${formData.colonia}, ${formData.municipio}, ${formData.estado}, C.P. ${formData.codigoPostal}`;
      
      await connection.execute(
        `INSERT INTO basepersonnelpersonalinfo 
         (BasePersonnelID, Address, Municipality, Nationality, Gender, Birthdate, 
          MaritalStatus, RFC, CURP, NSS, NCI, UMF, Phone, Email) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          basePersonnelId,
          direccionCompleta,
          formData.municipio,
          formData.nacionalidad || null,
          formData.genero || null,
          formData.fechaNacimiento,
          formData.estadoCivil || null,
          formData.rfc,
          formData.curp,
          formData.nss,
          formData.nci || null,
          formData.umf ? parseInt(formData.umf) : null,
          formData.telefono || null,
          formData.email || null
        ]
      );

      // 4. Insertar en basecontracts (si hay datos de contrato)
      if (formData.fechaInicioContrato || formData.salaryIMSS) {
        await connection.execute(
          `INSERT INTO basecontracts 
           (BasePersonnelID, StartDate, EndDate, SalaryIMSS) 
           VALUES (?, ?, ?, ?)`,
          [
            basePersonnelId,
            formData.fechaInicioContrato || null,
            formData.fechaFinContrato || null,
            formData.salaryIMSS ? parseFloat(formData.salaryIMSS) : null
          ]
        );
      }

      // 5. Insertar beneficiarios (si existen)
      if (formData.beneficiarios && Array.isArray(formData.beneficiarios)) {
        // Definir el tipo para beneficiario
        type BeneficiarioAPI = {
          nombre?: string;
          apellidoPaterno?: string;
          apellidoMaterno?: string;
          parentesco?: string;
          porcentaje?: string;
        };
        
        // Filtrar solo beneficiarios que tienen nombre y apellido paterno
        const beneficiariosValidos = formData.beneficiarios.filter(
          (b: BeneficiarioAPI) => b.nombre && b.nombre.trim() && b.apellidoPaterno && b.apellidoPaterno.trim()
        );
        
        if (beneficiariosValidos.length > 0) {
          for (const beneficiario of beneficiariosValidos) {
            await connection.execute(
              `INSERT INTO basepersonnelbeneficiaries 
               (BasePersonnelID, BeneficiaryFirstName, BeneficiaryLastName, 
                BeneficiaryMiddleName, Relationship, Porcentage) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                basePersonnelId,
                beneficiario.nombre,
                beneficiario.apellidoPaterno,
                beneficiario.apellidoMaterno || null,
                beneficiario.parentesco || null,
                beneficiario.porcentaje ? parseFloat(beneficiario.porcentaje) : null
              ]
            );
          }
        }
      }

      // Confirmar transacción
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: 'EMPLEADO REGISTRADO EXITOSAMENTE',
        empleadoId: basePersonnelId
      });

    } catch (error: unknown) {
      // Rollback en caso de error
      if (connection) {
        await connection.rollback();
      }
      
      console.error('Error en la transacción:', error);
      
      // Verificar si es un error de MySQL de duplicación
      if (error && typeof error === 'object' && 'code' in error) {
        const mysqlError = error as MySqlError;
        if (mysqlError.code === 'ER_DUP_ENTRY') {
          return NextResponse.json(
            { 
              success: false, 
              message: 'EL EMPLEADO YA EXISTE EN EL SISTEMA (CURP, RFC O NSS DUPLICADO)'
            },
            { status: 400 }
          );
        }
      }
      
      throw error;
    }

  } catch (error: unknown) {
    console.error('Error al registrar empleado:', error);
    
    let errorMessage = 'ERROR AL REGISTRAR EL EMPLEADO. POR FAVOR, INTENTE NUEVAMENTE.';
    
    if (error instanceof Error) {
      console.error('Detalles del error:', error.message);
      // Mensajes más específicos según el tipo de error
      if (error.message.includes('ER_BAD_FIELD_ERROR')) {
        errorMessage = 'ERROR EN LA ESTRUCTURA DE LA BASE DE DATOS. CONTACTE AL ADMINISTRADOR.';
      } else if (error.message.includes('ER_NO_SUCH_TABLE')) {
        errorMessage = 'ERROR: TABLAS NO ENCONTRADAS EN LA BASE DE DATOS.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'ERROR DE CONEXIÓN A LA BASE DE DATOS. VERIFIQUE EL SERVIDOR.';
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
    // Cerrar conexión
    if (connection) {
      try {
        await connection.release();
      } catch (error) {
        console.error('Error al cerrar la conexión:', error);
      }
    }
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Método no permitido' },
    { status: 405 }
  );
}