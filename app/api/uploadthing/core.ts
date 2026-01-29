import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

const commonFileTypes = {
  pdf: { maxFileSize: "4MB" as const, maxFileCount: 3 },
  image: { maxFileSize: "4MB" as const, maxFileCount: 3 },
  "application/vnd.ms-excel": { maxFileSize: "4MB" as const, maxFileCount: 3 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxFileSize: "4MB" as const, maxFileCount: 3 },
};

function createFileRoute(folder: string, prefix: string) {
  return f(commonFileTypes)
    .middleware(async () => ({
      customFolder: folder,
      uploadTime: new Date().toISOString()
    }))
    .onUploadComplete(async ({ metadata, file }) => ({
      ...file,
      name: `[${prefix}]_${file.name}`,
      customData: {
        carpeta: metadata.customFolder,
        subidoEl: metadata.uploadTime
      }
    }));
}

// Router para documentos de contratación de empleados
const empleadoDocumentosRouter = f({
  pdf: { maxFileSize: "4MB", maxFileCount: 1 },
  image: { maxFileSize: "4MB", maxFileCount: 1 }
})
  .middleware(async ({ req }) => {
    // Puedes agregar lógica de autenticación aquí
    return { 
      userId: "empleado-docs",
      timestamp: new Date().toISOString()
    };
  })
  .onUploadComplete(async ({ metadata, file }) => {
    // Aquí puedes guardar la referencia en tu base de datos
    console.log("Documento de empleado subido:", {
      userId: metadata.userId,
      fileUrl: file.url,
      fileName: file.name,
      timestamp: metadata.timestamp
    });
    
    return {
      ...file,
      customData: metadata
    };
  });

export const ourFileRouter = {
  hiringFiles: createFileRoute("documentosdecontratacion", "contratacion"),
  empleadoDocumentos: empleadoDocumentosRouter,
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;