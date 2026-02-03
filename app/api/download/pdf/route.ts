import { NextRequest, NextResponse } from "next/server";
import CloudConvert from "cloudconvert";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import os from "os";
import { getConnection } from "@/lib/db";

const cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY!);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isPreview = searchParams.get("preview") === "1";

  const tempExcelPath = path.join(os.tmpdir(), `FT-RH-04-${Date.now()}.xlsx`);
  let connection;

  try {
    connection = await getConnection();

    const [rows] = await connection.query<any[]>(`
      SELECT 
        pp.FirstName,
        pp.LastName,
        pp.MiddleName,
        pp.NameProject,
        DATE_FORMAT(pp.HireDate, '%Y/%m/%d') AS HireDate,
        pp.Position,
        pp.WorkSchedule,
        pp.Salary,
        pd.*
      FROM projectpersonnel pp
      LEFT JOIN projectpersonneldocumentation pd
        ON pp.ProjectPersonnelID = pd.ProjectPersonnelID
      ORDER BY pp.ProjectPersonnelID DESC
      LIMIT 1
    `);

    if (!rows.length) {
      return NextResponse.json({ error: "Sin registros" }, { status: 404 });
    }

    const r = rows[0];

    const templatePath = path.join(
      process.cwd(),
      "public",
      "hiring",
      "FT-RH-04.xlsx"
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    const ws = workbook.getWorksheet(1)!;

    const fullName = `${r.FirstName} ${r.LastName} ${r.MiddleName || ""}`.trim();
    const yesNo = (v: any) => (v ? "SI" : "NO");

    ws.getCell("F6").value = r.NameProject;
    ws.getCell("F7").value = fullName;
    ws.getCell("F8").value = r.HireDate;
    ws.getCell("F9").value = r.Position;
    ws.getCell("F10").value = r.WorkSchedule;
     if (r.Salary != null) {
      ws.getCell("F11").value = Number(r.Salary);
      ws.getCell("F11").numFmt = '"$"#,##0.00';
    }
    ws.getCell("F12").value = "TEMPORAL";
    ws.getCell("F18").value = yesNo(r.CVFileURL);
    ws.getCell("F19").value = yesNo(r.ANFileURL);
    ws.getCell("F20").value = yesNo(r.CURPFileURL);
    ws.getCell("F21").value = yesNo(r.RFCFileURL);
    ws.getCell("F22").value = yesNo(r.IMSSFileURL);
    ws.getCell("F23").value = yesNo(r.INEFileURL);
    ws.getCell("F24").value = yesNo(r.CDFileURL);
    ws.getCell("F25").value = yesNo(r.CEFileURL);

    ws.getCell("L18").value = yesNo(r.CPFileURL);
    ws.getCell("L19").value = yesNo(r.LMFileURL);
    ws.getCell("L20").value = yesNo(r.ANPFileURL);
    ws.getCell("L21").value = yesNo(r.CRFileURL);
    ws.getCell("L22").value = yesNo(r.RIFileURL);
    ws.getCell("L23").value = yesNo(r.EMFileURL);
    ws.getCell("L24").value = yesNo(r.FotoFileURL);
    ws.getCell("L25").value = yesNo(r.FolletoFileURL);
    ws.getCell("F45").value = fullName;

    await workbook.xlsx.writeFile(tempExcelPath);

    const job = await cloudConvert.jobs.create({
      tasks: {
        upload: { operation: "import/upload" },
        convert: {
          operation: "convert",
          input: "upload",
          input_format: "xlsx",
          output_format: "pdf",
        },
        export: {
          operation: "export/url",
          input: "convert",
        },
      },
    });

    const uploadTask: any = job.tasks?.find(t => t.name === "upload");

    await cloudConvert.tasks.upload(
      uploadTask,
      fs.createReadStream(tempExcelPath)
    );

    const completed = await cloudConvert.jobs.wait(job.id);
    const pdfUrl =
      completed.tasks?.find(t => t.name === "export")?.result?.files?.[0]?.url;

    if (!pdfUrl) {
      throw new Error("No se pudo generar el PDF");
    }

    const response = await fetch(pdfUrl);
    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": isPreview
          ? 'inline; filename="FT-RH-04.pdf"'
          : 'attachment; filename="FT-RH-04.pdf"',
      },
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    connection?.release?.();
    fs.existsSync(tempExcelPath) && fs.unlinkSync(tempExcelPath);
  }
}
