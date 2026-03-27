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
  status: "pending" | "compressing" | "queued" | "done" | "error" | "reoptimizing";
  previewUrl: string;
  /** Filename of the preserved original in uploads/tmp — enables Re-optimize */
  uploadId?: string;
  /** True when the output format was auto-changed (e.g. JPEG → WebP for alpha images) */
  formatOverridden?: boolean;
  /** Final quality/compressionLevel used during encoding */
  quality?: number;
  /** BullMQ job ID — set when processing is async (Redis mode) */
  jobId?: string;
}


