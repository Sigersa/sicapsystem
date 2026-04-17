// app/api/administrative-personnel-dashboard/employee-management/query-update/query/details/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let connection;
  
  try {
    // Desenvolver params con await
    const { id } = await params;
    
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

    // Verificar permisos (solo administradores)
    if (user.UserTypeID !== 2) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    const employeeId = id;
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') as 'BASE' | 'PROJECT';

    if (!employeeId || !tipo) {
      return NextResponse.json(
        { success: false, message: 'ID de empleado y tipo son requeridos' },
        { status: 400 }
      );
    }

    // Obtener conexión a la base de datos
    connection = await getConnection();

    let personalInfo = null;
    let contractInfo = null;
    let beneficiario = null;
    let documentacion = null;
    let projectInfo = null; // Nueva variable para información del proyecto

    if (tipo === 'BASE') {
      // Obtener información personal BASE
      const [personalRows] = await connection.execute(`
        SELECT 
          bp.BasePersonnelID,
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bp.Area,
          bp.Salary,
          bp.WorkSchedule,
          bpi.Municipality,
          bpi.Nationality,
          bpi.Gender,
          bpi.Birthdate,
          bpi.MaritalStatus,
          bpi.RFC,
          bpi.CURP,
          bpi.NSS,
          bpi.NCI,
          bpi.UMF,
          bpi.Phone,
          bpi.Email,
          bpi.Street,
          bpi.ExteriorNumber,
          bpi.InteriorNumber,
          bpi.Suburb,
          bpi.State,
          bpi.ZipCode
        FROM basepersonnel bp
        LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
        WHERE bp.EmployeeID = ?
      `, [employeeId]);

      if (Array.isArray(personalRows) && personalRows.length > 0) {
        const row = (personalRows as any[])[0];
        
        personalInfo = {
          nombreCompleto: `${row.FirstName} ${row.LastName} ${row.MiddleName || ''}`.trim(),
          fechaNacimiento: row.Birthdate,
          genero: row.Gender,
          estadoCivil: row.MaritalStatus,
          nacionalidad: row.Nationality,
          nci: row.NCI,
          umf: row.UMF?.toString(),
          calle: row.Street,
          numeroExterior: row.ExteriorNumber?.toString(),
          numeroInterior: row.InteriorNumber?.toString(),
          colonia: row.Suburb,
          municipio: row.Municipality,
          estado: row.State,
          codigoPostal: row.ZipCode?.toString(),
          rfc: row.RFC,
          curp: row.CURP,
          nss: row.NSS,
          telefono: row.Phone,
          email: row.Email,
          puesto: row.Position,
          area: row.Area,
          salario: row.Salary,
          horario: row.WorkSchedule
        };

        // Obtener información de contrato BASE
        const [contractRows] = await connection.execute(`
          SELECT StartDate, SalaryIMSS, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL
          FROM basecontracts
          WHERE BasePersonnelID = ?
        `, [row.BasePersonnelID]);

        if (Array.isArray(contractRows) && contractRows.length > 0) {
          const contractRow = (contractRows as any[])[0];
          contractInfo = {
            fechaInicio: contractRow.StartDate,
            salaryIMSS: contractRow.SalaryIMSS,
            contractFileURL: contractRow.ContractFileURL,
            warningFileURL: contractRow.WarningFileURL,
            letterFileURL: contractRow.LetterFileURL,
            agreementFileURL: contractRow.AgreementFileURL
          };
        }

        // Obtener beneficiario BASE
        const [beneficiarioRows] = await connection.execute(`
          SELECT BeneficiaryFirstName, BeneficiaryLastName, BeneficiaryMiddleName, Relationship, Percentage
          FROM basepersonnelbeneficiaries
          WHERE BasePersonnelID = ?
        `, [row.BasePersonnelID]);

        if (Array.isArray(beneficiarioRows) && beneficiarioRows.length > 0) {
          const benRow = (beneficiarioRows as any[])[0];
          beneficiario = {
            nombreCompleto: `${benRow.BeneficiaryFirstName} ${benRow.BeneficiaryLastName} ${benRow.BeneficiaryMiddleName || ''}`.trim(),
            parentesco: benRow.Relationship,
            porcentaje: benRow.Percentage
          };
        }

        // Obtener documentación BASE
        const [docRows] = await connection.execute(`
          SELECT 
            CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, INEFileURL,
            CDFileURL, CEFileURL, CPFileURL, LMFileURL, ANPFileURL, CRFileURL,
            RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
          FROM basepersonneldocumentation
          WHERE BasePersonnelID = ?
        `, [row.BasePersonnelID]);

        if (Array.isArray(docRows) && docRows.length > 0) {
          documentacion = (docRows as any[])[0];
        }
      }

    } else {
      // PERSONAL DE PROYECTO
      const [personalRows] = await connection.execute(`
        SELECT 
          pp.ProjectPersonnelID,
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pc.Position,
          pc.Salary,
          pc.WorkSchedule,
          pc.ProjectID,
          p.NameProject as ProjectName,
          p.StartDate as ProjectStartDate,
          p.EndDate as ProjectEndDate,
          p.Status as ProjectStatus,
          ppi.Municipality,
          ppi.Nationality,
          ppi.Gender,
          ppi.Birthdate,
          ppi.MaritalStatus,
          ppi.RFC,
          ppi.CURP,
          ppi.NSS,
          ppi.NCI,
          ppi.UMF,
          ppi.Phone,
          ppi.Email,
          ppi.Street,
          ppi.ExteriorNumber,
          ppi.InteriorNumber,
          ppi.Suburb,
          ppi.State,
          ppi.ZipCode
        FROM projectpersonnel pp
        LEFT JOIN projectcontracts pc ON pp.ProjectPersonnelID = pc.ProjectPersonnelID
        LEFT JOIN projects p ON pc.ProjectID = p.ProjectID
        LEFT JOIN projectpersonnelpersonalinfo ppi ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
        WHERE pp.EmployeeID = ?
      `, [employeeId]);

      if (Array.isArray(personalRows) && personalRows.length > 0) {
        const row = (personalRows as any[])[0];
        
        personalInfo = {
          nombreCompleto: `${row.FirstName} ${row.LastName} ${row.MiddleName || ''}`.trim(),
          fechaNacimiento: row.Birthdate,
          genero: row.Gender,
          estadoCivil: row.MaritalStatus,
          nacionalidad: row.Nationality,
          nci: row.NCI,
          umf: row.UMF?.toString(),
          calle: row.Street,
          numeroExterior: row.ExteriorNumber?.toString(),
          numeroInterior: row.InteriorNumber?.toString(),
          colonia: row.Suburb,
          municipio: row.Municipality,
          estado: row.State,
          codigoPostal: row.ZipCode?.toString(),
          rfc: row.RFC,
          curp: row.CURP,
          nss: row.NSS,
          telefono: row.Phone,
          email: row.Email,
          puesto: row.Position,
          proyecto: row.ProjectName,
          proyectoId: row.ProjectID,
          salario: row.Salary,
          horario: row.WorkSchedule,
          // Fechas del proyecto (solo lectura)
          fechaInicioProyecto: row.ProjectStartDate,
          fechaFinProyecto: row.ProjectEndDate
        };

        // Guardar información del proyecto para visualización
        if (row.ProjectID) {
          projectInfo = {
            projectId: row.ProjectID,
            projectName: row.ProjectName,
            startDate: row.ProjectStartDate,
            endDate: row.ProjectEndDate,
            status: row.ProjectStatus
          };
        }

        // Obtener información de contrato PROJECT (sin fechas)
        const [contractRows] = await connection.execute(`
          SELECT SalaryIMSS, ContractFileURL, WarningFileURL, LetterFileURL, AgreementFileURL,
                 Position, Salary, WorkSchedule, ProjectID,
                 CDFileURL, CRFileURL, OFFileURL, Status
          FROM projectcontracts
          WHERE ProjectPersonnelID = ?
        `, [row.ProjectPersonnelID]);

        if (Array.isArray(contractRows) && contractRows.length > 0) {
          const contractRow = (contractRows as any[])[0];
          contractInfo = {
            salaryIMSS: contractRow.SalaryIMSS,
            contractFileURL: contractRow.ContractFileURL,
            warningFileURL: contractRow.WarningFileURL,
            letterFileURL: contractRow.LetterFileURL,
            agreementFileURL: contractRow.AgreementFileURL,
            position: contractRow.Position,
            salary: contractRow.Salary,
            workSchedule: contractRow.WorkSchedule,
            projectId: contractRow.ProjectID,
            cDFileURL: contractRow.CDFileURL,
            cRFileURL: contractRow.CRFileURL,
            oFFileURL: contractRow.OFFileURL,
            status: contractRow.Status
          };
        }

        // Obtener beneficiario PROJECT
        const [beneficiarioRows] = await connection.execute(`
          SELECT BeneficiaryFirstName, BeneficiaryLastName, BeneficiaryMiddleName, Relationship, Percentage
          FROM projectpersonnelbeneficiaries
          WHERE ProjectPersonnelID = ?
        `, [row.ProjectPersonnelID]);

        if (Array.isArray(beneficiarioRows) && beneficiarioRows.length > 0) {
          const benRow = (beneficiarioRows as any[])[0];
          beneficiario = {
            nombreCompleto: `${benRow.BeneficiaryFirstName} ${benRow.BeneficiaryLastName} ${benRow.BeneficiaryMiddleName || ''}`.trim(),
            parentesco: benRow.Relationship,
            porcentaje: benRow.Percentage
          };
        }

        // Obtener documentación PROJECT
        const [docRows] = await connection.execute(`
          SELECT 
            CVFileURL, ANFileURL, CURPFileURL, RFCFileURL, IMSSFileURL, INEFileURL,
            CDFileURL, CEFileURL, CPFileURL, LMFileURL, ANPFileURL, CRFileURL,
            RIFileURL, EMFileURL, FotoFileURL, FolletoFileURL
          FROM projectpersonneldocumentation
          WHERE ProjectPersonnelID = ?
        `, [row.ProjectPersonnelID]);

        if (Array.isArray(docRows) && docRows.length > 0) {
          documentacion = (docRows as any[])[0];
        }
      }
    }

    return NextResponse.json({
      success: true,
      personalInfo,
      contractInfo,
      beneficiario,
      documentacion,
      projectInfo
    });

  } catch (error) {
    console.error('Error al obtener detalles del empleado:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER DETALLES DEL EMPLEADO',
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