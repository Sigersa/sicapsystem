// app/api/administrative-personnel-dashboard/employee-management/query-update/query/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

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

    if (user.UserTypeID !== 2 && user.UserTypeID !== 1) {
      return NextResponse.json(
        { success: false, message: 'ACCESO DENEGADO' },
        { status: 403 }
      );
    }

    connection = await getConnection();

    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo');
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');

    // 1. Obtener personal base - UN SOLO REGISTRO POR EMPLEADO
    const [baseEmployees] = await connection.execute(`
      SELECT 
        e.EmployeeID,
        e.Status,
        bp.BasePersonnelID,
        bp.FirstName,
        bp.LastName,
        bp.MiddleName,
        bp.Position,
        bp.Area,
        bp.Salary,
        bp.WorkSchedule,
        COALESCE(bpi.RFC, '') as RFC,
        COALESCE(bpi.CURP, '') as CURP,
        COALESCE(bpi.NSS, '') as NSS,
        COALESCE(bpi.Email, '') as Email,
        COALESCE(bpi.Phone, '') as Phone,
        bc.ContractFileURL,
        bc.WarningFileURL,
        bc.LetterFileURL,
        bc.AgreementFileURL
      FROM basepersonnel bp
      INNER JOIN employees e ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bpi ON bp.BasePersonnelID = bpi.BasePersonnelID
      LEFT JOIN basecontracts bc ON bp.BasePersonnelID = bc.BasePersonnelID
      ORDER BY e.EmployeeID
    `);

    // 2. Obtener personal de proyecto - UN SOLO REGISTRO POR EMPLEADO
    // Usamos una subconsulta para obtener el contrato más reciente (muestra el ultimo contrato (registro de la tabla projectcontracts))
    const [projectEmployees] = await connection.execute(`
      SELECT 
    e.EmployeeID,
    e.Status as EmployeeStatus,
    pp.ProjectPersonnelID,
    pp.FirstName,
    pp.LastName,
    pp.MiddleName,
    COALESCE(p.NameProject, '') as ProjectName,
    pc.ProjectID,
    pc.Position,
    pc.Salary,
    pc.WorkSchedule,
    COALESCE(ppi.RFC, '') as RFC,
    COALESCE(ppi.CURP, '') as CURP,
    COALESCE(ppi.NSS, '') as NSS,
    COALESCE(ppi.Email, '') as Email,
    COALESCE(ppi.Phone, '') as Phone,
    pc.ContractFileURL,
    pc.WarningFileURL,
    pc.LetterFileURL,
    pc.AgreementFileURL,
    pc.ContractID
FROM projectpersonnel pp
INNER JOIN employees e ON pp.EmployeeID = e.EmployeeID
LEFT JOIN projectpersonnelpersonalinfo ppi 
    ON pp.ProjectPersonnelID = ppi.ProjectPersonnelID
LEFT JOIN (
    SELECT 
        pc1.*,
        ROW_NUMBER() OVER (
            PARTITION BY pc1.ProjectPersonnelID 
            ORDER BY pc1.ContractID DESC
        ) as rn
    FROM projectcontracts pc1
) pc 
    ON pp.ProjectPersonnelID = pc.ProjectPersonnelID 
    AND pc.rn = 1
LEFT JOIN projects p 
    ON pc.ProjectID = p.ProjectID
ORDER BY e.EmployeeID;
    `);

    // Construir arrays de empleados con claves únicas
    const baseEmployeesFormatted = (baseEmployees as any[]).map(emp => ({ 
      ...emp, 
      tipo: 'BASE' as const,
      Status: emp.Status,
      uniqueKey: `BASE_${emp.EmployeeID}`
    }));
    
    const projectEmployeesFormatted = (projectEmployees as any[]).map(emp => ({ 
      ...emp, 
      tipo: 'PROJECT' as const,
      Status: emp.EmployeeStatus,
      uniqueKey: `PROJECT_${emp.EmployeeID}`
    }));

    // Combinar todos los empleados
    let allEmployees = [...baseEmployeesFormatted, ...projectEmployeesFormatted];

    // DEDUPLICAR POR EMPLOYEEID (un empleado no puede aparecer dos veces)
    // Esto es crítico - un mismo EmployeeID no puede estar en BASE y PROJECT simultáneamente
    const uniqueByEmployeeId = new Map<number, (typeof allEmployees)[0]>();
    
    for (const emp of allEmployees) {
      const existing = uniqueByEmployeeId.get(emp.EmployeeID);
      if (!existing) {
        uniqueByEmployeeId.set(emp.EmployeeID, emp);
      } else {
        // Si ya existe, logueamos el conflicto (esto no debería pasar)
        console.warn(`⚠️ Empleado duplicado encontrado: ID=${emp.EmployeeID}, tipos: ${existing.tipo} y ${emp.tipo}`);
      }
    }
    
    let finalEmployees = Array.from(uniqueByEmployeeId.values());

    // Filtrar por tipo
    if (tipo && tipo !== 'TODOS') {
      finalEmployees = finalEmployees.filter(emp => emp.tipo === tipo);
    }

    // Filtrar por estado
    if (status && status !== 'TODOS') {
      const statusNumber = parseInt(status);
      if (!isNaN(statusNumber)) {
        finalEmployees = finalEmployees.filter(emp => emp.Status === statusNumber);
      }
    }

    // Filtrar por búsqueda
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      finalEmployees = finalEmployees.filter(emp => 
        emp.FirstName.toLowerCase().includes(searchLower) ||
        emp.LastName.toLowerCase().includes(searchLower) ||
        (emp.MiddleName?.toLowerCase() || '').includes(searchLower) ||
        `${emp.FirstName} ${emp.LastName}`.toLowerCase().includes(searchLower) ||
        (emp.RFC?.toLowerCase() || '').includes(searchLower) ||
        (emp.CURP?.toLowerCase() || '').includes(searchLower) ||
        (emp.Email?.toLowerCase() || '').includes(searchLower) ||
        (emp.NSS?.toLowerCase() || '').includes(searchLower) ||
        emp.EmployeeID.toString().includes(searchLower)
      );
    }

    // Ordenar por ID de empleado de menor a mayor
    finalEmployees.sort((a, b) => a.EmployeeID - b.EmployeeID);

    // Log para depuración - verificar que no haya claves duplicadas
    const keys = finalEmployees.map(e => e.uniqueKey);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      console.error('❌ Claves duplicadas encontradas en la respuesta final:', 
        keys.filter((k, i) => keys.indexOf(k) !== i));
    }

    return NextResponse.json({
      success: true,
      employees: finalEmployees,
      total: finalEmployees.length,
      filters: {
        tipo: tipo || 'TODOS',
        status: status || 'TODOS',
        search: search || ''
      }
    });

  } catch (error) {
    console.error('Error al obtener empleados:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'ERROR AL OBTENER LA LISTA DE EMPLEADOS',
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