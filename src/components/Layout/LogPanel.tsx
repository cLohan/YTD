import { useEffect, useRef } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useProcessStore } from "../../store/processStore";
import { useLanguageStore } from "../../store/languageStore";
import { tr } from "../../lib/i18n";

export default function LogPanel() {
  const logs = useProcessStore((s) => s.logs);
  const pausedAutoScroll = useProcessStore((s) => s.pausedAutoScroll);
  const setPausedAutoScroll = useProcessStore((s) => s.setPausedAutoScroll);
  const clearLogs = useProcessStore((s) => s.clearLogs);
  const language = useLanguageStore((s) => s.language);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pausedAutoScroll) {
      return;
    }
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [logs, pausedAutoScroll]);

  const exportLog = async () => {
    const path = await save({ defaultPath: "ytd-optimizer-log.txt" });
    if (!path) {
      return;
    }
    const text = logs.map((item) => `[${item.timestamp}] [${item.level}] ${item.message}`).join("\n");
    await writeTextFile(path, text);
  };

  return (
    <section className="h-[180px] border-t border-border bg-[#101016] flex flex-col">
      <div className="h-8 px-3 flex items-center justify-between border-b border-border text-xs">
        <span className="text-text">{tr(language, "Log de Processamento", "Processing Log")}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-muted">
            <input type="checkbox" checked={pausedAutoScroll} onChange={(e) => setPausedAutoScroll(e.target.checked)} />
            {tr(language, "Pausar scroll", "Pause scroll")}
          </label>
          <button className="h-6 px-2 border border-border rounded-sm" onClick={clearLogs}>
            {tr(language, "Limpar Log", "Clear Log")}
          </button>
          <button className="h-6 px-2 border border-border rounded-sm" onClick={exportLog}>
            {tr(language, "Exportar Log .txt", "Export Log .txt")}
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto scrollbar font-mono text-[11px] p-2 space-y-1">
        {logs.map((item) => (
          <div key={item.id} className="whitespace-pre-wrap">
            <span className="text-muted">[{item.timestamp}]</span>{" "}
            <span
              className={
                item.level === "ERROR"
                  ? "text-error"
                  : item.level === "WARN"
                    ? "text-warn"
                    : item.level === "SUCCESS"
                      ? "text-success"
                      : "text-text"
              }
            >
              [{item.level}]
            </span>{" "}
            <span className="text-text">{item.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
