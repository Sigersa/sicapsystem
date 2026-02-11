import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import path from "path";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const empleadoId = searchParams.get("empleadoId");

  if (!empleadoId) {
    return NextResponse.json(
      { error: "Se requiere el ID del empleado" },
      { status: 400 }
    );
  }

  let connection;

  try {
    connection = await getConnection();

    // Primero, obtener información del empleado desde la tabla employees
    const [employeeInfo] = await connection.query<any[]>(`
      SELECT EmployeeType, BasePersonnelID, ProjectPersonnelID 
      FROM employees 
      WHERE EmployeeID = ?
    `, [empleadoId]);

    if (!employeeInfo.length) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const employee = employeeInfo[0];
    let fullName = "";
    let projectName = "N/A";
    let startDate = "";
    let position = "";
    let workSchedule = "";
    let salary = 0;
    let area = "";

    // Obtener documentos según el tipo de empleado
    let documentationQuery;
    let docParams: any[] = [];

    if (employee.EmployeeType === 'PROJECT') {
      // Personal de Proyecto
      const [rows] = await connection.query<any[]>(`
        SELECT 
          pp.FirstName,
          pp.LastName,
          pp.MiddleName,
          pd.*,
          DATE_FORMAT(pc.StartDate, '%Y/%m/%d') AS StartDate,
          pc.Position,
          pc.WorkSchedule,
          pc.Salary,
          pr.NameProject
        FROM projectpersonnel pp
        LEFT JOIN projectcontracts pc ON pc.ProjectPersonnelID = pp.ProjectPersonnelID
        LEFT JOIN projectpersonneldocumentation pd ON pp.ProjectPersonnelID = pd.ProjectPersonnelID
        LEFT JOIN projects pr ON pr.ProjectID = pc.ProjectID
        WHERE pp.ProjectPersonnelID = ?
      `, [employee.ProjectPersonnelID]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de proyecto no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
      projectName = r.NameProject || "N/A";
      startDate = r.StartDate || "";
      position = r.Position || "";
      workSchedule = r.WorkSchedule || "";
      salary = r.Salary || 0;

      // Preparar documentos para proyecto
      documentationQuery = `
        SELECT * FROM projectpersonneldocumentation 
        WHERE ProjectPersonnelID = ?
      `;
      docParams = [employee.ProjectPersonnelID];

    } else {
      // Personal Base
      const [rows] = await connection.query<any[]>(`
        SELECT 
          bp.FirstName,
          bp.LastName,
          bp.MiddleName,
          bp.Position,
          bp.WorkSchedule,
          bp.Salary,
          bp.Area,
          bd.*,
          DATE_FORMAT(bc.StartDate, '%Y/%m/%d') AS StartDate
        FROM basepersonnel bp
        LEFT JOIN basepersonneldocumentation bd ON bp.BasePersonnelID = bd.BasePersonnelID
        LEFT JOIN basecontracts bc ON bc.BasePersonnelID = bp.BasePersonnelID
        WHERE bp.BasePersonnelID = ?
      `, [employee.BasePersonnelID]);

      if (!rows.length) {
        return NextResponse.json({ error: "Información de personal base no encontrada" }, { status: 404 });
      }

      const r = rows[0];
      fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
      startDate = r.StartDate || "";
      position = r.Position || "";
      workSchedule = r.WorkSchedule || "";
      salary = r.Salary || 0;
      area = r.Area || "";

      // Preparar documentos para personal base
      documentationQuery = `
        SELECT * FROM basepersonneldocumentation 
        WHERE BasePersonnelID = ?
      `;
      docParams = [employee.BasePersonnelID];
    }

    // Obtener documentos
    const [docRows] = await connection.query<any[]>(documentationQuery, docParams);
    
    if (!docRows.length) {
      return NextResponse.json({ error: "Documentación no encontrada" }, { status: 404 });
    }

    const doc = docRows[0];

    // Cargar plantilla Excel
    const templatePath = path.join(
      process.cwd(),
      "public",
      "hiring",
      "FT-RH-04.xlsx"
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    // Llenar datos
    ws.getCell("F6").value = employee.EmployeeType === 'PROJECT' ? projectName : area;
    ws.getCell("F7").value = fullName;
    ws.getCell("F8").value = startDate;
    ws.getCell("F9").value = position;
    ws.getCell("F10").value = workSchedule;

    if (salary > 0) {
      ws.getCell("F11").value = Number(salary);
      ws.getCell("F11").numFmt = '"$"#,##0.00';
    }

    ws.getCell("F12").value = employee.EmployeeType === 'PROJECT' ? "TEMPORAL" : "BASE";

    const yesNo = (v: any) => (v ? "SI" : "NO");

    ws.getCell("F18").value = yesNo(doc.CVFileURL);
    ws.getCell("F19").value = yesNo(doc.ANFileURL);
    ws.getCell("F20").value = yesNo(doc.CURPFileURL);
    ws.getCell("F21").value = yesNo(doc.RFCFileURL);
    ws.getCell("F22").value = yesNo(doc.IMSSFileURL);
    ws.getCell("F23").value = yesNo(doc.INEFileURL);
    ws.getCell("F24").value = yesNo(doc.CDFileURL);
    ws.getCell("F25").value = yesNo(doc.CEFileURL);

    ws.getCell("L18").value = yesNo(doc.CPFileURL);
    ws.getCell("L19").value = yesNo(doc.LMFileURL);
    ws.getCell("L20").value = yesNo(doc.ANPFileURL);
    ws.getCell("L21").value = yesNo(doc.CRFileURL);
    ws.getCell("L22").value = yesNo(doc.RIFileURL);
    ws.getCell("L23").value = yesNo(doc.EMFileURL);
    ws.getCell("L24").value = yesNo(doc.FotoFileURL);
    ws.getCell("L25").value = yesNo(doc.FolletoFileURL);

    ws.getCell("F45").value = fullName;

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = employee.EmployeeType === 'PROJECT' 
      ? `FT-RH-04-PROYECTO-${empleadoId}.xlsx`
      : `FT-RH-04-BASE-${empleadoId}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    connection?.release?.();
  }
}