"use client";

interface Props {
  onPreviewPdf: () => void;
}

export default function DownloadButtons({ onPreviewPdf }: Props) {
  return (
    <div className="flex gap-4">
      <a
        href="/api/download/excel"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Descargar editable
      </a>

      <button
        onClick={onPreviewPdf}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Ver PDF
      </button>
    </div>
  );
}
