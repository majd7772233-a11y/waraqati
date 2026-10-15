import { describe, expect, it } from "vitest";
import { calculateLayout, getPaperDimensions, placeImage, type PaperSettings } from "./paperLayout";

const settings: PaperSettings = {
  size: { preset: "A4" },
  orientation: "portrait",
  unit: "mm",
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  gap: 4,
};

describe("paper layout regression coverage", () => {
  it("normalizes standard paper sizes and orientation", () => {
    expect(getPaperDimensions({ preset: "A4" }, "portrait")).toEqual({ width: 210, height: 297 });
    expect(getPaperDimensions({ preset: "A4" }, "landscape")).toEqual({ width: 297, height: 210 });
    expect(getPaperDimensions({ preset: "custom", width: 10, height: 20 }, "portrait", "cm")).toEqual({ width: 100, height: 200 });
  });

  it("preserves aspect ratio in contain mode", () => {
    const placed = placeImage({ id: "wide", width: 1600, height: 900 }, { x: 0, y: 0, width: 100, height: 100 });
    expect(placed.draw.width / placed.draw.height).toBeCloseTo(16 / 9, 6);
    expect(placed.draw.x).toBe(0);
    expect(placed.draw.y).toBeGreaterThan(0);
    expect(placed.sourceCrop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("crops cover mode centrally without distorting the target region", () => {
    const placed = placeImage({ id: "wide", width: 1600, height: 900 }, { x: 5, y: 7, width: 100, height: 100 }, "cover");
    expect(placed.draw).toEqual({ x: 5, y: 7, width: 100, height: 100 });
    expect(placed.sourceCrop.x).toBeGreaterThan(0);
    expect(placed.sourceCrop.width).toBeLessThan(1);
    expect(placed.sourceCrop.y).toBe(0);
  });

  it("continues excess images to later pages and keeps empty slots", () => {
    const result = calculateLayout({
      settings,
      grid: { rows: 1, columns: 2 },
      images: [
        { id: "one", width: 100, height: 100 },
        { id: "two", width: 100, height: 100 },
        { id: "three", width: 100, height: 100 },
      ],
    });
    expect(result.pageCount).toBe(2);
    expect(result.pages[0].slots.map(slot => slot.image?.imageId)).toEqual(["one", "two"]);
    expect(result.pages[1].slots.map(slot => slot.image?.imageId ?? null)).toEqual(["three", null]);
  });

  it("rejects invalid dimensions and duplicate image identifiers", () => {
    expect(() => getPaperDimensions({ preset: "custom", width: 0, height: 10 }, "portrait")).toThrow();
    expect(() => calculateLayout({
      settings,
      grid: { rows: 1, columns: 1 },
      images: [{ id: "same", width: 1, height: 1 }, { id: "same", width: 2, height: 2 }],
    })).toThrow(/Duplicate image id/);
  });
});
