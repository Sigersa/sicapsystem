"use client";

import React, { useState } from "react";

export default function Page() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setLoading(true);
        }}
        className="px-4 py-2 bg-red-600 text-white rounded"
      >
        Ver documento
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] h-[90%] rounded flex flex-col">
            <div className="p-4 border-b flex justify-between">
              <h2 className="font-semibold">Vista previa PDF</h2>
              <button onClick={() => setOpen(false)}>✕</button>
            </div>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-red-600 animate-spin rounded-full" />
              </div>
            )}

            <iframe
              src="/api/download-file/pdf?preview=1"
              className="flex-1 w-full"
              onLoad={() => setLoading(false)}
            />

            <div className="p-4 border-t flex gap-3 justify-end">
              <a
                href="/api/download-file/pdf"
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Descargar PDF
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
