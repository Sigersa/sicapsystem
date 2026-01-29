import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";

// Interface para el error de MySQL
interface MySqlError {
  code: string;
  errno: number;
  sqlMessage: string;
  sqlState: string;
}

// Interface para documentos
interface Documentos {
  cv: string[];
  actaNacimiento: string[];
  curp: string[];
  rfc: string[];
  imss: string[];
  ine: string[];
  comprobanteDomicilio: string[];
  comprobanteEstudios: string[];
  comprobanteCapacitacion: string[];
  licenciaManejo: string[];
  cartaAntecedentes: string[];
  cartaRecomendacion: string[];
  retencionInfonavit: string[];
  examenMedico: string[];
  foto: string[];
  folleto: string[];
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

    // Validar campos específicos para personal de proyecto
    if (formData.tipoPersonal === 'proyecto') {
      if (!formData.fechaFinContrato?.trim()) {
        return NextResponse.json(
          { success: false, message: 'La fecha de fin de contrato es requerida para personal de proyecto' },
          { status: 400 }
        );
      }
      if (!formData.nombreProyecto?.trim()) {
        return NextResponse.json(
          { success: false, message: 'El nombre del proyecto es requerido para personal de proyecto' },
          { status: 400 }
        );
      }
    }

    // Validar documentos
    if (!formData.documentos) {
      return NextResponse.json(
        { success: false, message: 'Los documentos son requeridos' },
        { status: 400 }
      );
    }

    const documentos: Documentos = formData.documentos;
    
    // Validar documentos requeridos
    const documentosRequeridos: (keyof Documentos)[] = [
      'cv', 'actaNacimiento', 'curp', 'rfc', 'imss', 
      'ine', 'comprobanteDomicilio', 'foto'
    ];

    for (const docType of documentosRequeridos) {
      if (!documentos[docType] || documentos[docType].length === 0) {
        return NextResponse.json(
          { success: false, message: `El documento ${docType} es requerido` },
          { status: 400 }
        );
      }
    }

    // Validar beneficiario (si existe)
    if (formData.beneficiarios && formData.beneficiarios.length > 0) {
      if (formData.beneficiarios.length > 1) {
        return NextResponse.json(
          { success: false, message: 'Solo se permite un beneficiario por empleado' },
          { status: 400 }
        );
      }
      
      const beneficiario = formData.beneficiarios[0];
      if (beneficiario.nombre || beneficiario.apellidoPaterno) {
        if (!beneficiario.nombre?.trim() || !beneficiario.apellidoPaterno?.trim()) {
          return NextResponse.json(
            { success: false, message: 'Si ingresa un beneficiario, debe completar nombre y apellido paterno' },
            { status: 400 }
          );
        }
        
        // Validar que el porcentaje sea 100% para un solo beneficiario
        const porcentaje = parseFloat(beneficiario.porcentaje) || 0;
        if (Math.abs(porcentaje - 100) > 0.01) {
          return NextResponse.json(
            { success: false, message: 'El porcentaje del beneficiario debe ser 100%' },
            { status: 400 }
          );
        }
      }
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();
    
    // Iniciar transacción
    await connection.beginTransaction();

    try {
      // Procesar según el tipo de personal
      if (formData.tipoPersonal === 'base') {
        // PERSONAL BASE
        // 1. Insertar en basepersonnel
        const [basePersonnelResult] = await connection.execute(
          `INSERT INTO basepersonnel 
           (FirstName, LastName, MiddleName, Position, WorkSchedule, Salary, Area) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            formData.nombre,
            formData.apellidoPaterno,
            formData.apellidoMaterno || null,
            formData.puesto,
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
             (BasePersonnelID, StartDate, SalaryIMSS) 
             VALUES (?, ?, ?)`,
            [
              basePersonnelId,
              formData.fechaInicioContrato || null,
              formData.salaryIMSS ? parseFloat(formData.salaryIMSS) : null
            ]
          );
        }

        // 5. Insertar beneficiario (si existe)
        if (formData.beneficiarios && formData.beneficiarios.length > 0) {
          const beneficiario = formData.beneficiarios[0];
          
          // Solo insertar si tiene nombre y apellido paterno
          if (beneficiario.nombre && beneficiario.nombre.trim() && 
              beneficiario.apellidoPaterno && beneficiario.apellidoPaterno.trim()) {
            
            // Forzar el porcentaje a 100% para un solo beneficiario
            const porcentajeFinal = 100;
            
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
                porcentajeFinal
              ]
            );
          }
        }

        // 6. Insertar documentación
        // Tomar solo el primer archivo de cada tipo (si existe)
        const cvUrl = documentos.cv && documentos.cv.length > 0 ? documentos.cv[0] : null;
        const actaNacimientoUrl = documentos.actaNacimiento && documentos.actaNacimiento.length > 0 ? documentos.actaNacimiento[0] : null;
        const curpUrl = documentos.curp && documentos.curp.length > 0 ? documentos.curp[0] : null;
        const rfcUrl = documentos.rfc && documentos.rfc.length > 0 ? documentos.rfc[0] : null;
        const imssUrl = documentos.imss && documentos.imss.length > 0 ? documentos.imss[0] : null;
        const ineUrl = documentos.ine && documentos.ine.length > 0 ? documentos.ine[0] : null;
        const comprobanteDomicilioUrl = documentos.comprobanteDomicilio && documentos.comprobanteDomicilio.length > 0 ? documentos.comprobanteDomicilio[0] : null;
        const comprobanteEstudiosUrl = documentos.comprobanteEstudios && documentos.comprobanteEstudios.length > 0 ? documentos.comprobanteEstudios[0] : null;
        const comprobanteCapacitacionUrl = documentos.comprobanteCapacitacion && documentos.comprobanteCapacitacion.length > 0 ? documentos.comprobanteCapacitacion[0] : null;
        const licenciaManejoUrl = documentos.licenciaManejo && documentos.licenciaManejo.length > 0 ? documentos.licenciaManejo[0] : null;
        const actaNotarialUrl = documentos.cartaAntecedentes && documentos.cartaAntecedentes.length > 0 ? documentos.cartaAntecedentes[0] : null;
        const cartaRecomendacionUrl = documentos.cartaRecomendacion && documentos.cartaRecomendacion.length > 0 ? documentos.cartaRecomendacion[0] : null;
        const retencionInfonavitUrl = documentos.retencionInfonavit && documentos.retencionInfonavit.length > 0 ? documentos.retencionInfonavit[0] : null;
        const examenMedicoUrl = documentos.examenMedico && documentos.examenMedico.length > 0 ? documentos.examenMedico[0] : null;
        const fotoUrl = documentos.foto && documentos.foto.length > 0 ? documentos.foto[0] : null;
        const folletoUrl = documentos.folleto && documentos.folleto.length > 0 ? documentos.folleto[0] : null;

        await connection.execute(
          `INSERT INTO basepersonneldocumentation 
           (BasePersonnelID, CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, 
            IMSSFileURL, INEFileURL, CDFileURL, CEFileURL, CPFileURL, 
            LMFileURL, ANPFileURL, CRFileURL, RIFileURL, EMFileURL, 
            FotoFileURL, FolletoFileURL) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            basePersonnelId,
            cvUrl,
            actaNacimientoUrl,
            curpUrl,
            rfcUrl,
            imssUrl,
            ineUrl,
            comprobanteDomicilioUrl,
            comprobanteEstudiosUrl,
            comprobanteCapacitacionUrl,
            licenciaManejoUrl,
            actaNotarialUrl,
            cartaRecomendacionUrl,
            retencionInfonavitUrl,
            examenMedicoUrl,
            fotoUrl,
            folletoUrl
          ]
        );

        // Confirmar transacción
        await connection.commit();

        return NextResponse.json({
          success: true,
          message: 'PERSONAL BASE REGISTRADO EXITOSAMENTE',
          empleadoId: basePersonnelId,
          tipo: 'base'
        });

      } else {
        // PERSONAL DE PROYECTO
        // 1. Insertar en projectpersonnel
        const [projectPersonnelResult] = await connection.execute(
          `INSERT INTO projectpersonnel 
           (FirstName, LastName, MiddleName, HireDate, Position, WorkSchedule, Salary, NameProject) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            formData.nombre,
            formData.apellidoPaterno,
            formData.apellidoMaterno || null,
            formData.fechaIngreso, // HireDate = Fecha de ingreso
            formData.puesto,
            formData.horarioLaboral || null,
            parseFloat(formData.salario.replace(/[^0-9.-]+/g, "")) || 0,
            formData.nombreProyecto || null
          ]
        );

        const projectPersonnelId = (projectPersonnelResult as any).insertId;

        // 2. Insertar en la tabla employees (siempre con EmployeeType = 'PROJECT')
        await connection.execute(
          `INSERT INTO employees (EmployeeType, ProjectPersonnelID) VALUES (?, ?)`,
          ['PROJECT', projectPersonnelId]
        );

        // 3. Insertar en projectpersonnelpersonalinfo
        // Construir la dirección completa (campo Address tiene 500 caracteres)
        const direccionCompleta = `${formData.calle} ${formData.numeroExterior}${
          formData.numeroInterior ? ' Int. ' + formData.numeroInterior : ''
        }, Col. ${formData.colonia}, ${formData.municipio}, ${formData.estado}, C.P. ${formData.codigoPostal}`;
        
        await connection.execute(
          `INSERT INTO projectpersonnelpersonalinfo 
           (ProjectPersonnelID, Address, Municipality, Nationality, Gender, Birthdate, 
            MaritalStatus, RFC, CURP, NSS, NCI, UMF, Phone, Email) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectPersonnelId,
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
            formData.umf || null,
            formData.telefono || null,
            formData.email || null
          ]
        );

        // 4. Insertar en projectcontracts (obligatorio para personal de proyecto)
        await connection.execute(
          `INSERT INTO projectcontracts 
           (ProjectPersonnelID, StartDate, EndDate, SalaryIMSS) 
           VALUES (?, ?, ?, ?)`,
          [
            projectPersonnelId,
            formData.fechaInicioContrato || null,
            formData.fechaFinContrato || null,
            formData.salaryIMSS ? parseFloat(formData.salaryIMSS) : null
          ]
        );

        // 5. Insertar beneficiario (si existe)
        if (formData.beneficiarios && formData.beneficiarios.length > 0) {
          const beneficiario = formData.beneficiarios[0];
          
          // Solo insertar si tiene nombre y apellido paterno
          if (beneficiario.nombre && beneficiario.nombre.trim() && 
              beneficiario.apellidoPaterno && beneficiario.apellidoPaterno.trim()) {
            
            // Forzar el porcentaje a 100% para un solo beneficiario
            const porcentajeFinal = 100;
            
            await connection.execute(
              `INSERT INTO projectpersonnelbeneficiaries 
               (ProjectPersonnelID, BeneficiaryFirstName, BeneficiaryLastName, 
                BeneficiaryMiddleName, Relationship, Percentage) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                projectPersonnelId,
                beneficiario.nombre,
                beneficiario.apellidoPaterno,
                beneficiario.apellidoMaterno || null,
                beneficiario.parentesco || null,
                porcentajeFinal
              ]
            );
          }
        }

        // 6. Insertar documentación
        // Tomar solo el primer archivo de cada tipo (si existe)
        const cvUrl = documentos.cv && documentos.cv.length > 0 ? documentos.cv[0] : null;
        const actaNacimientoUrl = documentos.actaNacimiento && documentos.actaNacimiento.length > 0 ? documentos.actaNacimiento[0] : null;
        const curpUrl = documentos.curp && documentos.curp.length > 0 ? documentos.curp[0] : null;
        const rfcUrl = documentos.rfc && documentos.rfc.length > 0 ? documentos.rfc[0] : null;
        const imssUrl = documentos.imss && documentos.imss.length > 0 ? documentos.imss[0] : null;
        const ineUrl = documentos.ine && documentos.ine.length > 0 ? documentos.ine[0] : null;
        const comprobanteDomicilioUrl = documentos.comprobanteDomicilio && documentos.comprobanteDomicilio.length > 0 ? documentos.comprobanteDomicilio[0] : null;
        const comprobanteEstudiosUrl = documentos.comprobanteEstudios && documentos.comprobanteEstudios.length > 0 ? documentos.comprobanteEstudios[0] : null;
        const cedulaProfesionalUrl = documentos.comprobanteCapacitacion && documentos.comprobanteCapacitacion.length > 0 ? documentos.comprobanteCapacitacion[0] : null;
        const licenciaManejoUrl = documentos.licenciaManejo && documentos.licenciaManejo.length > 0 ? documentos.licenciaManejo[0] : null;
        const cartaAntecedentesUrl = documentos.cartaAntecedentes && documentos.cartaAntecedentes.length > 0 ? documentos.cartaAntecedentes[0] : null;
        const cartaRecomendacionUrl = documentos.cartaRecomendacion && documentos.cartaRecomendacion.length > 0 ? documentos.cartaRecomendacion[0] : null;
        const retencionInfonavitUrl = documentos.retencionInfonavit && documentos.retencionInfonavit.length > 0 ? documentos.retencionInfonavit[0] : null;
        const examenMedicoUrl = documentos.examenMedico && documentos.examenMedico.length > 0 ? documentos.examenMedico[0] : null;
        const fotoUrl = documentos.foto && documentos.foto.length > 0 ? documentos.foto[0] : null;
        const folletoUrl = documentos.folleto && documentos.folleto.length > 0 ? documentos.folleto[0] : null;

        await connection.execute(
          `INSERT INTO projectpersonneldocumentation 
           (ProjectPersonnelID, CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, 
            IMSSFileURL, INEFileURL, CDFileURL, CEFileURL, CPFileURL, 
            LMFileURL, ANPFileURL, CRFileURL, RIFileURL, EMFileURL, 
            FotoFileURL, FolletoFileURL) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectPersonnelId,
            cvUrl,
            actaNacimientoUrl,
            curpUrl,
            rfcUrl,
            imssUrl,
            ineUrl,
            comprobanteDomicilioUrl,
            comprobanteEstudiosUrl,
            cedulaProfesionalUrl,
            licenciaManejoUrl,
            cartaAntecedentesUrl,
            cartaRecomendacionUrl,
            retencionInfonavitUrl,
            examenMedicoUrl,
            fotoUrl,
            folletoUrl
          ]
        );

        // Confirmar transacción
        await connection.commit();

        return NextResponse.json({
          success: true,
          message: 'PERSONAL DE PROYECTO REGISTRADO EXITOSAMENTE',
          empleadoId: projectPersonnelId,
          tipo: 'proyecto'
        });
      }

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