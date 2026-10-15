import { describe, expect, it } from "vitest";
import { isSupportedImage, readImageZip } from "./imageLibrary";

describe("image import safeguards", () => {
  it("accepts common image extensions case-insensitively", () => {
    for (const name of ["photo.JPG", "scan.PnG", "web.webp", "animation.GIF", "camera.AVIF", "print.TIFF"]) {
      expect(isSupportedImage(new File(["data"], name))).toBe(true);
    }
  });

  it("does not classify unrelated files as images", () => {
    expect(isSupportedImage(new File(["data"], "notes.txt", { type: "text/plain" }))).toBe(false);
    expect(isSupportedImage(new File(["data"], "archive.zip", { type: "application/zip" }))).toBe(false);
  });

  it("rejects malformed ZIP input instead of silently importing nothing", async () => {
    const file = new File(["not a zip"], "images.zip");
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("not a zip").buffer,
    });
    await expect(readImageZip(file)).rejects.toThrow("invalid-zip");
  });
});
