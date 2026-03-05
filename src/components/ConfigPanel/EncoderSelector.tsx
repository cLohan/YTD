import { useState } from "react";
import type { EncoderInfo } from "../../types/ytd.types";
import { tr } from "../../lib/i18n";
import { useLanguageStore } from "../../store/languageStore";

interface EncoderSelectorProps {
  encoders: EncoderInfo[];
  selected: string;
  onChange: (value: string) => void;
}

export default function EncoderSelector({ encoders, selected, onChange }: EncoderSelectorProps) {
  const language = useLanguageStore((s) => s.language);
  const [showGuide, setShowGuide] = useState(false);

  return (
    <section className="border border-border rounded-sm p-3 space-y-2">
      <h3 className="text-xs font-semibold text-text">Encoder</h3>
      <select
        className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs"
        value={selected}
        onChange={(event) => onChange(event.target.value)}
      >
        {encoders.map((encoder) => (
          <option key={encoder.id} value={encoder.id} disabled={!encoder.detected}>
            {encoder.label} {encoder.detected ? tr(language, "(detectado)", "(detected)") : tr(language, "(não encontrado)", "(not found)")}
          </option>
        ))}
      </select>
      <div className="space-y-1 text-[11px]">
        {encoders.map((encoder) => (
          <div key={encoder.id} className="flex items-center justify-between text-muted">
            <span>{encoder.label}</span>
            <span className={`px-1.5 rounded-sm border ${encoder.detected ? "text-success border-success/40" : "text-error border-error/40"}`}>
              {encoder.detected ? tr(language, "SIM", "YES") : tr(language, "NÃO", "NO")}
            </span>
          </div>
        ))}
      </div>
      <button className="text-[11px] text-accent hover:underline" onClick={() => setShowGuide((v) => !v)}>
        {tr(language, "Como instalar encoders externos", "How to install external encoders")}
      </button>
      {showGuide && (
        <div className="rounded-sm border border-border bg-[#111118] p-2 text-[11px] text-muted space-y-1">
          <div>{tr(language, "NVTT: instale o exporter NVTT e garanta nvtt_export.exe no PATH.", "NVTT: install the NVTT exporter and ensure nvtt_export.exe is on PATH.")}</div>
          <div>{tr(language, "DirectXTex: coloque texconv.exe no PATH ou pasta do app.", "DirectXTex: place texconv.exe in PATH or app folder.")}</div>
          <div>{tr(language, "ImageMagick: instale magick.exe e habilite no PATH.", "ImageMagick: install magick.exe and enable PATH integration.")}</div>
        </div>
      )}
    </section>
  );
}
