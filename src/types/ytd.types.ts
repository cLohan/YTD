export type TextureStatus = "ready" | "excluded" | "active" | "processed" | "error";

export type EncoderType = "internal" | "nvtt" | "texconv" | "magick";

export type ResizeMode = "custom" | "percent" | "keep";

export type ScopeMode = "selected" | "all" | "single-ytd";

export type ExportMode = "overwrite" | "suffix" | "custom";

export interface TextureItem {
  id: string;
  name: string;
  width: number;
  height: number;
  mipCount: number;
  format: string;
  sizeKb: number;
  checked: boolean;
  excluded: boolean;
  status: TextureStatus;
  originalPreview?: string;
  optimizedPreview?: string;
  optimizedInfo?: {
    width: number;
    height: number;
    mipCount: number;
    format: string;
    sizeKb: number;
  };
  error?: string;
}

export interface YtdFileItem {
  id: string;
  path: string;
  name: string;
  expanded: boolean;
  checked: boolean;
  processedCount: number;
  textures: TextureItem[];
}

export interface EncoderInfo {
  id: EncoderType;
  label: string;
  detected: boolean;
  source?: string;
}

export interface ResizeConfig {
  mode: ResizeMode;
  width: number;
  height: number;
  keepAspectRatio: boolean;
  minFilterThreshold: string;
  percentage: number;
}

export interface OutputConfig {
  format: string;
  generateMipmaps: boolean;
  keepOriginalMipmaps: boolean;
  mipmapLevels: number;
  maxQuality: boolean;
}

export interface ExportConfig {
  mode: ExportMode;
  outputDir: string;
  createBackup: boolean;
  exportCsv: boolean;
}

export interface ProcessingProgress {
  ytd: string;
  texture: string;
  current: number;
  total: number;
  phase: "encoding" | "resizing" | "saving" | "completed";
}

export interface ProcessLogItem {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
}

export interface OpenYtdResponse {
  ytds: YtdFileItem[];
}
