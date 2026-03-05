import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import YtdNode from "./YtdNode";
import TextureNode from "./TextureNode";
import { useYtdStore } from "../../store/ytdStore";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

type FlatRow = { type: "ytd"; ytdId: string } | { type: "texture"; ytdId: string; textureId: string };

interface ContextMenuState {
  x: number;
  y: number;
  ytdId: string;
  textureId: string;
  hasOptimized: boolean;
}
interface YtdContextMenuState {
  x: number;
  y: number;
  ytdId: string;
}

interface HierarchyTreeProps {
  onQuickAction: (action: "optimize" | "exclude" | "export-original" | "export-optimized" | "copy-name" | "rename" | "delete-texture", ytdId: string, textureId: string) => void;
}

export default function HierarchyTree({ onQuickAction }: HierarchyTreeProps) {
  const ytds = useYtdStore((s) => s.ytds);
  const filter = useYtdStore((s) => s.filter);
  const selectedTextureId = useYtdStore((s) => s.selectedTextureId);
  const selectedCount = useYtdStore((s) => s.selectedCount);
  const textureCount = useYtdStore((s) => s.textureCount);
  const setFilter = useYtdStore((s) => s.setFilter);
  const setSelectedTexture = useYtdStore((s) => s.setSelectedTexture);
  const toggleYtdChecked = useYtdStore((s) => s.toggleYtdChecked);
  const toggleTextureChecked = useYtdStore((s) => s.toggleTextureChecked);
  const toggleYtdExpanded = useYtdStore((s) => s.toggleYtdExpanded);
  const reorderYtd = useYtdStore((s) => s.reorderYtd);
  const removeYtd = useYtdStore((s) => s.removeYtd);
  const language = useLanguageStore((s) => s.language);

  const [dragSource, setDragSource] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [ytdContextMenu, setYtdContextMenu] = useState<YtdContextMenuState | null>(null);

  const rows = useMemo<FlatRow[]>(() => {
    const normalized = filter.trim().toLowerCase();
    const next: FlatRow[] = [];

    for (const ytd of ytds) {
      const textures = normalized ? ytd.textures.filter((t) => t.name.toLowerCase().includes(normalized) || ytd.name.toLowerCase().includes(normalized)) : ytd.textures;
      if (!textures.length && normalized) {
        continue;
      }
      next.push({ type: "ytd", ytdId: ytd.id });
      if (ytd.expanded) {
        for (const texture of textures) {
          next.push({ type: "texture", ytdId: ytd.id, textureId: texture.id });
        }
      }
    }
    return next;
  }, [ytds, filter]);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 34, overscan: 12 });

  const handleDragStart = (index: number) => setDragSource(index);
  const handleDrop = (index: number) => {
    if (dragSource === null || dragSource === index) {
      return;
    }
    reorderYtd(dragSource, index);
    setDragSource(null);
  };
  const contextWidth = 224;
  const contextHeight = 224;

  return (
    <section className="h-full flex flex-col bg-surface border-r border-border">
      <div className="p-2 border-b border-border space-y-2">
        <div className="flex items-center justify-between text-xs">
          <strong className="text-text">{tr(language, "Hierarquia", "Hierarchy")}</strong>
          <span className="text-muted">{selectedCount()} {tr(language, "de", "of")} {textureCount()} {tr(language, "selecionadas", "selected")}</span>
        </div>
        <input value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs text-text" placeholder={tr(language, "Buscar textura ou YTD", "Search texture or YTD")} />
      </div>

      <div className="flex-1 overflow-auto scrollbar" ref={parentRef} onClick={() => { setContextMenu(null); setYtdContextMenu(null); }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }

            if (row.type === "ytd") {
              const ytd = ytds.find((item) => item.id === row.ytdId);
              if (!ytd) {
                return null;
              }
              return (
                <div key={`ytd-${ytd.id}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }} className="px-2 py-1">
                  <YtdNode
                    ytd={ytd}
                    selectedCount={ytd.textures.filter((t) => t.checked).length}
                    onToggleExpand={() => toggleYtdExpanded(ytd.id)}
                    onToggleCheck={(checked) => toggleYtdChecked(ytd.id, checked)}
                    draggable
                    onDragStart={() => handleDragStart(ytds.findIndex((item) => item.id === ytd.id))}
                    onDrop={() => handleDrop(ytds.findIndex((item) => item.id === ytd.id))}
                    onDragOver={(event) => event.preventDefault()}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      const safeX = Math.max(8, Math.min(event.clientX, window.innerWidth - contextWidth - 8));
                      const safeY = Math.max(8, Math.min(event.clientY, window.innerHeight - 80));
                      setContextMenu(null);
                      setYtdContextMenu({ x: safeX, y: safeY, ytdId: ytd.id });
                    }}
                  />
                </div>
              );
            }

            const ytd = ytds.find((item) => item.id === row.ytdId);
            const texture = ytd?.textures.find((item) => item.id === row.textureId);
            if (!ytd || !texture) {
              return null;
            }

            return (
              <div key={`texture-${texture.id}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }} className="pl-5 pr-2 py-0.5">
                <TextureNode
                  ytdId={ytd.id}
                  texture={texture}
                  active={selectedTextureId === texture.id}
                  onSelect={() => setSelectedTexture(texture.id)}
                  onDoubleClick={() => void 0}
                  onToggleCheck={(checked) => toggleTextureChecked(ytd.id, texture.id, checked)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    const safeX = Math.max(8, Math.min(event.clientX, window.innerWidth - contextWidth - 8));
                    const safeY = Math.max(8, Math.min(event.clientY, window.innerHeight - contextHeight - 8));
                    setContextMenu({
                      x: safeX,
                      y: safeY,
                      ytdId: ytd.id,
                      textureId: texture.id,
                      hasOptimized: Boolean(texture.optimizedInfo)
                    });
                    setYtdContextMenu(null);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {contextMenu && (
        <div className="fixed z-20 bg-[#0f0f14] border border-border rounded-sm text-xs w-56" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {[
            { label: tr(language, "Otimizar esta textura", "Optimize this texture"), action: "optimize", disabled: false },
            { label: tr(language, "Adicionar a lista de exclusao", "Add to exclusion list"), action: "exclude", disabled: false },
            { label: tr(language, "Renomear textura", "Rename texture"), action: "rename", disabled: false },
            { label: tr(language, "Exportar textura original", "Export original texture"), action: "export-original", disabled: false },
            { label: tr(language, "Exportar textura otimizada", "Export optimized texture"), action: "export-optimized", disabled: !contextMenu.hasOptimized },
            { label: tr(language, "Excluir textura do YTD", "Delete texture from YTD"), action: "delete-texture", disabled: false },
            { label: tr(language, "Copiar nome", "Copy name"), action: "copy-name", disabled: false }
          ].map(({ label, action, disabled }) => (
            <button
              key={action}
              className={`w-full h-8 px-2 text-left ${disabled ? "text-muted cursor-not-allowed bg-transparent" : "hover:bg-[#1b1b26]"}`}
              disabled={disabled}
              onClick={() => {
                onQuickAction(action as ContextMenuAction, contextMenu.ytdId, contextMenu.textureId);
                setContextMenu(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {ytdContextMenu && (
        <div className="fixed z-20 bg-[#0f0f14] border border-border rounded-sm text-xs w-56" style={{ left: ytdContextMenu.x, top: ytdContextMenu.y }}>
          <button
            className="w-full h-8 px-2 text-left hover:bg-[#1b1b26]"
            onClick={() => {
              removeYtd(ytdContextMenu.ytdId);
              setYtdContextMenu(null);
            }}
          >
            {tr(language, "Remover YTD da lista", "Remove YTD from list")}
          </button>
        </div>
      )}
    </section>
  );
}

type ContextMenuAction = "optimize" | "exclude" | "export-original" | "export-optimized" | "copy-name" | "rename" | "delete-texture";
