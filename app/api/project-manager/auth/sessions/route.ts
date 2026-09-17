import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { validateAndRenewSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  let connection;

  try {
    const sessionId = request.cookies.get("session")?.value;

    if (!sessionId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const user = await validateAndRenewSession(sessionId);

    if (!user) {
      return NextResponse.json(
        { error: "Sesión inválida o expirada" },
        { status: 401 }
      );
    }

    const employeeId = user.EmployeeID;

    if (!employeeId) {
      return NextResponse.json(
        {
          id: user.SystemUserID,
          usuario: user.UserName,
          tipoUsuario: "",
          nombre: user.FirstName || "",
          apellido: user.LastName || "",
          email: user.Email || "",
          telefono: "",
          proyectoAsignado: "Sin proyecto",
          proyectoActivo: false,
          projectId: null,
        },
        { status: 200 }
      );
    }

    connection = await getConnection();

    const [userRows] = await connection.execute(
      `SELECT
        bp.FirstName AS nombre,
        bp.LastName AS apellido,
        bppi.Email AS email,
        bppi.Phone AS telefono,
        su.UserName AS usuario,
        su.SystemUserID AS systemUserId,
        ut.Type AS tipoUsuario,
        COALESCE(p.NameProject, 'Sin proyecto') AS proyectoAsignado,
        p.ProjectID AS projectId,
        p.ProjectType AS projectType,
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

    const userData =
      userDetails.length > 0
        ? {
            id: userDetails[0].systemUserId || user.SystemUserID,
            usuario: userDetails[0].usuario || user.UserName,
            tipoUsuario:
              userDetails[0].tipoUsuario || String(user.UserTypeID ?? ""),
            nombre: userDetails[0].nombre || "",
            apellido: userDetails[0].apellido || "",
            email: userDetails[0].email || "",
            telefono: userDetails[0].telefono || "",
            proyectoAsignado: userDetails[0].proyectoAsignado || "Sin proyecto",
            proyectoActivo: Boolean(userDetails[0].proyectoActivo),
            projectId: userDetails[0].projectId || null,
            projectType: userDetails[0].projectType || 1,
          }
        : {
            id: user.SystemUserID,
            usuario: user.UserName,
            tipoUsuario: String(user.UserTypeID ?? ""),
            nombre: user.FirstName || "",
            apellido: user.LastName || "",
            email: user.Email || "",
            telefono: "",
            proyectoAsignado: "Sin proyecto",
            proyectoActivo: false,
            projectId: null,
            projectType: 1,
          };

    return NextResponse.json(userData);
  } catch (error) {
    console.error("Error en verificación de sesión:", error);
    return NextResponse.json(
      { error: "Error en el servidor" },
      { status: 500 }
    );
  } finally {
    if (connection) connection.release();
  }
}