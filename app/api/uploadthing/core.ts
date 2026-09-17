import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

// ============ CONFIGURACIONES DE ARCHIVOS ============

// Configuración común para múltiples archivos (hospedaje, nóminas, etc.)
const commonFileTypes = {
  pdf: { maxFileSize: "4MB" as const, maxFileCount: 3 },
  image: { maxFileSize: "4MB" as const, maxFileCount: 3 },
  "application/vnd.ms-excel": { maxFileSize: "4MB" as const, maxFileCount: 3 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxFileSize: "4MB" as const, maxFileCount: 3 },
};

// Configuración para archivos PDF e imágenes (un solo archivo)
const fileConfig = {
  pdf: { maxFileSize: "4MB" as const, maxFileCount: 1 },
  image: { maxFileSize: "4MB" as const, maxFileCount: 1 },
};

// ============ FUNCIONES AUXILIARES ============

// Función para crear rutas con carpeta y prefijo (múltiples archivos)
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

// Función para crear rutas con carpeta y prefijo (un solo archivo)
function createSingleFileRoute(folder: string, prefix: string) {
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

// ============ ROUTERS ESPECÍFICOS ============

// Router para documentos de contratación de empleados
const empleadoDocumentosRouter = f({
  pdf: { maxFileSize: "4MB" as const, maxFileCount: 1 },
  image: { maxFileSize: "4MB" as const, maxFileCount: 1 }
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
  pdf: { maxFileSize: "8MB" as const, maxFileCount: 1 }
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

// ============ FILE ROUTER UNIFICADO ============

export const ourFileRouter = {
  // Rutas del módulo de proyectos (múltiples archivos)
  lodgingFiles: createFileRoute("hospedaje", "hospedaje"),
  payrollFiles: createFileRoute("nominas", "nomina"),
  toolsEquipmentFiles: createFileRoute("herramientas-equipos", "herramientas"),
  transferFiles: createFileRoute("traslados", "traslado"),
  infrastructureTransferFiles: createFileRoute("traslado-infraestructura", "infraestructura"),
  infrastructureFiles: createFileRoute("infraestructura", "infraestructura"),
  installationMaterialsFiles: createFileRoute("materiales-instalacion", "instalacion"),
  loanFiles: createFileRoute("prestamos", "prestamo"),
  eppFiles: createFileRoute("epp", "epp"),
  fuelFiles: createFileRoute("combustible", "fuel"),
  financingServiceFiles: createFileRoute("servicios-financiamiento", "financiamiento"),
  outsourcedServicesFiles: createFileRoute("servicios-subcontratados", "outsourced"),
  fuelClientFiles: createFileRoute("combustible-cliente", "fuelClient"),
  consumableClientFiles: createFileRoute("consumibles-cliente", "consumibleClient"),
  waterIceFiles: createFileRoute("agua-hielo", "waterIce"),
  operativeConsumableFiles: createFileRoute("consumibles-operativos", "operativeConsumable"),
  unionDueFiles: createFileRoute("union-dues", "unionDue"),
  administrativeConsumableFiles: createFileRoute("consumibles-administrativos", "consumibleAdmin"),

  // Rutas del módulo administrativo (un solo archivo)
  hiringFiles: createSingleFileRoute("documentosdecontratacion", "contratacion"),
  empleadoDocumentos: empleadoDocumentosRouter,
  warningDocuments: warningDocumentsRouter,
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;