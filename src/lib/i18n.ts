export type AppLanguage = "pt" | "en";

export const tr = (language: AppLanguage, pt: string, en: string): string =>
  language === "en" ? en : pt;
