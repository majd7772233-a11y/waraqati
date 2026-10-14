export type OutputImageFormat = "image/png" | "image/jpeg" | "image/webp";
export type Rotation = 0 | 90 | 180 | 270;

export interface ImageProcessOptions {
  format: OutputImageFormat;
  maxWidth: number;
  maxHeight: number;
  quality: number;
  rotation: Rotation;
  trimTransparent: boolean;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function decodeImage(file: File): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(file);
  if (!bitmap.width || !bitmap.height) {
    bitmap.close();
    throw new Error("The selected image has invalid dimensions.");
  }
  return bitmap;
}

function transparentBounds(canvas: HTMLCanvasElement): { x: number; y: number; width: number; height: number } | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas pixel access is unavailable.");
  const { width, height } = canvas;
  if (width * height > 40_000_000) throw new Error("Image is too large for transparent-edge analysis (maximum 40 million pixels).");
  const pixels = context.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function processImage(file: File, options: ImageProcessOptions): Promise<ProcessedImage> {
  const bitmap = await decodeImage(file);
  try {
    const swapped = options.rotation === 90 || options.rotation === 270;
    let sourceWidth = swapped ? bitmap.height : bitmap.width;
    let sourceHeight = swapped ? bitmap.width : bitmap.height;
    const maxWidth = Math.max(1, Math.floor(options.maxWidth || sourceWidth));
    const maxHeight = Math.max(1, Math.floor(options.maxHeight || sourceHeight));
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));
    if (width * height > 40_000_000) throw new Error("Output would exceed the 40 million pixel safety limit.");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: options.trimTransparent });
    if (!context) throw new Error("Canvas rendering is unavailable.");
    if (options.format === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(options.rotation * Math.PI / 180);
    const drawWidth = options.rotation === 90 || options.rotation === 270 ? height : width;
    const drawHeight = options.rotation === 90 || options.rotation === 270 ? width : height;
    context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();

    if (options.trimTransparent && options.format !== "image/jpeg") {
      const bounds = transparentBounds(canvas);
      if (!bounds) throw new Error("The image is fully transparent; there is nothing to trim.");
      if (bounds.x !== 0 || bounds.y !== 0 || bounds.width !== width || bounds.height !== height) {
        const trimmed = document.createElement("canvas");
        trimmed.width = bounds.width;
        trimmed.height = bounds.height;
        const trimmedContext = trimmed.getContext("2d");
        if (!trimmedContext) throw new Error("Canvas rendering is unavailable.");
        trimmedContext.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
        canvas.width = trimmed.width;
        canvas.height = trimmed.height;
        const finalContext = canvas.getContext("2d");
        if (!finalContext) throw new Error("Canvas rendering is unavailable.");
        finalContext.drawImage(trimmed, 0, 0);
        width = canvas.width;
        height = canvas.height;
      }
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("The browser could not encode this image format.")), options.format, options.quality);
    });
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}

export function outputExtension(format: OutputImageFormat): string {
  return format === "image/jpeg" ? "jpg" : format === "image/webp" ? "webp" : "png";
}

export function makeOutputName(template: string, originalName: string, index: number, format: OutputImageFormat): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  const extension = outputExtension(format);
  const safeBase = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim() || "image";
  const rendered = template.replace(/\{name\}/g, safeBase).replace(/\{n\}/g, String(index + 1)).replace(/\{ext\}/g, extension);
  const cleaned = rendered.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().replace(/\.+$/g, "");
  return (cleaned || safeBase) + "." + extension;
}

export async function sha256(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("This browser does not expose secure SHA-256 support. Use a secure context (HTTPS) to compare duplicates.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
