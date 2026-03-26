"use client";

import { useState } from "react";

export default function Page() {
  const [setOpen] = useState(false);

  return (
    <>
      <div className="p-4 border-t flex gap-3 justify-end">
              <a
                href="/api/download/edit/FT-RH-08?empleadoId=56"
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Descargar PDF
              </a>
      </div>
    </>
  );
}
