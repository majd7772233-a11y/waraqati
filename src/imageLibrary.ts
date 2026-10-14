export const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "avif", "tif", "tiff"
]);

export interface ZipImportResult {
  files: File[];
  unsupported: number;
  damaged: number;
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedImage(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const Stream = DecompressionStream as unknown as new (format: string) => TransformStream<Uint8Array, Uint8Array>;
  const stream = new Blob([data.slice().buffer as ArrayBuffer]).stream().pipeThrough(new Stream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Reads the ZIP central directory, then extracts supported image entries one at a time.
 * ZIP methods 0 (stored) and 8 (deflate) are supported without a third-party service.
 */
export async function readImageZip(file: File): Promise<ZipImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minOffset = Math.max(0, bytes.length - 65_557);
  let eocd = -1;

  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (readU32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("invalid-zip");

  const entryCount = readU16(view, eocd + 10);
  let cursor = readU32(view, eocd + 16);
  const decoder = new TextDecoder();
  const files: File[] = [];
  let unsupported = 0;
  let damaged = 0;

  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > bytes.length || readU32(view, cursor) !== 0x02014b50) {
      damaged++;
      break;
    }

    const flags = readU16(view, cursor + 8);
    const method = readU16(view, cursor + 10);
    const compressedSize = readU32(view, cursor + 20);
    const uncompressedSize = readU32(view, cursor + 24);
    const nameLength = readU16(view, cursor + 28);
    const extraLength = readU16(view, cursor + 30);
    const commentLength = readU16(view, cursor + 32);
    const localOffset = readU32(view, cursor + 42);
    const nameStart = cursor + 46;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    cursor = nameStart + nameLength + extraLength + commentLength;

    if (name.endsWith("/") || name.startsWith("__MACOSX/") || name.split("/").some(part => part === "..")) continue;
    if (!IMAGE_EXTENSIONS.has(extensionOf(name))) {
      unsupported++;
      continue;
    }
    if ((flags & 1) !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      damaged++;
      continue;
    }

    try {
      if (localOffset + 30 > bytes.length || readU32(view, localOffset) !== 0x04034b50) {
        damaged++;
        continue;
      }
      const localNameLength = readU16(view, localOffset + 26);
      const localExtraLength = readU16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) {
        damaged++;
        continue;
      }
      const compressed = bytes.slice(dataStart, dataEnd);
      let output: Uint8Array;
      if (method === 0) output = compressed;
      else if (method === 8) output = await inflateRaw(compressed);
      else {
        unsupported++;
        continue;
      }
      if (output.byteLength !== uncompressedSize) {
        damaged++;
        continue;
      }
      const safeName = name.split("/").pop() || "image";
      files.push(new File([output.slice().buffer as ArrayBuffer], safeName, { type: mimeFromName(safeName), lastModified: 0 }));
    } catch {
      damaged++;
    }
  }

  return { files, unsupported, damaged };
}

function mimeFromName(name: string): string {
  switch (extensionOf(name)) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "bmp": return "image/bmp";
    case "avif": return "image/avif";
    case "tif":
    case "tiff": return "image/tiff";
    default: return "application/octet-stream";
  }
}
