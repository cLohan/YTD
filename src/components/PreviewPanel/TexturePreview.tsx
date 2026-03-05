import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEventHandler, WheelEventHandler } from "react";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface TexturePreviewProps {
  imageBase64?: string;
  label: string;
  sharedView?: { zoom: number; offset: { x: number; y: number } };
  onViewChange?: (view: { zoom: number; offset: { x: number; y: number } }) => void;
}

export default function TexturePreview({ imageBase64, label, sharedView, onViewChange }: TexturePreviewProps) {
  const language = useLanguageStore((s) => s.language);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const imageSrc = useMemo(() => (imageBase64 ? `data:image/png;base64,${imageBase64}` : ""), [imageBase64]);

  useEffect(() => {
    if (!imageSrc) {
      setImageSize({ width: 0, height: 0 });
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const syncViewport = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      setViewport((current) => (current.width === width && current.height === height ? current : { width, height }));
    };

    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!sharedView) {
      return;
    }
    setZoom(sharedView.zoom);
    setOffset(sharedView.offset);
  }, [sharedView?.zoom, sharedView?.offset.x, sharedView?.offset.y]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport.width <= 0 || viewport.height <= 0) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = viewport.width;
    const height = viewport.height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const checkerSize = 16;
    for (let y = 0; y < height; y += checkerSize) {
      for (let x = 0; x < width; x += checkerSize) {
        const dark = ((x / checkerSize + y / checkerSize) & 1) === 0;
        ctx.fillStyle = dark ? "#2b2b33" : "#1a1a20";
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    if (!imageSrc) {
      ctx.fillStyle = "#6b6b80";
      ctx.font = "12px Inter";
      ctx.fillText(tr(language, "Sem preview disponível", "No preview available"), 12, 22);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const scale = zoom / 100;
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const x = (width - drawW) / 2 + offset.x;
      const y = (height - drawH) / 2 + offset.y;
      ctx.drawImage(img, x, y, drawW, drawH);
    };
    img.src = imageSrc;
  }, [imageSrc, zoom, offset, language, viewport.width, viewport.height]);

  const onWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setZoom((current) => {
      const next = Math.max(25, Math.min(400, current + (event.deltaY > 0 ? -10 : 10)));
      onViewChange?.({ zoom: next, offset });
      return next;
    });
  };

  const beginPan: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.button === 1 || (event.altKey && event.button === 0)) {
      setPanning(true);
      setStartPos({ x: event.clientX, y: event.clientY });
    }
  };

  const onMove: MouseEventHandler<HTMLDivElement> = (event) => {
    if (!panning) {
      return;
    }
    const dx = event.clientX - startPos.x;
    const dy = event.clientY - startPos.y;
    setOffset((prev) => {
      const next = { x: prev.x + dx, y: prev.y + dy };
      onViewChange?.({ zoom, offset: next });
      return next;
    });
    setStartPos({ x: event.clientX, y: event.clientY });
  };

  const fitToView = () => {
    if (viewport.width <= 0 || viewport.height <= 0 || imageSize.width <= 0 || imageSize.height <= 0) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const padding = 24;
    const maxW = Math.max(1, viewport.width - padding);
    const maxH = Math.max(1, viewport.height - padding);
    const scale = Math.min(maxW / imageSize.width, maxH / imageSize.height);
    const nextZoom = Math.max(1, Math.min(400, Math.round(scale * 100)));
    onViewChange?.({ zoom: nextZoom, offset: { x: 0, y: 0 } });
    setZoom(nextZoom);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="h-8 border-b border-border flex items-center justify-between px-2 text-xs bg-[#13131a]">
        <span className="text-text">{label}</span>
        <div className="flex items-center gap-1">
          <button className="h-6 px-2 border border-border rounded-sm" onClick={fitToView}>
            {tr(language, "Ajustar", "Fit to view")}
          </button>
          <button
            className="h-6 px-2 border border-border rounded-sm"
            onClick={() => {
              setZoom(100);
              setOffset({ x: 0, y: 0 });
              onViewChange?.({ zoom: 100, offset: { x: 0, y: 0 } });
            }}
          >
            100%
          </button>
          <span className="font-mono text-muted w-12 text-right">{zoom}%</span>
        </div>
      </div>
      <div ref={containerRef} className="flex-1" onWheel={onWheel} onMouseDown={beginPan} onMouseUp={() => setPanning(false)} onMouseLeave={() => setPanning(false)} onMouseMove={onMove}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
