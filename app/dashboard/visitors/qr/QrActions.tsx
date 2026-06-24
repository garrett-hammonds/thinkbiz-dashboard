'use client';

import { Printer, Download } from 'lucide-react';

// PNG export resolution. The QR is vector, so we rasterize at a generous size
// that stays crisp on slides/printouts while keeping the file small.
const PNG_SIZE = 1024;

export function QrActions({ svg, clubName }: { svg: string; clubName: string }) {
  const fileBase = `${clubName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-check-in-qr`;

  function triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleDownloadSvg() {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${fileBase}.svg`);
    URL.revokeObjectURL(url);
  }

  function handleDownloadPng() {
    // Give the SVG explicit pixel dimensions so every browser rasterizes it at
    // a known size (a viewBox-only SVG has no intrinsic size in some browsers).
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    root.setAttribute('width', String(PNG_SIZE));
    root.setAttribute('height', String(PNG_SIZE));
    const sizedSvg = new XMLSerializer().serializeToString(root);

    const svgUrl = URL.createObjectURL(
      new Blob([sizedSvg], { type: 'image/svg+xml;charset=utf-8' }),
    );

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(svgUrl);
      if (!ctx) return;
      // Flatten onto white so the QR stays scannable even where PNG
      // transparency would otherwise show through a dark background.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        triggerDownload(pngUrl, `${fileBase}.png`);
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.onerror = () => URL.revokeObjectURL(svgUrl);
    img.src = svgUrl;
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
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
        onClick={handleDownloadPng}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
      >
        <Download className="h-4 w-4" />
        Download PNG
      </button>
      <button
        type="button"
        onClick={handleDownloadSvg}
        className="inline-flex items-center gap-2 rounded-lg border-2 border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
      >
        <Download className="h-4 w-4" />
        Download SVG
      </button>
    </div>
  );
}
