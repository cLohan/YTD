import { useState } from "react";
import TexturePreview from "./TexturePreview";

interface CompareViewProps {
  original?: string;
  optimized?: string;
}

export default function CompareView({ original, optimized }: CompareViewProps) {
  const [sharedView, setSharedView] = useState<{ zoom: number; offset: { x: number; y: number } }>({
    zoom: 100,
    offset: { x: 0, y: 0 }
  });

  return (
    <div className="h-full grid grid-cols-2 gap-2 p-2">
      <div className="border border-border rounded-sm overflow-hidden">
        <TexturePreview imageBase64={original} label="Original" sharedView={sharedView} onViewChange={setSharedView} />
      </div>
      <div className="border border-border rounded-sm overflow-hidden">
        <TexturePreview imageBase64={optimized} label="Otimizada" sharedView={sharedView} onViewChange={setSharedView} />
      </div>
    </div>
  );
}
