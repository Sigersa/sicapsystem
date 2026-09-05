import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";
import { RowDataPacket } from 'mysql2';

export interface ProjectWithUser {
  ProjectID: number;
  NameProject: string;
  Status: number;
  UserID: number | null;
  ClientID: number | null;
  ProjectType: number | null;
  ProjectBudget: number | null;
  StartDate: string | null;
  EndDate: string | null;
  Username: string | null;
  FirstName: string | null;
  LastName: string | null;
}

// Definir la interfaz para las filas de la base de datos
interface ProjectRow extends RowDataPacket {
  ProjectID: number;
  NameProject: string;
  Status: number;
  UserID: number | null;
  ClientID: number | null;
  ProjectType: number | null;
  ProjectBudget: number | null;
  StartDate: Date | null;
  EndDate: Date | null;
  Username: string | null;
  FirstName: string | null;
  LastName: string | null;
}

export async function GET(request: NextRequest) {
    let connection;

    try {
        const sessionId = request.cookies.get("session")?.value;

        if (!sessionId) {
            return NextResponse.json({ error: "NO AUTORIZADO" }, { status: 401 });
        }

        const user = await validateAndRenewSession(sessionId);

        if (!user || user.UserTypeID !== 4) {
            return NextResponse.json({ error: "ACCESO DENEGADO" }, { status: 403 });
        }

        connection = await getConnection();
  
        const [rows] = await connection.execute<ProjectRow[]>(
            `SELECT 
        p.ProjectID,
        p.NameProject,
        p.Status,
        p.AdminProjectID,
        p.ClientID,
        p.ProjectType,
        p.ProjectBudget,
        p.StartDate,
        p.EndDate,
	    su.UserName,
        bp.FirstName,
        bp.LastName
      FROM projects p
      INNER JOIN employees e ON e.EmployeeID = p.AdminProjectID
      LEFT JOIN systemusers su ON su.EmployeeID = e.EmployeeID
      LEFT JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID
      ORDER BY p.ProjectID DESC`
        );

        const projects: ProjectWithUser[] = rows.map((row: ProjectRow) => ({
            ProjectID: row.ProjectID,
            NameProject: row.NameProject,
            Status: row.Status,
            UserID: row.UserID,
            ClientID: row.ClientID,
            ProjectType: row.ProjectType,
            ProjectBudget: row.ProjectBudget,
            StartDate: row.StartDate ? new Date(row.StartDate).toISOString() : null,
            EndDate: row.EndDate ? new Date(row.EndDate).toISOString() : null,
            Username: row.Username,
            FirstName: row.FirstName,
            LastName: row.LastName
        }));

        return NextResponse.json(projects);

    } catch (error) {
        console.error('Error fetching projects with users:', error);
        
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}