import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

// Configuración para archivos PDF e imágenes
const fileConfig = {
  pdf: { maxFileSize: "4MB" as const, maxFileCount: 1 },
  image: { maxFileSize: "4MB" as const, maxFileCount: 1 },
};

function createFileRoute(folder: string, prefix: string) {
  return f(fileConfig)
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
    return { 
      userId: "empleado-docs",
      timestamp: new Date().toISOString()
    };
  })
  .onUploadComplete(async ({ metadata, file }) => {
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

// Router para documentos de advertencia (warning PDFs)
const warningDocumentsRouter = f({
  pdf: { maxFileSize: "8MB", maxFileCount: 1 }
})
  .middleware(async ({ req }) => {
    return { 
      type: "warning_document",
      timestamp: new Date().toISOString()
    };
  })
  .onUploadComplete(async ({ metadata, file }) => {
    console.log("Documento de advertencia subido:", {
      type: metadata.type,
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
  warningDocuments: warningDocumentsRouter, // Nueva ruta para documentos de advertencia
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;