export interface CompressedFile {
  id: string;
  originalName: string;
  outputName: string;
  outputUrl: string;
  outputFormat: string;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
  error: string | null;
  status: "pending" | "compressing" | "done" | "error";
  previewUrl: string; // local object URL for original image
}
