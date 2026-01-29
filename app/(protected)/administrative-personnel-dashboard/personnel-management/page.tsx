"use client";

import React from "react";

const DownloadButtons: React.FC = () => {
  const handleDownloadEditable = () => {
    window.location.href = "/api/download/excel";
  };

  const handleDownloadPDF = () => {
  window.location.href = "/api/download/pdf";
};


 const handlePrint = () => {
  window.open("/print/pdf", "_blank");
};


  return (
    <div className="flex gap-4">
      <button
        onClick={handleDownloadEditable}
        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Descargar editable
      </button>

      <button
        onClick={handleDownloadPDF}
        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
      >
        Descargar PDF
      </button>

      <button
        onClick={handlePrint}
        className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-800"
      >
        Imprimir
      </button>
    </div>
  );
};

export default DownloadButtons;
