import type { MouseEvent } from "react";
import type { TextureItem } from "../../types/ytd.types";

interface TextureNodeProps {
  ytdId: string;
  texture: TextureItem;
  active: boolean;
  onSelect: () => void;
  onToggleCheck: (checked: boolean) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
}

const statusColor = (status: TextureItem["status"]) => {
  switch (status) {
    case "ready":
      return "bg-success";
    case "excluded":
      return "bg-warn";
    case "active":
      return "bg-accent";
    case "processed":
      return "bg-gray-500";
    case "error":
      return "bg-error";
    default:
      return "bg-muted";
  }
};

export default function TextureNode({ texture, active, onSelect, onToggleCheck, onDoubleClick, onContextMenu }: TextureNodeProps) {
  const effectiveWidth = texture.optimizedInfo?.width ?? texture.width;
  const effectiveHeight = texture.optimizedInfo?.height ?? texture.height;
  const effectiveMipCount = texture.optimizedInfo?.mipCount ?? texture.mipCount;
  const effectiveFormat = texture.optimizedInfo?.format ?? texture.format;
  const effectiveSizeKb = texture.optimizedInfo?.sizeKb ?? texture.sizeKb;
  const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0;
  const nonPowerOfTwo = !isPowerOfTwo(effectiveWidth) || !isPowerOfTwo(effectiveHeight);
  const sizeLabel = effectiveSizeKb >= 10 ? `${effectiveSizeKb.toFixed(0)}KB` : `${effectiveSizeKb.toFixed(2)}KB`;
  const formatLabel = effectiveFormat
    .replace(/^D3DFMT_/i, "")
    .replace(/^DXGI_FORMAT_/i, "")
    .replace(/^FORMAT_/i, "");

  return (
    <div
      className={`h-8 px-2 flex items-center gap-2 text-xs border border-transparent rounded-sm ${
        active
          ? "bg-accent/20 border-accent/50"
          : nonPowerOfTwo
            ? "bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15"
            : "hover:bg-[#1a1a23]"
      }`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <input
        type="checkbox"
        checked={texture.checked}
        onChange={(event) => onToggleCheck(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
      <span className={`inline-block h-2 w-2 rounded-full ${statusColor(active ? "active" : texture.status)}`} />
      <span className="font-mono text-text truncate flex-1">{texture.name}</span>
      <span className={`font-mono ${nonPowerOfTwo ? "text-amber-300" : "text-muted"}`}>{effectiveWidth}x{effectiveHeight}</span>
      <span className="text-muted font-mono w-10 text-right">m{effectiveMipCount}</span>
      <span className="text-muted font-mono w-16 text-right">{formatLabel}</span>
      <span className="text-muted font-mono w-16 text-right">{sizeLabel}</span>
    </div>
  );
}
