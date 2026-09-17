import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

interface ProjectRow extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
}

export async function GET(request: NextRequest) {
  let connection;

  try {
    // 1. Validar sesión
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { error: "Sesión inválida o expirada" },
        { status: 401 }
      );
    }

    // 2. Obtener projectId de forma consistente
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID es requerido" },
        { status: 400 }
      );
    }

    // 3. Validar que projectId sea numérico
    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId)) {
      return NextResponse.json(
        { error: "Project ID inválido" },
        { status: 400 }
      );
    }

    // 4. Consultar la base de datos
    connection = await getConnection();

    const [rows] = await connection.execute<ProjectRow[]>(
      "SELECT ProjectID, NameProject FROM projects WHERE ProjectID = ?",
      [parsedProjectId]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Proyecto no encontrado" },
        { status: 404 }
      );
    }

    const project = rows[0];

    // 5. Retornar los datos del proyecto (formato consistente con el frontend)
    return NextResponse.json({
      projectId: project.ProjectID,
      projectName: project.NameProject,
    });

  } catch (error) {
    console.error("Error al obtener el proyecto:", error);
    return NextResponse.json(
      { error: "Error al obtener el proyecto" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}