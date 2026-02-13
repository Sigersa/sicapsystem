import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { UTApi } from 'uploadthing/server';
import { validateAndRenewSession } from "@/lib/auth";

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

// Función para normalizar texto a mayúsculas manteniendo acentos
const normalizarMayusculas = (texto: string): string => {
  if (!texto) return '';
  return texto.toUpperCase();
};

// Función para verificar duplicados antes de insertar
async function checkDuplicatesBeforeInsert(connection: any, nss: string, curp: string, rfc: string): Promise<{ exists: boolean; field: string; message: string }> {
  // Verificar NSS
  const [nssRows] = await connection.execute(
    `SELECT 'BASE' as tipo FROM basepersonnelpersonalinfo WHERE NSS = ?
     UNION
     SELECT 'PROJECT' as tipo FROM projectpersonnelpersonalinfo WHERE NSS = ?`,
    [nss, nss]
  );

  if (Array.isArray(nssRows) && nssRows.length > 0) {
    return {
      exists: true,
      field: 'NSS',
      message: 'YA EXISTE UN EMPLEADO REGISTRADO CON ESTE NSS'
    };
  }

  // Verificar CURP
  const [curpRows] = await connection.execute(
    `SELECT 'BASE' as tipo FROM basepersonnelpersonalinfo WHERE CURP = ?
     UNION
     SELECT 'PROJECT' as tipo FROM projectpersonnelpersonalinfo WHERE CURP = ?`,
    [curp, curp]
  );

  if (Array.isArray(curpRows) && curpRows.length > 0) {
    return {
      exists: true,
      field: 'CURP',
      message: 'YA EXISTE UN EMPLEADO REGISTRADO CON ESTA CURP'
    };
  }

  // Verificar RFC
  const [rfcRows] = await connection.execute(
    `SELECT 'BASE' as tipo FROM basepersonnelpersonalinfo WHERE RFC = ?
     UNION
     SELECT 'PROJECT' as tipo FROM projectpersonnelpersonalinfo WHERE RFC = ?`,
    [rfc, rfc]
  );

  if (Array.isArray(rfcRows) && rfcRows.length > 0) {
    return {
      exists: true,
      field: 'RFC',
      message: 'YA EXISTE UN EMPLEADO REGISTRADO CON ESTE RFC'
    };
  }

  return { exists: false, field: '', message: '' };
}

// Función para subir archivo a UploadThing
async function uploadFileToUploadThing(fileBuffer: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
  try {
    const utapi = new UTApi();
    
    // Crear un Blob desde el ArrayBuffer
    const blob = new Blob([fileBuffer], { type: fileType });
    
    // Convertir Blob a File
    const file = new File([blob], fileName, { type: fileType });
    
    // Subir el archivo a UploadThing
    const uploadResponse = await utapi.uploadFiles([file]);
    
    if (!uploadResponse || !uploadResponse[0]) {
      throw new Error('No se recibió respuesta de UploadThing');
    }
    
    const uploadedFile = uploadResponse[0];
    
    // Verificar si hay error
    if (uploadedFile.error) {
      throw new Error(uploadedFile.error.message || 'Error al subir el archivo');
    }
    
    // Obtener la URL según la estructura de UploadThing
    let fileUrl: string | undefined;
    
    // Intentar diferentes propiedades según la versión de UploadThing
    if ('ufsUrl' in uploadedFile) {
      // Para versiones más recientes
      fileUrl = (uploadedFile as any).ufsUrl;
    } else if (uploadedFile.data?.url) {
      // Para versiones actuales
      fileUrl = uploadedFile.data.url;
    } else if ('serverData' in uploadedFile) {
      // Para algunas versiones
      fileUrl = (uploadedFile as any).serverData?.url;
    }
    
    if (!fileUrl) {
      console.warn('Estructura de UploadThing recibida:', uploadedFile);
      throw new Error('No se pudo obtener la URL del archivo subido. Estructura inesperada.');
    }
    
    console.log('Archivo subido exitosamente a:', fileUrl);
    return fileUrl;
    
  } catch (error) {
    console.error('Error al subir archivo a UploadThing:', error);
    
    let errorMessage = 'Error al subir el documento';
    if (error instanceof Error) {
      errorMessage = `Error al subir archivo: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

// Función para generar el PDF FT-RH-02
async function generateFT_RH_02_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const pdfUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/download/pdf/FT-RH-02?empleadoId=${empleadoId}&preview=1`;
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-02: ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-02:', error);
    throw new Error('Error al generar el documento PDF FT-RH-02');
  }
}

// Función para generar el PDF FT-RH-04
async function generateFT_RH_04_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const pdfUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/download/pdf/FT-RH-04?empleadoId=${empleadoId}&preview=1`;
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-04: ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-04:', error);
    throw new Error('Error al generar el documento PDF FT-RH-04');
  }
}

// Función para generar el PDF FT-RH-07
async function generateFT_RH_07_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const pdfUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/download/pdf/FT-RH-07?empleadoId=${empleadoId}&preview=1`;
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-07: ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-07:', error);
    throw new Error('Error al generar el documento PDF FT-RH-07');
  }
}

// Función para generar el PDF FT-RH-29
async function generateFT_RH_29_PDF(empleadoId: string): Promise<ArrayBuffer> {
  try {
    const pdfUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/download/pdf/FT-RH-29?empleadoId=${empleadoId}&preview=1`;
    
    const response = await fetch(pdfUrl);
    
    if (!response.ok) {
      throw new Error(`Error al generar PDF FT-RH-29: ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Error al generar PDF FT-RH-29:', error);
    throw new Error('Error al generar el documento PDF FT-RH-29');
  }
}

export async function POST(request: NextRequest) {
  let connection;
  
  try {
    // Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: 'NO AUTORIZADO' },
        { status: 401 }
      );
    }

    // Validar y renovar la sesión
    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'SESIÓN INVÁLIDA O EXPIRADA' },
        { status: 401 }
      );
    }

    // Verificar permisos 
    if (user.UserTypeID !== 2) { 
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const formData = await request.json();
    
    // Validación básica de campos requeridos
    const requiredFields = [
      'nombre', 'apellidoPaterno', 'nss', 'curp', 'rfc',
      'fechaNacimiento', 'telefono', 'email', 'puesto',
      'salario', 'calle', 'numeroExterior',
      'colonia', 'municipio', 'estado', 'codigoPostal'
    ];
    
    for (const field of requiredFields) {
      if (!formData[field]?.trim()) {
        return NextResponse.json(
          { success: false, message: `EL CAMPO ${field.toUpperCase()} ES REQUERIDO` },
          { status: 400 }
        );
      }
    }

    // Validar formato de email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      return NextResponse.json(
        { success: false, message: 'EL EMAIL NO TIENE UN FORMATO VÁLIDO' },
        { status: 400 }
      );
    }

    // Validar campos específicos para personal de proyecto
    if (formData.tipoPersonal === 'proyecto') {
      if (!formData.fechaFinContrato?.trim()) {
        return NextResponse.json(
          { success: false, message: 'LA FECHA DE FIN DE CONTRATO ES REQUERIDA PARA PERSONAL DE PROYECTO' },
          { status: 400 }
        );
      }
      if (!formData.proyectoId?.trim()) {
        return NextResponse.json(
          { success: false, message: 'EL PROYECTO ES REQUERIDO PARA PERSONAL DE PROYECTO' },
          { status: 400 }
        );
      }
    }

    // Validar documentos
    if (!formData.documentos) {
      return NextResponse.json(
        { success: false, message: 'LOS DOCUMENTOS SON REQUERIDOS' },
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
          { success: false, message: `EL DOCUMENTO ${docType.toUpperCase()} ES REQUERIDO` },
          { status: 400 }
        );
      }
    }

    // Validar beneficiario (si existe)
    if (formData.beneficiarios && formData.beneficiarios.length > 0) {
      if (formData.beneficiarios.length > 1) {
        return NextResponse.json(
          { success: false, message: 'SOLO SE PERMITE UN BENEFICIARIO POR EMPLEADO' },
          { status: 400 }
        );
      }
      
      const beneficiario = formData.beneficiarios[0];
      if (beneficiario.nombre || beneficiario.apellidoPaterno) {
        if (!beneficiario.nombre?.trim() || !beneficiario.apellidoPaterno?.trim()) {
          return NextResponse.json(
            { success: false, message: 'SI INGRESA UN BENEFICIARIO, DEBE COMPLETAR NOMBRE Y APELLIDO PATERNO' },
            { status: 400 }
          );
        }
        
        // Validar que el porcentaje sea 100% para un solo beneficiario
        const porcentaje = parseFloat(beneficiario.porcentaje) || 0;
        if (Math.abs(porcentaje - 100) > 0.01) {
          return NextResponse.json(
            { success: false, message: 'EL PORCENTAJE DEL BENEFICIARIO DEBE SER 100%' },
            { status: 400 }
          );
        }
      }
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();
    
    // **VERIFICAR DUPLICADOS ANTES DE INICIAR LA TRANSACCIÓN**
    const duplicateCheck = await checkDuplicatesBeforeInsert(
      connection, 
      formData.nss, 
      formData.curp, 
      formData.rfc
    );

    if (duplicateCheck.exists) {
      return NextResponse.json(
        { 
          success: false, 
          message: duplicateCheck.message,
          field: duplicateCheck.field
        },
        { status: 400 }
      );
    }
    
    // Iniciar transacción
    await connection.beginTransaction();

    try {
      let employeeId;
      let employeeType;
      let employeeIdNumber;
      let contractFileURL: string | null = null;
      let warningFileURL: string | null = null;
      let letterFileURL: string | null = null;
      let agreementFileURL: string | null = null;

      // Procesar según el tipo de personal
      if (formData.tipoPersonal === 'base') {
        // PERSONAL BASE
        employeeType = 'BASE';
        
        // 1. Insertar en basepersonnel
        const [basePersonnelResult] = await connection.execute(
          `INSERT INTO basepersonnel 
           (FirstName, LastName, MiddleName, Position, WorkSchedule, Salary, Area) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            normalizarMayusculas(formData.nombre.trim()),
            normalizarMayusculas(formData.apellidoPaterno.trim()),
            normalizarMayusculas(formData.apellidoMaterno.trim()),
            normalizarMayusculas(formData.puesto.trim()),
            normalizarMayusculas(formData.horarioLaboral || ''),
            parseFloat(formData.salario.replace(/[^0-9.-]+/g, "")) || 0,
            normalizarMayusculas(formData.departamento || '')
          ]
        );

        const basePersonnelId = (basePersonnelResult as any).insertId;
        employeeIdNumber = basePersonnelId;

        // 2. Insertar en la tabla employees (siempre con EmployeeType = 'BASE') y obtener EmployeeID
        const [employeeResult] = await connection.execute(
          `INSERT INTO employees (EmployeeType, BasePersonnelID) VALUES (?, ?)`,
          ['BASE', basePersonnelId]
        );

        const employeeInsertId = (employeeResult as any).insertId;
        
        // Obtener el EmployeeID generado
        const [employeeRows] = await connection.query(
          `SELECT EmployeeID FROM employees WHERE EmployeeID = ?`,
          [employeeInsertId]
        );
        
        employeeId = (employeeRows as any[])[0]?.EmployeeID;

        // 3. Insertar en basepersonnelpersonalinfo
        const direccionCompleta = `${normalizarMayusculas(formData.calle.trim())} ${normalizarMayusculas(formData.numeroExterior.trim())}${
          formData.numeroInterior ? ' INT. ' + normalizarMayusculas(formData.numeroInterior.trim()) : ''
        }, COL. ${normalizarMayusculas(formData.colonia.trim())}, ${normalizarMayusculas(formData.municipio.trim())}, ${normalizarMayusculas(formData.estado)}, C.P. ${formData.codigoPostal}`;
        
        const direccionTruncada = direccionCompleta.length > 250 ? direccionCompleta.substring(0, 247) + '...' : direccionCompleta;
        
        await connection.execute(
          `INSERT INTO basepersonnelpersonalinfo 
           (BasePersonnelID, Address, Municipality, Nationality, Gender, Birthdate, 
            MaritalStatus, RFC, CURP, NSS, NCI, UMF, Phone, Email) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            basePersonnelId,
            direccionTruncada,
            normalizarMayusculas(formData.municipio.trim()),
            normalizarMayusculas(formData.nacionalidad || ''),
            normalizarMayusculas(formData.genero || ''),
            formData.fechaNacimiento,
            normalizarMayusculas(formData.estadoCivil || ''),
            normalizarMayusculas(formData.rfc.trim()),
            normalizarMayusculas(formData.curp.trim()),
            formData.nss,
            normalizarMayusculas(formData.nci || ''),
            formData.umf ? parseInt(formData.umf) : null,
            formData.telefono || null,
            formData.email.toLowerCase().trim()
          ]
        );

        // 4. Insertar en basecontracts - con todos los campos de archivos
        await connection.execute(
          `INSERT INTO basecontracts 
           (BasePersonnelID, StartDate, SalaryIMSS, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            basePersonnelId,
            formData.fechaInicioContrato || null,
            formData.salaryIMSS ? parseFloat(formData.salaryIMSS) : null,
            null, // ContractFileURL - Se actualizará después
            null, // WarningFileURL - Se actualizará después
            null, // LetterFileURL - Se actualizará después
            null  // AgreementFileURL - Se actualizará después
          ]
        );

        // 5. Insertar beneficiario (si existe)
        if (formData.beneficiarios && formData.beneficiarios.length > 0) {
          const beneficiario = formData.beneficiarios[0];
          
          if (beneficiario.nombre && beneficiario.nombre.trim() && 
              beneficiario.apellidoPaterno && beneficiario.apellidoPaterno.trim()) {
            
            const porcentajeFinal = 100;
            
            await connection.execute(
              `INSERT INTO basepersonnelbeneficiaries 
               (BasePersonnelID, BeneficiaryFirstName, BeneficiaryLastName, 
                BeneficiaryMiddleName, Relationship, Percentage) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                basePersonnelId,
                normalizarMayusculas(beneficiario.nombre.trim()),
                normalizarMayusculas(beneficiario.apellidoPaterno.trim()),
                normalizarMayusculas(beneficiario.apellidoMaterno || ''),
                normalizarMayusculas(beneficiario.parentesco || ''),
                porcentajeFinal
              ]
            );
          }
        }

        // 6. Insertar documentación
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

      } else {
        // PERSONAL DE PROYECTO
        employeeType = 'PROJECT';
        
        // 1. Insertar en projectpersonnel
        const [projectPersonnelResult] = await connection.execute(
          `INSERT INTO projectpersonnel 
           (FirstName, LastName, MiddleName) 
           VALUES (?, ?, ?)`,
          [
            normalizarMayusculas(formData.nombre.trim()),
            normalizarMayusculas(formData.apellidoPaterno.trim()),
            normalizarMayusculas(formData.apellidoMaterno.trim())
          ]
        );

        const projectPersonnelId = (projectPersonnelResult as any).insertId;
        employeeIdNumber = projectPersonnelId;

        // 2. Insertar en la tabla employees (siempre con EmployeeType = 'PROJECT') y obtener EmployeeID
        const [employeeResult] = await connection.execute(
          `INSERT INTO employees (EmployeeType, ProjectPersonnelID) VALUES (?, ?)`,
          ['PROJECT', projectPersonnelId]
        );

        const employeeInsertId = (employeeResult as any).insertId;
        
        // Obtener el EmployeeID generado
        const [employeeRows] = await connection.query(
          `SELECT EmployeeID FROM employees WHERE EmployeeID = ?`,
          [employeeInsertId]
        );
        
        employeeId = (employeeRows as any[])[0]?.EmployeeID;

        // 3. Insertar en projectpersonnelpersonalinfo
        const direccionCompleta = `${normalizarMayusculas(formData.calle.trim())} ${normalizarMayusculas(formData.numeroExterior.trim())}${
          formData.numeroInterior ? ' INT. ' + normalizarMayusculas(formData.numeroInterior.trim()) : ''
        }, COL. ${normalizarMayusculas(formData.colonia.trim())}, ${normalizarMayusculas(formData.municipio.trim())}, ${normalizarMayusculas(formData.estado)}, C.P. ${formData.codigoPostal}`;
        
        const direccionTruncada = direccionCompleta.length > 500 ? direccionCompleta.substring(0, 497) + '...' : direccionCompleta;
        
        await connection.execute(
          `INSERT INTO projectpersonnelpersonalinfo 
           (ProjectPersonnelID, Address, Municipality, Nationality, Gender, Birthdate, 
            MaritalStatus, RFC, CURP, NSS, NCI, UMF, Phone, Email) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectPersonnelId,
            direccionTruncada,
            normalizarMayusculas(formData.municipio.trim()),
            normalizarMayusculas(formData.nacionalidad || ''),
            normalizarMayusculas(formData.genero || ''),
            formData.fechaNacimiento,
            normalizarMayusculas(formData.estadoCivil || ''),
            normalizarMayusculas(formData.rfc.trim()),
            normalizarMayusculas(formData.curp.trim()),
            formData.nss,
            normalizarMayusculas(formData.nci || ''),
            formData.umf ? parseInt(formData.umf) : null,
            formData.telefono || null,
            formData.email.toLowerCase().trim()
          ]
        );

        // 4. Insertar en projectcontracts - con todos los campos de archivos
        const proyectoId = parseInt(formData.proyectoId) || null;
        
        await connection.execute(
          `INSERT INTO projectcontracts 
           (ProjectPersonnelID, StartDate, EndDate, SalaryIMSS, Position, Salary, WorkSchedule, ProjectID, 
            ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectPersonnelId,
            formData.fechaInicioContrato || null,
            formData.fechaFinContrato || null,
            formData.salaryIMSS ? parseFloat(formData.salaryIMSS) : null,
            normalizarMayusculas(formData.puesto.trim()),
            parseFloat(formData.salario.replace(/[^0-9.-]+/g, "")) || 0,
            normalizarMayusculas(formData.horarioLaboral || ''),
            proyectoId,
            null, // ContractFileURL - Se actualizará después
            null, // WarningFileURL - Se actualizará después
            null, // LetterFileURL - Se actualizará después
            null  // AgreementFileURL - Se actualizará después
          ]
        );

        // 5. Insertar beneficiario (si existe)
        if (formData.beneficiarios && formData.beneficiarios.length > 0) {
          const beneficiario = formData.beneficiarios[0];
          
          if (beneficiario.nombre && beneficiario.nombre.trim() && 
              beneficiario.apellidoPaterno && beneficiario.apellidoPaterno.trim()) {
            
            const porcentajeFinal = 100;
            
            await connection.execute(
              `INSERT INTO projectpersonnelbeneficiaries 
               (ProjectPersonnelID, BeneficiaryFirstName, BeneficiaryLastName, 
                BeneficiaryMiddleName, Relationship, Percentage) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                projectPersonnelId,
                normalizarMayusculas(beneficiario.nombre.trim()),
                normalizarMayusculas(beneficiario.apellidoPaterno.trim()),
                normalizarMayusculas(beneficiario.apellidoMaterno || ''),
                normalizarMayusculas(beneficiario.parentesco || ''),
                porcentajeFinal
              ]
            );
          }
        }

        // 6. Insertar documentación
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
            comprobanteCapacitacionUrl,
            licenciaManejoUrl,
            cartaAntecedentesUrl,
            cartaRecomendacionUrl,
            retencionInfonavitUrl,
            examenMedicoUrl,
            fotoUrl,
            folletoUrl
          ]
        );
      }

      // Confirmar transacción de registro
      await connection.commit();

      // **PASO 7: Generar PDFs, subirlos a UploadThing y actualizar la base de datos**
      try {
        // Generar el PDF FT-RH-02
        const ftRh02PdfBuffer = await generateFT_RH_02_PDF(employeeId);
        const ftRh02FileName = `FT-RH-02_${formData.tipoPersonal}_${employeeId}_${Date.now()}.pdf`;
        contractFileURL = await uploadFileToUploadThing(ftRh02PdfBuffer, ftRh02FileName, 'application/pdf');
        
        // Generar el PDF FT-RH-04
        const ftRh04PdfBuffer = await generateFT_RH_04_PDF(employeeId);
        const ftRh04FileName = `FT-RH-04_${formData.tipoPersonal}_${employeeId}_${Date.now()}.pdf`;
        warningFileURL = await uploadFileToUploadThing(ftRh04PdfBuffer, ftRh04FileName, 'application/pdf');
        
        // Generar el PDF FT-RH-07
        const ftRh07PdfBuffer = await generateFT_RH_07_PDF(employeeId);
        const ftRh07FileName = `FT-RH-07_${formData.tipoPersonal}_${employeeId}_${Date.now()}.pdf`;
        letterFileURL = await uploadFileToUploadThing(ftRh07PdfBuffer, ftRh07FileName, 'application/pdf');
        
        // Generar el PDF FT-RH-29
        const ftRh29PdfBuffer = await generateFT_RH_29_PDF(employeeId);
        const ftRh29FileName = `FT-RH-29_${formData.tipoPersonal}_${employeeId}_${Date.now()}.pdf`;
        agreementFileURL = await uploadFileToUploadThing(ftRh29PdfBuffer, ftRh29FileName, 'application/pdf');
        
        // Actualizar la base de datos con las URLs de los PDFs
        await connection.beginTransaction();
        
        if (employeeType === 'BASE') {
          // Actualizar todos los campos de archivos en basecontracts
          await connection.execute(
            `UPDATE basecontracts 
             SET ContractFileURL = ?, WarningFileURL = ?, LetterFileURL = ?, AgreementFileURL = ?
             WHERE BasePersonnelID = ?`,
            [contractFileURL, warningFileURL, letterFileURL, agreementFileURL, employeeIdNumber]
          );
        } else {
          // Actualizar todos los campos de archivos en projectcontracts
          await connection.execute(
            `UPDATE projectcontracts 
             SET ContractFileURL = ?, WarningFileURL = ?, LetterFileURL = ?, AgreementFileURL = ?
             WHERE ProjectPersonnelID = ?`,
            [contractFileURL, warningFileURL, letterFileURL, agreementFileURL, employeeIdNumber]
          );
        }
        
        await connection.commit();
        
        console.log('PDFs generados y guardados exitosamente:');
        console.log('FT-RH-02 (Contract):', contractFileURL);
        console.log('FT-RH-04 (Warning):', warningFileURL);
        console.log('FT-RH-07 (Letter):', letterFileURL);
        console.log('FT-RH-29 (Agreement):', agreementFileURL);
        
        return NextResponse.json({
          success: true,
          message: formData.tipoPersonal === 'base' 
            ? 'PERSONAL BASE REGISTRADO EXITOSAMENTE'
            : 'PERSONAL DE PROYECTO REGISTRADO EXITOSAMENTE',
          empleadoId: employeeId,
          employeeId: employeeId,
          employeeIdNumber: employeeIdNumber,
          tipo: formData.tipoPersonal,
          contractFileURL: contractFileURL,
          warningFileURL: warningFileURL,
          letterFileURL: letterFileURL,
          agreementFileURL: agreementFileURL
        });

      } catch (pdfError) {
        // Si falla la generación de PDFs, aún así confirmar el registro
        console.error('Error al generar/subir PDFs:', pdfError);
        
        return NextResponse.json({
          success: true,
          message: formData.tipoPersonal === 'base' 
            ? 'PERSONAL BASE REGISTRADO EXITOSAMENTE (ERROR EN PDFs)'
            : 'PERSONAL DE PROYECTO REGISTRADO EXITOSAMENTE (ERROR EN PDFs)',
          empleadoId: employeeId,
          employeeId: employeeId,
          employeeIdNumber: employeeIdNumber,
          tipo: formData.tipoPersonal,
          warning: 'Error al generar los documentos PDF',
          errorDetails: process.env.NODE_ENV === 'development' ? pdfError instanceof Error ? pdfError.message : String(pdfError) : undefined
        });
      }

    } catch (error: unknown) {
      // Rollback en caso de error
      if (connection) {
        await connection.rollback();
      }
      
      console.error('Error en la transacción:', error);
      
      // Verificar si es un error de MySQL de duplicación (por si acaso)
      if (error && typeof error === 'object' && 'code' in error) {
        const mysqlError = error as MySqlError;
        if (mysqlError.code === 'ER_DUP_ENTRY') {
          // Determinar qué campo está duplicado basado en el mensaje de error
          let mensajeDuplicado = 'EL EMPLEADO YA EXISTE EN EL SISTEMA';
          
          if (mysqlError.sqlMessage) {
            if (mysqlError.sqlMessage.includes('CURP')) {
              mensajeDuplicado = 'YA EXISTE UN EMPLEADO REGISTRADO CON ESTA CURP';
            } else if (mysqlError.sqlMessage.includes('RFC')) {
              mensajeDuplicado = 'YA EXISTE UN EMPLEADO REGISTRADO CON ESTE RFC';
            } else if (mysqlError.sqlMessage.includes('NSS')) {
              mensajeDuplicado = 'YA EXISTE UN EMPLEADO REGISTRADO CON ESTE NSS';
            }
          }
          
          return NextResponse.json(
            { 
              success: false, 
              message: mensajeDuplicado
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
      if (error.message.includes('ER_BAD_FIELD_ERROR')) {
        errorMessage = 'ERROR EN LA ESTRUCTURA DE LA BASE DE DATOS. CONTACTE AL ADMINISTRADOR.';
      } else if (error.message.includes('ER_NO_SUCH_TABLE')) {
        errorMessage = 'ERROR: TABLAS NO ENCONTRADAS EN LA BASE DE DATOS.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'ERROR DE CONEXIÓN A LA BASE DE DATOS. VERIFIQUE EL SERVIDOR.';
      } else if (error.message.includes('foreign key constraint')) {
        errorMessage = 'ERROR: EL PROYECTO SELECCIONADO NO EXISTE EN LA BASE DE DATOS.';
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
    { message: 'MÉTODO NO PERMITIDO' },
    { status: 405 }
  );
}