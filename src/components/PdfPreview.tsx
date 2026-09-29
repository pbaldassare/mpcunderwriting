import { useEffect, useRef, useState } from "react";

// Polyfill per Uint8Array.prototype.toHex / fromHex usati da pdfjs-dist 5.x
// (proposta TC39 non ancora in Chrome stabile)
if (typeof Uint8Array !== "undefined" && !(Uint8Array.prototype as any).toHex) {
  (Uint8Array.prototype as any).toHex = function () {
    let s = "";
    for (let i = 0; i < this.length; i++) s += this[i].toString(16).padStart(2, "0");
    return s;
  };
}
if (typeof Uint8Array !== "undefined" && !(Uint8Array as any).fromHex) {
  (Uint8Array as any).fromHex = (hex: string) => {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  };
}

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite ?url import returns string
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, Download, ExternalLink } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

interface Props {
  /** Bytes del PDF (preferito) */
  data?: Uint8Array | null;
  /** URL (signed o blob) come fallback */
  url?: string | null;
  fileName?: string;
}

const MAX_PAGES = 30;

const PdfPreview = ({ data, url, fileName }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.2);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdObjectUrl: string | null = null;

    async function render() {
      if (!data && !url) return;
      setLoading(true);
      setError(null);

      try {
        // Prepara URL per download/apri-in-nuova-scheda
        if (data) {
          const blob = new Blob([data as BlobPart], { type: "application/pdf" });
          createdObjectUrl = URL.createObjectURL(blob);
          setDownloadUrl(createdObjectUrl);
        } else if (url) {
          setDownloadUrl(url);
        }

        const loadingTask = data
          ? pdfjsLib.getDocument({ data: data.slice(0) as any })
          : pdfjsLib.getDocument({ url: url! });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const pagesToRender = Math.min(pdf.numPages, MAX_PAGES);
        setNumPages(pdf.numPages);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let i = 1; i <= pagesToRender; i++) {
          const page = await pdf.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "shadow-md mx-auto mb-3 bg-white rounded";
          container.appendChild(canvas);
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
        }

        if (pdf.numPages > MAX_PAGES) {
          const note = document.createElement("p");
          note.className = "text-xs text-muted-foreground text-center py-3";
          note.textContent = `Mostrate ${MAX_PAGES} pagine su ${pdf.numPages}. Scarica il file per vedere tutto.`;
          container.appendChild(note);
        }

        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Impossibile renderizzare il PDF");
          setLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [data, url, scale]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-muted/40">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} disabled={loading}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button size="icon" variant="ghost" onClick={() => setScale((s) => Math.min(3, s + 0.2))} disabled={loading}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          {numPages > 0 && (
            <span className="text-xs text-muted-foreground ml-2">{numPages} pagin{numPages === 1 ? "a" : "e"}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {downloadUrl && (
            <>
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" className="gap-1.5"><ExternalLink className="h-4 w-4" />Apri</Button>
              </a>
              <a href={downloadUrl} download={fileName || "documento.pdf"}>
                <Button size="sm" variant="ghost" className="gap-1.5"><Download className="h-4 w-4" />Scarica</Button>
              </a>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/40 p-3">
        {loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Caricamento anteprima…
          </div>
        )}
        {error && !loading && (
          <div className="text-center text-sm text-destructive p-4">
            {error}
            {downloadUrl && (
              <div className="mt-3">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" />Apri in nuova scheda</Button>
                </a>
              </div>
            )}
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  );
};

export default PdfPreview;
