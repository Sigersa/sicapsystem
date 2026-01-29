import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(
    process.cwd(),
    "public",
    "hiring",
    "FT-RH-04.xlsx"
  );

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Archivo no encontrado", { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="FT-RH-04.xlsx"',
    },
  });
}
