import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";

interface ProjectRow extends RowDataPacket {
  ProjectID: number;
  ProjectBudget: number | null;
  TotalExpenses: number | null;
  BudgetUsagePercentage: number | null;
}

interface SessionRow extends RowDataPacket {
  UserID: number;
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

    // 2. Obtener projectId de los query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    connection = await getConnection();

    // 3. Si no hay projectId, buscar el proyecto activo del usuario
    if (!projectId) {
      const [projects] = await connection.execute<ProjectRow[]>(
        `SELECT p.ProjectID, p.ProjectBudget, pe.TotalExpenses, pe.BudgetUsagePercentage
         FROM projects p
         LEFT JOIN projectexpenses pe ON p.ProjectID = pe.ProjectID
         WHERE p.UserID = ? AND p.Status = 0
         ORDER BY p.ProjectID DESC LIMIT 1`,
        [user.SystemUserID]
      );

      const project = projects[0];

      if (!project) {
        return NextResponse.json({
          hasProject: false,
          projectId: null,
          projectBudget: 0,
          totalExpenses: 0,
          budgetUsagePercentage: 0,
          budgetExceeded: false,
        });
      }

      const projectBudget = Number(project.ProjectBudget) || 0;
      const totalExpenses = Number(project.TotalExpenses) || 0;
      const budgetUsagePercentage = Number(project.BudgetUsagePercentage) || 0;
      const budgetExceeded = budgetUsagePercentage >= 80;

      return NextResponse.json({
        hasProject: true,
        projectId: project.ProjectID,
        projectBudget,
        totalExpenses,
        budgetUsagePercentage,
        budgetExceeded,
      });
    }

    // 4. Si hay projectId, validar que sea numérico
    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId)) {
      return NextResponse.json(
        { error: "Project ID inválido" },
        { status: 400 }
      );
    }

    // 5. Consultar el proyecto específico
    const [projects] = await connection.execute<ProjectRow[]>(
      `SELECT p.ProjectID, p.ProjectBudget, pe.TotalExpenses, pe.BudgetUsagePercentage
       FROM projects p
       LEFT JOIN projectexpenses pe ON p.ProjectID = pe.ProjectID
       WHERE p.ProjectID = ? AND p.Status = 0`,
      [parsedProjectId]
    );

    const project = projects[0];

    if (!project) {
      return NextResponse.json({
        hasProject: false,
        projectId: null,
        projectBudget: 0,
        totalExpenses: 0,
        budgetUsagePercentage: 0,
        budgetExceeded: false,
      });
    }

    const projectBudget = Number(project.ProjectBudget) || 0;
    const totalExpenses = Number(project.TotalExpenses) || 0;
    const budgetUsagePercentage = Number(project.BudgetUsagePercentage) || 0;
    const budgetExceeded = budgetUsagePercentage >= 80;

    return NextResponse.json({
      hasProject: true,
      projectId: project.ProjectID,
      projectBudget,
      totalExpenses,
      budgetUsagePercentage,
      budgetExceeded,
    });

  } catch (error) {
    console.error("Error al verificar estado del presupuesto:", error);
    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}