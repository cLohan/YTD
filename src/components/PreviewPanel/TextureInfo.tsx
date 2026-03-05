import type { TextureItem } from "../../types/ytd.types";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

interface TextureInfoProps {
  texture: TextureItem | null;
  processing?: boolean;
  onFixPowerOfTwo?: () => void;
}

export default function TextureInfo({ texture, processing = false, onFixPowerOfTwo }: TextureInfoProps) {
  const language = useLanguageStore((s) => s.language);

  if (!texture) {
    return <div className="min-h-20 border-t border-border px-3 py-2 text-xs text-muted flex items-center">{tr(language, "Selecione uma textura na hierarquia para visualizar.", "Select a texture in the hierarchy to preview.")}</div>;
  }

  const optimized = texture.optimizedInfo;
  const originalMb = texture.sizeKb / 1024;
  const optimizedMb = optimized ? optimized.sizeKb / 1024 : 0;
  const delta = optimized ? ((optimized.sizeKb - texture.sizeKb) / texture.sizeKb) * 100 : 0;
  const effectiveWidth = optimized?.width ?? texture.width;
  const effectiveHeight = optimized?.height ?? texture.height;
  const effectiveMips = optimized?.mipCount ?? texture.mipCount;
  const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0;
  const nonPowerOfTwo = !isPowerOfTwo(effectiveWidth) || !isPowerOfTwo(effectiveHeight);

  return (
    <div className="min-h-20 max-h-36 overflow-auto border-t border-border px-3 py-2 text-xs font-mono space-y-1 leading-5">
      <div className="text-text break-all">{texture.name}.dds</div>
      <div className="text-muted">{tr(language, "Original", "Original")}: {texture.width}x{texture.height} {texture.format} {originalMb.toFixed(2)} MB | mips: {texture.mipCount}</div>
      <div className="text-muted">{tr(language, "Otimizado", "Optimized")}: {optimized?.width ?? texture.width}x{optimized?.height ?? texture.height} {optimized?.format ?? texture.format} {optimized ? `${optimizedMb.toFixed(2)} MB (${delta.toFixed(1)}%)` : "-"} | mips: {effectiveMips}</div>
      {nonPowerOfTwo && (
        <div className="mt-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-200 flex items-center justify-between gap-2">
          <span>{tr(language, "Aviso: textura fora de potencia de 2.", "Warning: texture is not power of two.")}</span>
          <button
            className="h-7 px-2 rounded-sm border border-amber-500/50 text-amber-200 disabled:opacity-50"
            onClick={onFixPowerOfTwo}
            disabled={processing || !onFixPowerOfTwo}
          >
            {tr(language, "Corrigir", "Fix")}
          </button>
        </div>
      )}
    </div>
  );
}
