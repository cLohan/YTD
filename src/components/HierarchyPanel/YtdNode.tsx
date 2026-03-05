import type { DragEvent, MouseEvent } from "react";
import type { YtdFileItem } from "../../types/ytd.types";

interface YtdNodeProps {
  ytd: YtdFileItem;
  selectedCount: number;
  onToggleExpand: () => void;
  onToggleCheck: (checked: boolean) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

export default function YtdNode({
  ytd,
  selectedCount,
  onToggleExpand,
  onToggleCheck,
  draggable,
  onDragStart,
  onDrop,
  onDragOver,
  onContextMenu
}: YtdNodeProps) {
  return (
    <div
      className="h-8 px-2 flex items-center gap-2 text-xs border border-border rounded-sm bg-[#181821]"
      draggable={draggable}
      onDragStart={onDragStart}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onContextMenu={onContextMenu}
    >
      <button className="text-muted w-4" onClick={onToggleExpand}>
        {ytd.expanded ? "-" : "+"}
      </button>
      <input type="checkbox" checked={ytd.checked} onChange={(event) => onToggleCheck(event.target.checked)} />
      <span className="text-muted">[YTD]</span>
      <span className="truncate font-mono text-text flex-1">{ytd.name}</span>
      <span className="font-mono text-muted">
        {selectedCount}/{ytd.textures.length}
      </span>
    </div>
  );
}
