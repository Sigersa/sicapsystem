"use client";

import { useEffect } from "react";

export default function PrintPDF() {
  useEffect(() => {
    // Espera a que el PDF cargue y abre la ventana de impresión
    const timer = setTimeout(() => {
      window.print();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <iframe
      src="/api/download/pdf"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
      }}
    />
  );
}
