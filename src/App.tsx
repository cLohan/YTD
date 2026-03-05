import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import TopBar from "./components/Layout/TopBar";
import StatusBar from "./components/Layout/StatusBar";
import LogPanel from "./components/Layout/LogPanel";
import HierarchyTree from "./components/HierarchyPanel/HierarchyTree";
import TexturePreview from "./components/PreviewPanel/TexturePreview";
import CompareView from "./components/PreviewPanel/CompareView";
import TextureInfo from "./components/PreviewPanel/TextureInfo";
import EncoderSelector from "./components/ConfigPanel/EncoderSelector";
import ResizeConfig from "./components/ConfigPanel/ResizeConfig";
import FormatSelector from "./components/ConfigPanel/FormatSelector";
import MipmapConfig from "./components/ConfigPanel/MipmapConfig";
import ScopeSelector from "./components/ConfigPanel/ScopeSelector";
import ExportConfig from "./components/ConfigPanel/ExportConfig";
import ActionButtons from "./components/ConfigPanel/ActionButtons";
import ExclusionsList from "./components/ExclusionsTab/ExclusionsList";
import SettingsModal from "./components/Settings/SettingsModal";
import AboutModal from "./components/Settings/AboutModal";
import { tr } from "./lib/i18n";
import { useLanguageStore } from "./store/languageStore";
import { getSelectedTexture, useYtdStore } from "./store/ytdStore";
import { useConfigStore } from "./store/configStore";
import { useProcessStore } from "./store/processStore";
import type { EncoderInfo, OpenYtdResponse, ProcessingProgress, TextureItem } from "./types/ytd.types";

type PreviewTab = "original" | "optimized" | "compare";
type CenterTab = "preview" | "exclusions";
type QuickAction = "optimize" | "exclude" | "export-original" | "export-optimized" | "copy-name" | "rename" | "delete-texture";

export default function App() {
  const [centerTab, setCenterTab] = useState<CenterTab>("preview");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("original");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [exportDialog, setExportDialog] = useState<{
    open: boolean;
    ytdId: string;
    textureId: string;
    optimized: boolean;
    textureName: string;
    format: "dds" | "png";
  }>({
    open: false,
    ytdId: "",
    textureId: "",
    optimized: false,
    textureName: "",
    format: "dds"
  });
  const [powerFixDialog, setPowerFixDialog] = useState<{
    open: boolean;
    ytdId: string;
    textureId: string;
    width: string;
    height: string;
  }>({
    open: false,
    ytdId: "",
    textureId: "",
    width: "",
    height: ""
  });

  const ytdStore = useYtdStore();
  const configStore = useConfigStore();
  const processStore = useProcessStore();
  const language = useLanguageStore((s) => s.language);

  const selected = useMemo(() => getSelectedTexture(ytdStore), [ytdStore]);
  const selectedTexture = selected?.texture ?? null;
  const canUndo = ytdStore.canUndo();
  const hasOptimizedTextures = useMemo(
    () => ytdStore.ytds.some((ytd) => ytd.textures.some((texture) => texture.optimizedInfo)),
    [ytdStore.ytds]
  );
  const isPowerOfTwo = (value: number) => value > 0 && (value & (value - 1)) === 0;
  const nearestPowerOfTwo = (value: number) => {
    if (value <= 1) {
      return 1;
    }
    let high = 1;
    while (high < value) {
      high <<= 1;
    }
    const low = high >> 1;
    return (value - low) <= (high - value) ? low : high;
  };
  const nextPowerOfTwo = (value: number) => {
    let n = 1;
    while (n < Math.max(1, value)) {
      n <<= 1;
    }
    return n;
  };

  useEffect(() => {
    configStore
      .loadFromTauriStore()
      .then(() => processStore.addLog("INFO", tr(language, "Configuracoes carregadas.", "Settings loaded.")))
      .catch((err) => {
        processStore.addLog("WARN", `${tr(language, "Persistencia Tauri Store indisponivel:", "Tauri Store persistence unavailable:")} ${String(err)}`);
      });

    invoke<EncoderInfo[]>("detect_encoders")
      .then((encoders) => configStore.setEncoders(encoders))
      .catch((err) => {
        processStore.addLog("WARN", `${tr(language, "Falha ao detectar encoders:", "Failed to detect encoders:")} ${String(err)}`);
      });

    const unlistenProgress = listen<ProcessingProgress>("process-progress", (event) => {
      processStore.updateProgress(event.payload);
      processStore.setCurrentLogLine(`${tr(language, "Processando", "Processing")}: ${event.payload.texture} (${event.payload.current}/${event.payload.total})`);
    });

    const unlistenLog = listen<{ level: "INFO" | "WARN" | "ERROR" | "SUCCESS"; message: string }>("process-log", (event) => {
      processStore.addLog(event.payload.level, event.payload.message);
    });

    let unlistenDnd: Promise<() => void> | null = null;
    try {
      const currentWindow = getCurrentWindow();
      if (typeof currentWindow.onDragDropEvent === "function") {
        unlistenDnd = currentWindow.onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths.filter((path) => path.toLowerCase().endsWith(".ytd"));
            if (paths.length > 0) {
              openYtd(paths);
            }
          }
        });
      }
    } catch (error) {
      processStore.addLog("WARN", `${tr(language, "Drag and drop indisponivel:", "Drag and drop unavailable:")} ${String(error)}`);
    }

    return () => {
      Promise.resolve(unlistenProgress).then((fn) => fn());
      Promise.resolve(unlistenLog).then((fn) => fn());
      if (unlistenDnd) {
        Promise.resolve(unlistenDnd).then((fn) => fn());
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedTexture || selectedTexture.originalPreview) {
      return;
    }

    invoke<string>("get_texture_preview", {
      ytdId: selected?.ytd.id,
      textureId: selectedTexture.id,
      optimized: false
    })
      .then((preview) => {
        useYtdStore.getState().upsertTexture(selected?.ytd.id ?? "", { ...selectedTexture, originalPreview: preview });
      })
      .catch(() => null);
  }, [selectedTexture?.id]);

  useEffect(() => {
    if (!selectedTexture || selectedTexture.optimizedPreview || !selectedTexture.optimizedInfo) {
      return;
    }

    invoke<string>("get_texture_preview", {
      ytdId: selected?.ytd.id,
      textureId: selectedTexture.id,
      optimized: true
    })
      .then((preview) => {
        if (!preview) {
          return;
        }
        useYtdStore.getState().upsertTexture(selected?.ytd.id ?? "", { ...selectedTexture, optimizedPreview: preview });
      })
      .catch(() => null);
  }, [selectedTexture?.id, selectedTexture?.optimizedInfo, previewTab]);

  useEffect(() => {
    if (!selectedTexture) {
      return;
    }
    if (configStore.resize.mode !== "custom") {
      return;
    }
    if (configStore.resize.width !== 1024 || configStore.resize.height !== 1024) {
      return;
    }

    configStore.setResize({
      width: selectedTexture.width,
      height: selectedTexture.height
    });
  }, [selectedTexture?.id, configStore.resize.mode, configStore.resize.width, configStore.resize.height]);

  useEffect(() => {
    if (!selectedTexture || !configStore.output.keepOriginalMipmaps) {
      return;
    }
    if (selectedTexture.mipCount > 0 && configStore.output.mipmapLevels !== selectedTexture.mipCount) {
      configStore.setOutput({ mipmapLevels: selectedTexture.mipCount });
    }
  }, [selectedTexture?.id, selectedTexture?.mipCount, configStore.output.keepOriginalMipmaps, configStore.output.mipmapLevels]);

  const openYtd = async (paths: string[]) => {
    processStore.addLog("INFO", `${tr(language, "Importando", "Importing")} ${paths.length} ${tr(language, "arquivo(s) YTD...", "YTD file(s)...")}`);
    try {
      const result = await invoke<OpenYtdResponse>("open_ytd", { paths });
      if (!result.ytds || result.ytds.length === 0) {
        processStore.addLog("WARN", tr(language, "Nenhum YTD foi carregado. Verifique se os arquivos existem e sao validos.", "No YTD was loaded. Check whether files exist and are valid."));
        processStore.setExpanded(true);
        return;
      }
      ytdStore.addYtds(result.ytds);
      const first = result.ytds[0]?.textures[0];
      if (first) {
        ytdStore.setSelectedTexture(first.id);
      }
      processStore.addLog("INFO", `${result.ytds.length} ${tr(language, "YTD(s) carregado(s).", "YTD(s) loaded.")}`);
    } catch (error) {
      processStore.addLog("ERROR", `${tr(language, "Falha ao abrir YTD:", "Failed to open YTD:")} ${String(error)}`);
      processStore.setExpanded(true);
    }
  };

  const runProcessing = async (payload?: Record<string, unknown>) => {
    processStore.setStatus("processing");
    processStore.resetProgress();

    try {
      const result = await invoke<{ updated: TextureItem[] }>("process_textures", {
        config: {
          encoder: configStore.selectedEncoder,
          resize: configStore.resize,
          output: {
            ...configStore.output,
            keepOriginalMipmaps: configStore.output.keepOriginalMipmaps ?? true,
            generateMipmaps: configStore.output.generateMipmaps ?? false,
            mipmapLevels: Math.max(1, configStore.output.mipmapLevels ?? 1)
          },
          scopeMode: configStore.scopeMode,
          scopeYtdId: configStore.scopeYtdId,
          export: configStore.exportConfig,
          exclusions: ytdStore.exclusions,
          globalExclusions: ytdStore.globalExclusions,
          ...payload
        }
      });

      const byYtd = new Map<string, TextureItem[]>();
      for (const texture of result.updated) {
        const ytdId = texture.id.split("::")[0];
        const list = byYtd.get(ytdId) ?? [];
        list.push(texture);
        byYtd.set(ytdId, list);
      }

      if (result.updated.length > 0) {
        ytdStore.checkpoint();
      }

      for (const [ytdId, textures] of byYtd.entries()) {
        for (const texture of textures) {
          useYtdStore.getState().upsertTexture(ytdId, texture);
        }
      }

      processStore.setStatus("success");
      processStore.addLog("SUCCESS", `${tr(language, "Processamento concluido:", "Processing completed:")} ${result.updated.length} ${tr(language, "textura(s).", "texture(s).")}`);
      await configStore.syncToTauriStore().catch(() => null);
    } catch (error) {
      processStore.setStatus("error");
      processStore.addLog("ERROR", `${tr(language, "Falha no processamento:", "Processing failed:")} ${String(error)}`);
      processStore.setExpanded(true);
    }
  };

  const exportTexture = async (ytdId: string, textureId: string, optimized: boolean, textureName: string, format: "dds" | "png") => {

    const outPath = await save({
      defaultPath: `${textureName}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });
    if (!outPath || Array.isArray(outPath)) {
      return;
    }

    await invoke("export_texture", {
      ytdId,
      textureId,
      optimized,
      format,
      outputPath: outPath
    });
  };

  const requestTextureExport = (ytdId: string, textureId: string, optimized: boolean, textureName: string) => {
    setExportDialog({
      open: true,
      ytdId,
      textureId,
      optimized,
      textureName,
      format: "dds"
    });
  };

  const quickAction = async (action: QuickAction, ytdId: string, textureId: string) => {
    const ytd = ytdStore.ytds.find((item) => item.id === ytdId);
    const texture = ytd?.textures.find((item) => item.id === textureId);
    if (!texture) {
      return;
    }

    try {
      if (action === "copy-name") {
        await navigator.clipboard.writeText(texture.name);
        processStore.addLog("INFO", `${tr(language, "Nome copiado:", "Name copied:")} ${texture.name}`);
        return;
      }

      if (action === "exclude") {
        ytdStore.toggleTextureExcluded(ytdId, textureId, true);
        ytdStore.addExclusionPattern(texture.name);
        processStore.addLog("WARN", `${texture.name} ${tr(language, "adicionada a exclusao.", "added to exclusions.")}`);
        return;
      }

      if (action === "rename") {
        const nextName = window.prompt(tr(language, "Novo nome da textura:", "New texture name:"), texture.name)?.trim();
        if (!nextName || nextName === texture.name) {
          return;
        }
        const result = await invoke<{ texture: TextureItem }>("rename_texture", { ytdId, textureId, newName: nextName });
        ytdStore.renameTexture(ytdId, textureId, result.texture);
        processStore.addLog("SUCCESS", `${tr(language, "Textura renomeada para", "Texture renamed to")} ${result.texture.name}`);
        return;
      }
      if (action === "delete-texture") {
        await invoke("remove_texture", { ytdId, textureId });
        ytdStore.removeTexture(ytdId, textureId);
        processStore.addLog("SUCCESS", `${tr(language, "Textura removida do YTD:", "Texture removed from YTD:")} ${texture.name}`);
        return;
      }

      if (action === "optimize") {
        await runProcessing({ mode: "single-texture", ytdId, textureId });
        return;
      }

      if (action === "export-original") {
        requestTextureExport(ytdId, textureId, false, texture.name);
        return;
      }

      if (action === "export-optimized") {
        if (!texture.optimizedInfo) {
          processStore.addLog("WARN", tr(language, "Esta textura ainda nao foi otimizada.", "This texture is not optimized yet."));
          return;
        }
        requestTextureExport(ytdId, textureId, true, `${texture.name}_optimized`);
      }
    } catch (error) {
      processStore.addLog("ERROR", `${tr(language, "Falha na acao:", "Action failed:")} ${String(error)}`);
      processStore.setExpanded(true);
    }
  };

  const cancelProcessing = async () => {
    await invoke("cancel_processing");
    processStore.setStatus("idle");
    processStore.addLog("WARN", tr(language, "Processamento cancelado pelo usuario.", "Processing canceled by user."));
  };

  const fixSelectedPowerOfTwo = async () => {
    if (!selected || !selectedTexture) {
      return;
    }
    if (isPowerOfTwo(selectedTexture.width) && isPowerOfTwo(selectedTexture.height)) {
      return;
    }

    const suggestedWidth = nearestPowerOfTwo(selectedTexture.width) || nextPowerOfTwo(selectedTexture.width);
    const suggestedHeight = nearestPowerOfTwo(selectedTexture.height) || nextPowerOfTwo(selectedTexture.height);
    setPowerFixDialog({
      open: true,
      ytdId: selected.ytd.id,
      textureId: selectedTexture.id,
      width: String(suggestedWidth),
      height: String(suggestedHeight)
    });
  };

  const confirmFixPowerOfTwo = async () => {
    const fixedWidth = Math.max(1, Number.parseInt(powerFixDialog.width, 10));
    const fixedHeight = Math.max(1, Number.parseInt(powerFixDialog.height, 10));
    if (!Number.isFinite(fixedWidth) || !Number.isFinite(fixedHeight)) {
      processStore.addLog("WARN", tr(language, "Dimensoes invalidas.", "Invalid dimensions."));
      return;
    }
    if (!isPowerOfTwo(fixedWidth) || !isPowerOfTwo(fixedHeight)) {
      processStore.addLog("WARN", tr(language, "Use valores em potencia de 2.", "Use power-of-two values."));
      return;
    }

    processStore.addLog("INFO", `${tr(language, "Corrigindo textura para potencia de 2:", "Fixing texture to power-of-two:")} ${fixedWidth}x${fixedHeight}`);
    try {
      await runProcessing({
        mode: "single-texture",
        ytdId: powerFixDialog.ytdId,
        textureId: powerFixDialog.textureId,
        resize: {
          ...configStore.resize,
          mode: "custom",
          keepAspectRatio: false,
          minFilterThreshold: "none",
          width: fixedWidth,
          height: fixedHeight
        }
      });
    } finally {
      setPowerFixDialog((prev) => ({ ...prev, open: false }));
    }
  };

  const exportYtd = async () => {
    let selectedDir = "";
    let customFileName = "";

    if (ytdStore.ytds.length === 1) {
      const sourceName = ytdStore.ytds[0].name;
      const selectedPath = await save({
        defaultPath: sourceName,
        filters: [{ name: "YTD", extensions: ["ytd"] }]
      });
      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      const normalized = selectedPath.replaceAll("\\", "/");
      const parts = normalized.split("/");
      customFileName = parts.pop() ?? sourceName;
      selectedDir = parts.join("/") || ".";
    } else {
      const chosenDir = await open({ directory: true, multiple: false });
      if (!chosenDir || Array.isArray(chosenDir)) {
        return;
      }
      selectedDir = chosenDir;
    }

    try {
      const result = await invoke<{ saved: string[]; csvReports?: string[]; backupFiles?: string[] }>("save_ytd", {
        config: {
          mode: "custom",
          outputDir: selectedDir,
          customFileName,
          createBackup: configStore.exportConfig.createBackup,
          exportCsv: configStore.exportConfig.exportCsv
        }
      });

      processStore.addLog("SUCCESS", `${tr(language, "YTD(s) exportado(s):", "YTD(s) exported:")} ${result.saved.length}`);
      if (result.backupFiles && result.backupFiles.length > 0) {
        processStore.addLog("INFO", `${tr(language, "Backup(s) criado(s):", "Backup(s) created:")} ${result.backupFiles.length}`);
      }
      if (result.csvReports && result.csvReports.length > 0) {
        processStore.addLog("INFO", `${tr(language, "CSV(s) gerado(s):", "CSV(s) generated:")} ${result.csvReports.length}`);
      }
    } catch (error) {
      processStore.addLog("ERROR", `${tr(language, "Falha ao exportar YTD:", "Failed to export YTD:")} ${String(error)}`);
      processStore.setExpanded(true);
    }
  };

  const statusExpanded = processStore.expanded;

  return (
    <div className="h-full w-full bg-bg text-text flex flex-col">
      <TopBar
        onOpenYtd={openYtd}
        onUndo={() => {
          ytdStore.undo();
          processStore.addLog("INFO", tr(language, "Ultima acao desfeita.", "Last action undone."));
        }}
        canUndo={canUndo}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={22} minSize={16} maxSize={35}>
          <HierarchyTree onQuickAction={quickAction} />
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-accent/40" />

        <Panel defaultSize={48} minSize={30}>
          <main className="h-full flex flex-col bg-[#111117]">
            <div className="h-9 border-b border-border px-2 flex items-center gap-2 text-xs">
              <button className={`h-7 px-3 rounded-sm border ${centerTab === "preview" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setCenterTab("preview")}>
                {tr(language, "Preview", "Preview")}
              </button>
              <button className={`h-7 px-3 rounded-sm border ${centerTab === "exclusions" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setCenterTab("exclusions")}>
                {tr(language, "Exclusoes", "Exclusions")}
              </button>
            </div>

            {centerTab === "preview" ? (
              <>
                <div className="h-9 border-b border-border px-2 flex items-center gap-2 text-xs">
                  <button className={`h-7 px-3 rounded-sm border ${previewTab === "original" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setPreviewTab("original")}>
                    {tr(language, "Original", "Original")}
                  </button>
                  <button className={`h-7 px-3 rounded-sm border ${previewTab === "optimized" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setPreviewTab("optimized")}>
                    {tr(language, "Otimizada", "Optimized")}
                  </button>
                  <button className={`h-7 px-3 rounded-sm border ${previewTab === "compare" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setPreviewTab("compare")}>
                    {tr(language, "Comparar lado a lado", "Compare side by side")}
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {!selectedTexture ? (
                    <div className="h-full flex items-center justify-center text-muted text-sm">{tr(language, "Selecione uma textura na hierarquia para visualizar", "Select a texture in the hierarchy to preview")}</div>
                  ) : previewTab === "compare" ? (
                    <CompareView original={selectedTexture.originalPreview} optimized={selectedTexture.optimizedPreview} />
                  ) : (
                    <TexturePreview imageBase64={previewTab === "original" ? selectedTexture.originalPreview : selectedTexture.optimizedPreview} label={previewTab === "original" ? "Original" : "Otimizada"} />
                  )}
                </div>
                <TextureInfo
                  texture={selectedTexture}
                  processing={processStore.status === "processing"}
                  onFixPowerOfTwo={fixSelectedPowerOfTwo}
                />
              </>
            ) : (
              <ExclusionsList exclusions={ytdStore.exclusions} global={ytdStore.globalExclusions} onAdd={ytdStore.addExclusionPattern} onRemove={ytdStore.removeExclusionPattern} onSetGlobal={ytdStore.setGlobalExclusions} />
            )}
          </main>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-accent/40" />

        <Panel defaultSize={30} minSize={20} maxSize={40}>
          <aside className="h-full overflow-auto scrollbar p-3 space-y-3 bg-surface border-l border-border">
            <EncoderSelector encoders={configStore.encoders} selected={configStore.selectedEncoder} onChange={configStore.setSelectedEncoder} />
            <ResizeConfig value={configStore.resize} originalSize={selectedTexture ? { width: selectedTexture.width, height: selectedTexture.height } : undefined} onChange={configStore.setResize} />
            <FormatSelector value={configStore.output} onChange={configStore.setOutput} />
            <MipmapConfig value={configStore.output} currentMipCount={selectedTexture?.mipCount} onChange={configStore.setOutput} />
            <ScopeSelector mode={configStore.scopeMode} ytdId={configStore.scopeYtdId} ytds={ytdStore.ytds} onChange={configStore.setScope} />
            <ExportConfig value={configStore.exportConfig} onChange={configStore.setExportConfig} />
            <ActionButtons
              processing={processStore.status === "processing"}
              progress={processStore.globalProgress}
              line={processStore.currentLogLine}
              canExportYtd={hasOptimizedTextures}
              onProcessSelected={() => runProcessing({ mode: "selected" })}
              onProcessAll={() => runProcessing({ mode: "all" })}
              onExportYtd={exportYtd}
              onCancel={cancelProcessing}
            />
          </aside>
        </Panel>
      </PanelGroup>

      <StatusBar onToggleLog={() => processStore.setExpanded(!statusExpanded)} />
      {exportDialog.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-[360px] max-w-[92vw] rounded-sm border border-border bg-surface p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text">
              {tr(language, "Exportar textura", "Export texture")}
            </h3>
            <div className="text-xs text-muted">
              {tr(language, "Escolha o formato de exportacao:", "Choose the export format:")}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={exportDialog.format === "dds"}
                onChange={() => setExportDialog((prev) => ({ ...prev, format: "dds" }))}
              />
              DDS
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={exportDialog.format === "png"}
                onChange={() => setExportDialog((prev) => ({ ...prev, format: "png" }))}
              />
              PNG
            </label>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                className="h-8 px-3 border border-border rounded-sm text-xs"
                onClick={() => setExportDialog((prev) => ({ ...prev, open: false }))}
              >
                {tr(language, "Cancelar", "Cancel")}
              </button>
              <button
                className="h-8 px-3 rounded-sm bg-accent text-white text-xs"
                onClick={async () => {
                  try {
                    await exportTexture(
                      exportDialog.ytdId,
                      exportDialog.textureId,
                      exportDialog.optimized,
                      exportDialog.textureName,
                      exportDialog.format
                    );
                    processStore.addLog(
                      "SUCCESS",
                      exportDialog.optimized
                        ? `${tr(language, "Textura otimizada exportada:", "Optimized texture exported:")} ${exportDialog.textureName}`
                        : `${tr(language, "Textura original exportada:", "Original texture exported:")} ${exportDialog.textureName}`
                    );
                  } catch (error) {
                    processStore.addLog("ERROR", `${tr(language, "Falha na exportacao:", "Export failed:")} ${String(error)}`);
                  } finally {
                    setExportDialog((prev) => ({ ...prev, open: false }));
                  }
                }}
              >
                {tr(language, "Exportar", "Export")}
              </button>
            </div>
          </div>
        </div>
      )}
      {powerFixDialog.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-[360px] max-w-[92vw] rounded-sm border border-border bg-surface p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text">{tr(language, "Corrigir potencia de 2", "Fix power of two")}</h3>
            <div className="text-xs text-muted">
              {tr(language, "Defina largura e altura em potencia de 2.", "Set width and height using power-of-two values.")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={powerFixDialog.width}
                onChange={(event) => setPowerFixDialog((prev) => ({ ...prev, width: event.target.value }))}
                className="h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs text-text"
                placeholder={tr(language, "Largura", "Width")}
              />
              <input
                value={powerFixDialog.height}
                onChange={(event) => setPowerFixDialog((prev) => ({ ...prev, height: event.target.value }))}
                className="h-8 bg-[#0f0f14] border border-border rounded-sm px-2 text-xs text-text"
                placeholder={tr(language, "Altura", "Height")}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="h-8 px-3 border border-border rounded-sm text-xs" onClick={() => setPowerFixDialog((prev) => ({ ...prev, open: false }))}>
                {tr(language, "Cancelar", "Cancel")}
              </button>
              <button className="h-8 px-3 rounded-sm bg-accent text-white text-xs" onClick={confirmFixPowerOfTwo}>
                {tr(language, "Aplicar", "Apply")}
              </button>
            </div>
          </div>
        </div>
      )}
      {statusExpanded && <LogPanel />}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRedetectEncoders={configStore.setEncoders}
        onSaved={async () => {
          await configStore.syncToTauriStore();
          processStore.addLog("SUCCESS", tr(language, "Configuracoes salvas.", "Settings saved."));
        }}
        onLog={processStore.addLog}
      />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
