import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { EncoderInfo } from "../../types/ytd.types";
import { tr } from "../../lib/i18n";
import { useLanguageStore } from "../../store/languageStore";

type TabKey = "general" | "encoders" | "language";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onRedetectEncoders: (encoders: EncoderInfo[]) => void;
  onSaved: () => Promise<void>;
  onLog: (level: "INFO" | "WARN" | "ERROR" | "SUCCESS", message: string) => void;
}

export default function SettingsModal({ open, onClose, onRedetectEncoders, onSaved, onLog }: SettingsModalProps) {
  const [tab, setTab] = useState<TabKey>("general");
  const [notice, setNotice] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" });
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60">
      <div className="w-[720px] max-w-[94vw] h-[560px] rounded-sm border border-border bg-surface flex flex-col">
        <div className="h-11 border-b border-border px-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{tr(language, "Configurações", "Settings")}</h2>
          <button className="h-8 px-3 border border-border rounded-sm text-xs" onClick={onClose}>
            {tr(language, "Fechar", "Close")}
          </button>
        </div>

        <div className="h-10 border-b border-border px-2 flex items-center gap-2 text-xs">
          <button className={`h-7 px-3 rounded-sm border ${tab === "general" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setTab("general")}>
            {tr(language, "Geral", "General")}
          </button>
          <button className={`h-7 px-3 rounded-sm border ${tab === "encoders" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setTab("encoders")}>
            Encoders
          </button>
          <button className={`h-7 px-3 rounded-sm border ${tab === "language" ? "border-accent text-accent" : "border-border text-muted"}`} onClick={() => setTab("language")}>
            {tr(language, "Linguagem", "Language")}
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {tab === "general" && (
            <div className="h-full p-4 text-xs text-muted space-y-3">
              <p>{tr(language, "As configurações principais de processamento ficam no painel direito da tela principal.", "Main processing settings are available on the right panel of the main screen.")}</p>
              <button
                className="h-9 px-3 border border-border rounded-sm text-xs"
                onClick={async () => {
                  try {
                    await onSaved();
                    setNotice({
                      open: true,
                      title: tr(language, "Configurações", "Settings"),
                      message: tr(language, "Configurações salvas com sucesso.", "Settings saved successfully.")
                    });
                  } catch (error) {
                    onLog("ERROR", `${tr(language, "Falha ao salvar configurações:", "Failed to save settings:")} ${String(error)}`);
                    setNotice({
                      open: true,
                      title: tr(language, "Erro", "Error"),
                      message: tr(language, "Falha ao salvar configurações.", "Failed to save settings.")
                    });
                  }
                }}
              >
                {tr(language, "Salvar Configurações", "Save Settings")}
              </button>
            </div>
          )}

          {tab === "encoders" && (
            <div className="h-full p-4 text-xs text-muted space-y-3">
              <p>{tr(language, "Atualize a detecção de encoders externos instalados no sistema.", "Refresh detection for external encoders installed on your system.")}</p>
              <button
                className="h-9 px-3 border border-border rounded-sm text-xs"
                onClick={async () => {
                  try {
                    const encoders = await invoke<EncoderInfo[]>("detect_encoders");
                    onRedetectEncoders(encoders);
                    onLog("INFO", tr(language, "Detecção de encoders atualizada.", "Encoder detection updated."));
                    setNotice({
                      open: true,
                      title: tr(language, "Encoders", "Encoders"),
                      message: tr(language, "Detecção de encoders concluída.", "Encoder detection completed.")
                    });
                  } catch (error) {
                    onLog("ERROR", tr(language, "Falha ao detectar encoders:", "Failed to detect encoders:") + ` ${String(error)}`);
                    setNotice({
                      open: true,
                      title: tr(language, "Erro", "Error"),
                      message: tr(language, "Falha ao detectar encoders.", "Failed to detect encoders.")
                    });
                  }
                }}
              >
                {tr(language, "Redetectar Encoders", "Redetect Encoders")}
              </button>
            </div>
          )}

          {tab === "language" && (
            <div className="h-full p-4 text-xs text-muted space-y-3">
              <p>{tr(language, "Selecione o idioma da interface. O padrão é Português.", "Select the interface language. Default is Portuguese.")}</p>
              <label className="flex items-center gap-2">
                <input type="radio" checked={language === "pt"} onChange={() => setLanguage("pt")} />
                Português
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={language === "en"} onChange={() => setLanguage("en")} />
                English
              </label>
            </div>
          )}
        </div>
      </div>
      {notice.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-[340px] max-w-[92vw] rounded-sm border border-border bg-surface p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text">{notice.title}</h3>
            <div className="text-xs text-muted">{notice.message}</div>
            <div className="flex items-center justify-end">
              <button className="h-8 px-3 rounded-sm bg-accent text-white text-xs" onClick={() => setNotice((prev) => ({ ...prev, open: false }))}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
