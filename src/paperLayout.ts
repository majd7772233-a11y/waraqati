/**
 * Shared, deterministic paper-layout engine.
 *
 * All public input dimensions use the selected unit; all calculated geometry is
 * normalized to millimetres so previews and future exporters can share it.
 * Coordinates use the page's top-left corner as (0, 0).
 */

export type MeasurementUnit = "mm" | "cm" | "in";
export type PaperPreset = "A3" | "A4" | "A5" | "Letter";
export type PaperOrientation = "portrait" | "landscape";
export type ImageFit = "contain" | "cover";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type PaperSize =
  | { preset: PaperPreset }
  | { preset: "custom"; width: number; height: number };

export interface PaperSettings {
  size: PaperSize;
  orientation: PaperOrientation;
  unit: MeasurementUnit;
  margins: Insets;
  gap: number;
}

export interface ImageSource {
  id: string;
  width: number;
  height: number;
}

export interface GridDefinition {
  rows: number;
  columns: number;
  /** Optional override in the selected unit. Defaults to PaperSettings.gap. */
  gap?: number;
}

export interface RegionDefinition {
  id?: string;
  /** Position and dimensions are measured from the page's top-left, in settings.unit. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaperMetrics {
  width: number;
  height: number;
  margins: Insets;
  gap: number;
  content: Rect;
}

export interface ImagePlacement {
  imageId: string;
  regionId: string;
  /** The target region on the page, in millimetres. */
  region: Rect;
  /** The rendered image rectangle, in millimetres. For cover this equals region. */
  draw: Rect;
  fit: ImageFit;
  /** Normalized source crop (0..1), allowing exporters to crop without distortion. */
  sourceCrop: { x: number; y: number; width: number; height: number };
}

export interface LayoutSlot {
  region: Rect;
  regionId: string;
  image: ImagePlacement | null;
}

export interface LayoutPage {
  /** 1-based page index. */
  index: number;
  width: number;
  height: number;
  slots: LayoutSlot[];
}

export interface LayoutResult {
  unit: "mm";
  paper: PaperMetrics;
  pages: LayoutPage[];
  imageCount: number;
  regionCount: number;
  pageCount: number;
}

export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutError";
  }
}

const MM_PER_UNIT: Record<MeasurementUnit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
};

const PAPER_PRESETS_MM: Record<PaperPreset, { width: number; height: number }> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
};

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new LayoutError(`${label} must be a finite number greater than zero.`);
  }
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new LayoutError(`${label} must be a finite number greater than or equal to zero.`);
  }
  return value;
}

function toMm(value: number, unit: MeasurementUnit): number {
  return value * MM_PER_UNIT[unit];
}

function normalizeRect(rect: RegionDefinition, unit: MeasurementUnit, label: string): Rect {
  finiteNonNegative(rect.x, `${label}.x`);
  finiteNonNegative(rect.y, `${label}.y`);
  finitePositive(rect.width, `${label}.width`);
  finitePositive(rect.height, `${label}.height`);
  return {
    x: toMm(rect.x, unit),
    y: toMm(rect.y, unit),
    width: toMm(rect.width, unit),
    height: toMm(rect.height, unit),
  };
}

/** Returns standard paper dimensions in millimetres, applying orientation. */
export function getPaperDimensions(size: PaperSize, orientation: PaperOrientation, unit: MeasurementUnit = "mm"): { width: number; height: number } {
  let base: { width: number; height: number };
  if (size.preset === "custom") {
    base = {
      width: toMm(finitePositive(size.width, "custom width"), unit),
      height: toMm(finitePositive(size.height, "custom height"), unit),
    };
  } else {
    base = PAPER_PRESETS_MM[size.preset];
    if (!base) throw new LayoutError("Unsupported paper preset.");
  }
  const width = orientation === "landscape" ? Math.max(base.width, base.height) : Math.min(base.width, base.height);
  const height = orientation === "landscape" ? Math.min(base.width, base.height) : Math.max(base.width, base.height);
  return { width, height };
}

/** Normalizes paper settings and validates that margins leave a usable content area. */
export function calculatePaperMetrics(settings: PaperSettings): PaperMetrics {
  const dimensions = getPaperDimensions(settings.size, settings.orientation, settings.unit);
  const margins: Insets = {
    top: toMm(finiteNonNegative(settings.margins.top, "top margin"), settings.unit),
    right: toMm(finiteNonNegative(settings.margins.right, "right margin"), settings.unit),
    bottom: toMm(finiteNonNegative(settings.margins.bottom, "bottom margin"), settings.unit),
    left: toMm(finiteNonNegative(settings.margins.left, "left margin"), settings.unit),
  };
  const gap = toMm(finiteNonNegative(settings.gap, "gap"), settings.unit);
  const content = {
    x: margins.left,
    y: margins.top,
    width: dimensions.width - margins.left - margins.right,
    height: dimensions.height - margins.top - margins.bottom,
  };
  if (content.width <= 0 || content.height <= 0) {
    throw new LayoutError("Margins leave no printable content area.");
  }
  return { ...dimensions, margins, gap, content };
}

/** Creates row-major, equal-sized regions inside the paper content rectangle. */
export function createGridRegions(
  paper: PaperMetrics,
  grid: GridDefinition,
  gapOverride?: number,
): Rect[] {
  if (!Number.isInteger(grid.rows) || grid.rows < 1) throw new LayoutError("Grid rows must be a positive integer.");
  if (!Number.isInteger(grid.columns) || grid.columns < 1) throw new LayoutError("Grid columns must be a positive integer.");
  const gap = finiteNonNegative(gapOverride ?? grid.gap ?? paper.gap, "grid gap");
  const totalGapX = (grid.columns - 1) * gap;
  const totalGapY = (grid.rows - 1) * gap;
  const cellWidth = (paper.content.width - totalGapX) / grid.columns;
  const cellHeight = (paper.content.height - totalGapY) / grid.rows;
  if (cellWidth <= 0 || cellHeight <= 0) throw new LayoutError("Grid gaps are too large for the available paper area.");
  const regions: Rect[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      regions.push({
        x: paper.content.x + column * (cellWidth + gap),
        y: paper.content.y + row * (cellHeight + gap),
        width: cellWidth,
        height: cellHeight,
      });
    }
  }
  return regions;
}

/** Converts custom region definitions to millimetres and ensures each stays within the page. */
export function normalizeRegions(
  definitions: RegionDefinition[],
  settings: PaperSettings,
  paper = calculatePaperMetrics(settings),
): Rect[] {
  if (!definitions.length) throw new LayoutError("At least one layout region is required.");
  return definitions.map((definition, index) => {
    const rect = normalizeRect(definition, settings.unit, `region ${index + 1}`);
    const epsilon = 1e-7;
    if (rect.x + rect.width > paper.width + epsilon || rect.y + rect.height > paper.height + epsilon) {
      throw new LayoutError(`Region ${index + 1} extends beyond the paper boundaries.`);
    }
    return rect;
  });
}

/** Calculates centered contain/cover geometry while preserving the source aspect ratio. */
export function placeImage(image: ImageSource, region: Rect, fit: ImageFit = "contain", regionId = "region-1"): ImagePlacement {
  finitePositive(image.width, "image width");
  finitePositive(image.height, "image height");
  finitePositive(region.width, "region width");
  finitePositive(region.height, "region height");
  const sourceRatio = image.width / image.height;
  const targetRatio = region.width / region.height;

  if (fit === "cover") {
    let cropX = 0, cropY = 0, cropWidth = 1, cropHeight = 1;
    if (sourceRatio > targetRatio) {
      cropWidth = targetRatio / sourceRatio;
      cropX = (1 - cropWidth) / 2;
    } else if (sourceRatio < targetRatio) {
      cropHeight = sourceRatio / targetRatio;
      cropY = (1 - cropHeight) / 2;
    }
    return {
      imageId: image.id,
      regionId,
      region: { ...region },
      draw: { ...region },
      fit,
      sourceCrop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
    };
  }

  const scale = Math.min(region.width / image.width, region.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    imageId: image.id,
    regionId,
    region: { ...region },
    draw: {
      x: region.x + (region.width - width) / 2,
      y: region.y + (region.height - height) / 2,
      width,
      height,
    },
    fit: "contain",
    sourceCrop: { x: 0, y: 0, width: 1, height: 1 },
  };
}

export interface LayoutRequest {
  settings: PaperSettings;
  images: ImageSource[];
  /** Provide either explicit regions in settings.unit or a grid, but not both. */
  regions?: RegionDefinition[];
  grid?: GridDefinition;
  fit?: ImageFit;
}

/**
 * Places images into regions in stable input order. Excess images continue on
 * later pages; a final partially-filled page retains empty slots for predictable
 * layout/preview behavior. No image is silently dropped or stretched.
 */
export function calculateLayout(request: LayoutRequest): LayoutResult {
  if (request.regions && request.grid) {
    throw new LayoutError("Choose either explicit regions or a grid, not both.");
  }
  const paper = calculatePaperMetrics(request.settings);
  const regions = request.regions
    ? normalizeRegions(request.regions, request.settings, paper)
    : request.grid
      ? createGridRegions(paper, {
          ...request.grid,
          gap: request.grid.gap === undefined ? paper.gap : toMm(request.grid.gap, request.settings.unit),
        })
      : [];

  if (!regions.length) throw new LayoutError("Provide custom regions or a grid definition.");
  const imageIds = new Set<string>();
  request.images.forEach((image, index) => {
    if (!image.id.trim()) throw new LayoutError(`Image ${index + 1} is missing an id.`);
    if (imageIds.has(image.id)) throw new LayoutError(`Duplicate image id: ${image.id}`);
    imageIds.add(image.id);
    finitePositive(image.width, `image ${image.id} width`);
    finitePositive(image.height, `image ${image.id} height`);
  });

  const pageCount = Math.ceil(request.images.length / regions.length);
  const pages: LayoutPage[] = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const slots = regions.map((region, regionIndex): LayoutSlot => {
      const image = request.images[pageIndex * regions.length + regionIndex];
      const regionId = request.regions?.[regionIndex]?.id?.trim() || `region-${regionIndex + 1}`;
      return {
        region: { ...region },
        regionId,
        image: image ? placeImage(image, region, request.fit ?? "contain", regionId) : null,
      };
    });
    pages.push({ index: pageIndex + 1, width: paper.width, height: paper.height, slots });
  }

  return {
    unit: "mm",
    paper,
    pages,
    imageCount: request.images.length,
    regionCount: regions.length,
    pageCount,
  };
}
