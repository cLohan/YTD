import trapoImg from "../../assets/trapo.png";
import { tr } from "../../lib/i18n";
import { useLanguageStore } from "../../store/languageStore";

export default function CreditsTab() {
  const language = useLanguageStore((s) => s.language);

  return (
    <div className="h-full w-full px-6 py-6 text-center flex flex-col items-center">
      <h3 className="text-base font-semibold text-[#e8e8f0]">YTD Texture Optimizer</h3>

      <img
        src={trapoImg}
        alt="Trapo"
        className="mt-6 h-[112px] w-[112px] rounded-full border-2 border-[#5b7cf6] object-cover"
        style={{ boxShadow: "0 0 18px rgba(91, 124, 246, 0.22)" }}
      />

      <div className="mt-4 text-[24px] font-semibold text-[#e8e8f0]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
        Trapo
      </div>
      <div className="mt-1 text-[13px] text-[#8a8aa0]">{tr(language, "Autor e Desenvolvedor", "Author and Developer")}</div>
      <div className="mt-1 text-[16px]">🇧🇷</div>

      <p className="mt-6 text-[13px] text-[#9a9ab0]">
        {tr(language, "Agradecimento ao droyen pelo suporte com IA.", "Thanks to droyen for the AI support.")}
      </p>

      <div className="mt-7 text-[12px] text-[#4a4a62]">
        {tr(language, "Construído com", "Built with")} CodeWalker.Core, SharpDX, Tauri, React
      </div>
      <div className="mt-1 text-[11px] text-[#4a4a62]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
        v1.0.0  2025
      </div>

      <div className="mt-6 w-full max-w-[560px] border-t border-[#1e1e26]" />

      <div className="mt-5 w-full max-w-[420px] rounded-[8px] border border-[#1e1e26] bg-[#0f0f14] px-5 py-4 text-left">
        <div className="text-[13px] font-medium text-[#e8e8f0]">🤖 {tr(language, "Este projeto foi 100% desenvolvido com IA", "This project was 100% developed with AI")}</div>
        <div className="mt-2 text-[12px] font-semibold text-[#f59e0b]" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {tr(language, "Se você pagou por isso, você foi enganado.", "If you paid for this, you were scammed.")}
        </div>
        <div className="mt-1.5 text-[11px] text-[#4a4a62]">{tr(language, "O código é aberto. O conhecimento é livre.", "Code is open. Knowledge is free.")}</div>
      </div>
    </div>
  );
}
