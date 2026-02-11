"use client";

import React, { useState } from "react";

export default function Page() {

  return (
    <div className="flex gap-4">
      <a
        href="/api/download/edit/FT-RH-02"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Descargar editable
      </a>
    </div>
  );
}
