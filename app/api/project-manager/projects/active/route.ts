import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;
    console.log("🟦 [1] sessionId recibido:", sessionId);

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);
    console.log("🟦 [2] user devuelto por validateAndRenewSession:", user);

    if (!user) {
      return NextResponse.json(
        { error: "Sesión inválida o expirada" },
        { status: 401 }
      );
    }

    const employeeId = user.EmployeeID;
    console.log("🟦 [3] employeeId a usar:", employeeId, "| typeof:", typeof employeeId);

    if (!employeeId) {
      console.log("🟥 [3b] employeeId es falsy, devolviendo vacío");
      return NextResponse.json(
        {
          projects: [],
          currentProjectName: "Sin proyecto",
          userData: {
            id: user.SystemUserID,
            usuario: user.UserName,
            tipoUsuario: "",
            nombre: user.FirstName || "",
            apellido: user.LastName || "",
            email: user.Email || "",
            proyectoAsignado: "Sin proyecto",
            proyectoActivo: false,
          },
        },
        { status: 200 }
      );
    }

    connection = await getConnection();

    console.log("🟦 [4] ejecutando SELECT projects con employeeId =", employeeId);

    const [projectRows] = await connection.execute(
      `SELECT 
        ProjectID, 
        NameProject, 
        ProjectType, 
        Status, 
        ProjectBudget,
        StartDate,
        EndDate,
        CreatedBy
       FROM projects 
       WHERE AdminProjectID = ? AND Status = 0 
       ORDER BY StartDate DESC`,
      [employeeId]
    );

    const projects = projectRows as any[];
    console.log("🟩 [5] proyectos encontrados:", projects.length, projects);

    const currentProjectName =
      projects.length > 0
        ? projects[0].NameProject
        : "Ningún proyecto asignado";

    const [userRows] = await connection.execute(
      `SELECT
        bp.FirstName AS nombre,
        bp.LastName AS apellido,
        bppi.Email AS email,
        bppi.Phone AS telefono,
        su.UserName AS usuario,
        ut.Type AS tipoUsuario,
        COALESCE(p.NameProject, 'Sin proyecto') AS proyectoAsignado,
        CASE WHEN p.ProjectID IS NOT NULL THEN true ELSE false END AS proyectoActivo
      FROM employees e
      LEFT JOIN systemusers su ON su.EmployeeID = e.EmployeeID
      LEFT JOIN userstypes ut ON ut.UserTypeID = su.UserTypeID
      LEFT JOIN basepersonnel bp ON bp.EmployeeID = e.EmployeeID
      LEFT JOIN basepersonnelpersonalinfo bppi ON bp.BasePersonnelID = bppi.BasePersonnelID
      LEFT JOIN projects p ON p.AdminProjectID = e.EmployeeID AND p.Status = 0
      WHERE e.EmployeeID = ?
      ORDER BY p.StartDate DESC
      LIMIT 1`,
      [employeeId]
    );

    const userDetails = userRows as any[];
    console.log("🟩 [6] userDetails:", userDetails);

    const userData =
      userDetails.length > 0
        ? {
            id: user.SystemUserID,
            usuario: userDetails[0].usuario || user.UserName,
            tipoUsuario:
              userDetails[0].tipoUsuario || String(user.UserTypeID ?? ""),
            nombre: userDetails[0].nombre || "",
            apellido: userDetails[0].apellido || "",
            email: userDetails[0].email || "",
            telefono: userDetails[0].telefono || "",
            proyectoAsignado: userDetails[0].proyectoAsignado || "Sin proyecto",
            proyectoActivo: Boolean(userDetails[0].proyectoActivo),
          }
        : {
            id: user.SystemUserID,
            usuario: user.UserName,
            tipoUsuario: String(user.UserTypeID ?? ""),
            nombre: user.FirstName || "",
            apellido: user.LastName || "",
            email: user.Email || "",
            telefono: "",
            proyectoAsignado: currentProjectName,
            proyectoActivo: projects.length > 0,
          };

    console.log("🟩 [7] respuesta final:", {
      projectsCount: projects.length,
      currentProjectName,
      userData,
    });

    return NextResponse.json({
      projects,
      currentProjectName,
      userData,
    });
  } catch (error) {
    console.error("🟥 Error fetching projects:", error);
    return NextResponse.json(
      { error: "Error al obtener proyectos" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}