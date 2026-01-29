import { NextResponse } from "next/server";
import ILovePDFApi from "@ilovepdf/ilovepdf-nodejs";

export async function GET() {
  try {
    const origin =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

    const fileUrl = `${origin}/hiring/FT-RH-04.xlsx`;

    const ilovepdf = new ILovePDFApi(
      process.env.ILOVE_PUBLIC_KEY!,
      process.env.ILOVE_SECRET_KEY!
    );

    console.log("➡️ Creando tarea officepdf");
    const task = ilovepdf.newTask("officepdf");

    await task.start();
    console.log("✅ Tarea iniciada");

    // ✅ ESTA ES LA CLAVE
    await task.addFile(fileUrl);
    console.log("🌐 Archivo agregado desde URL");

    await task.process();
    console.log("⚙️ Procesado");

    const pdfUint8 = await task.download();
    const pdfBuffer = Buffer.from(pdfUint8);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="FT-RH-04.pdf"',
      },
    });
  } catch (error: any) {
    console.error("❌ iLoveAPI ERROR", error);

    return NextResponse.json(
      { error: "Error generando PDF" },
      { status: 500 }
    );
  }
}
