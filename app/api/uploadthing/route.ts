import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";
import { UTApi } from "uploadthing/server";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});

const utapi = new UTApi();

export async function DELETE(request: Request) {
  try {
    const { fileKeys } = await request.json();
    
    if (!Array.isArray(fileKeys)) {
      return Response.json(
        { success: false, error: "Se requiere un array de fileKeys" },
        { status: 400 }
      );
    }

    const deletion = await utapi.deleteFiles(fileKeys);
    
    if (!deletion.success) {
      console.error("Error al eliminar:", deletion);
      return Response.json(
        { success: false, error: "Fallo al eliminar archivos" },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      deletedFiles: fileKeys,
      message: "Archivos eliminados de 'hospedaje'"
    });

  } catch (error: unknown) {
    console.error("Error en DELETE:", error);
    
    let errorMessage = "Error desconocido";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}