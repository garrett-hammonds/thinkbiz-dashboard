'use client';

import { Printer, Download } from 'lucide-react';

export function QrActions({ svg, clubName }: { svg: string; clubName: string }) {
  function handleDownload() {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${clubName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-check-in-qr.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-secondary"
      >
        <Printer className="h-4 w-4" />
        Print
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
      >
        <Download className="h-4 w-4" />
        Download SVG
      </button>
    </div>
  );
}
