import type { LayoutPage, LayoutResult, LayoutSlot } from "./paperLayout";

export type ExportFormat = "png" | "jpeg";
export type ExportBackground = "white" | "transparent";
export type ExportDpi = 72 | 150 | 300;

export interface ExportImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

export interface ExportOptions {
  dpi: ExportDpi;
  quality: number;
  background: ExportBackground;
}

export type ExportProgress = (completed: number, total: number, label: string) => void;

const MAX_PAGE_SIDE = 12000;
const MAX_TOTAL_PIXELS = 60_000_000;

function imageFor(id: string, images: ExportImage[]): ExportImage | undefined {
  return images.find((image) => id === image.id || id.startsWith(image.id + "__repeat_"));
}

function loadImage(source: ExportImage): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`تعذر فتح الصورة: ${source.name}`));
    image.src = source.url;
  });
}

function safeBaseName(value: string): string {
  const name = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, "-");
  return (name || "waraqati").slice(0, 70);
}

function pagePixels(page: LayoutPage, dpi: ExportDpi): { width: number; height: number } {
  const width = Math.max(1, Math.round(page.width / 25.4 * dpi));
  const height = Math.max(1, Math.round(page.height / 25.4 * dpi));
  if (width > MAX_PAGE_SIDE || height > MAX_PAGE_SIDE || width * height > MAX_TOTAL_PIXELS) {
    throw new Error("دقة التصدير كبيرة جدًا لهذه الصفحة. اختر 72 أو 150 DPI.");
  }
  return { width, height };
}

async function renderPage(
  page: LayoutPage,
  images: ExportImage[],
  options: ExportOptions,
  format: ExportFormat | "pdf",
): Promise<HTMLCanvasElement> {
  const { width, height } = pagePixels(page, options.dpi);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: format !== "pdf" && options.background === "transparent" });
  if (!context) throw new Error("تعذر تهيئة مساحة رسم الصورة في هذا المتصفح.");
  context.clearRect(0, 0, width, height);
  if (format === "pdf" || options.background === "white") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  const scaleX = width / page.width;
  const scaleY = height / page.height;
  const cache = new Map<string, HTMLImageElement>();
  for (const slot of page.slots) {
    const placed = slot.image;
    if (!placed) continue;
    const source = imageFor(placed.imageId, images);
    if (!source) throw new Error("إحدى الصور المستخدمة في التخطيط لم تعد موجودة في المكتبة.");
    let bitmap = cache.get(source.id);
    if (!bitmap) {
      bitmap = await loadImage(source);
      cache.set(source.id, bitmap);
    }
    const region = placed.region;
    const draw = placed.draw;
    context.save();
    context.beginPath();
    context.rect(region.x * scaleX, region.y * scaleY, region.width * scaleX, region.height * scaleY);
    context.clip();
    const crop = placed.sourceCrop;
    const sx = Math.max(0, crop.x * bitmap.naturalWidth);
    const sy = Math.max(0, crop.y * bitmap.naturalHeight);
    const sw = Math.min(bitmap.naturalWidth - sx, crop.width * bitmap.naturalWidth);
    const sh = Math.min(bitmap.naturalHeight - sy, crop.height * bitmap.naturalHeight);
    if (sw <= 0 || sh <= 0) {
      context.restore();
      throw new Error(`منطقة القص غير صالحة للصورة: ${source.name}`);
    }
    context.drawImage(
      bitmap,
      sx, sy, sw, sh,
      draw.x * scaleX, draw.y * scaleY, draw.width * scaleX, draw.height * scaleY,
    );
    context.restore();
  }
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, mime: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("فشل المتصفح في إنشاء ملف الصورة.")), mime, quality);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportLayoutPageAsImage(
  layout: LayoutResult,
  images: ExportImage[],
  pageIndex: number,
  format: ExportFormat,
  options: ExportOptions,
  onProgress: ExportProgress,
  projectName: string,
): Promise<void> {
  const page = layout.pages[pageIndex];
  if (!page) throw new Error("الصفحة المحددة غير موجودة.");
  onProgress(0, 1, "render");
  const canvas = await renderPage(page, images, options, format);
  const blob = await canvasBlob(canvas, format === "png" ? "image/png" : "image/jpeg", options.quality);
  downloadBlob(blob, `${safeBaseName(projectName)}-page-${page.index}.${format === "jpeg" ? "jpg" : "png"}`);
  canvas.width = 1;
  canvas.height = 1;
  onProgress(1, 1, "done");
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function buildPdf(pages: Array<{ bytes: Uint8Array; width: number; height: number }>): Blob {
  const objects: Uint8Array[] = [];
  const offsets: number[] = [0];
  const addObject = (body: Uint8Array) => objects.push(body);
  addObject(ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  const pageRefs = pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  addObject(ascii(`<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`));
  pages.forEach((page, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const widthPt = page.width / 25.4 * 72;
    const heightPt = page.height / 25.4 * 72;
    addObject(ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(3)} ${heightPt.toFixed(3)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    addObject(joinBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${page.bytes.length ? page.width : 1} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`),
      page.bytes,
      ascii("\nendstream"),
    ]));
    const content = ascii(`q\n${widthPt.toFixed(3)} 0 0 ${heightPt.toFixed(3)} 0 0 cm\n/Im0 Do\nQ\n`);
    addObject(joinBytes([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii("endstream")]));
  });

  const parts: Uint8Array[] = [ascii("%PDF-1.4\n%Waraqati\n")];
  let offset = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(offset);
    const wrapped = joinBytes([ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n")]);
    parts.push(wrapped);
    offset += wrapped.length;
  });
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index++) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(ascii(xref));
  return new Blob(parts, { type: "application/pdf" });
}

export async function exportLayoutToPdf(
  layout: LayoutResult,
  images: ExportImage[],
  options: ExportOptions,
  onProgress: ExportProgress,
  projectName: string,
): Promise<void> {
  if (!layout.pages.length) throw new Error("لا توجد صفحات لتصديرها.");
  const totalPixels = layout.pages.reduce((sum, page) => {
    const size = pagePixels(page, options.dpi);
    return sum + size.width * size.height;
  }, 0);
  if (totalPixels > MAX_TOTAL_PIXELS) {
    throw new Error("المشروع كبير جدًا لهذه الدقة. اختر 72 أو 150 DPI أو قلل عدد الصفحات.");
  }

  const rendered: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  for (let index = 0; index < layout.pages.length; index++) {
    onProgress(index, layout.pages.length, "render");
    const page = layout.pages[index];
    const canvas = await renderPage(page, images, options, "pdf");
    const blob = await canvasBlob(canvas, "image/jpeg", options.quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    rendered.push({ bytes, width: page.width, height: page.height });
    canvas.width = 1;
    canvas.height = 1;
    onProgress(index + 1, layout.pages.length, "render");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  onProgress(layout.pages.length, layout.pages.length, "package");
  downloadBlob(buildPdf(rendered), `${safeBaseName(projectName)}.pdf`);
  rendered.length = 0;
  onProgress(layout.pages.length, layout.pages.length, "done");
}
