import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist");
const fail = (message) => {
  console.error(`Production artifact verification failed: ${message}`);
  process.exitCode = 1;
};

async function requireFile(relativePath) {
  const absolute = path.join(root, relativePath);
  try {
    const info = await stat(absolute);
    if (!info.isFile() || info.size === 0) throw new Error("not a non-empty file");
    return absolute;
  } catch {
    fail(`missing or empty dist/${relativePath}`);
    return null;
  }
}

const indexPath = await requireFile("index.html");
const manifestPath = await requireFile("manifest.webmanifest");
const workerPath = await requireFile("sw.js");
const iconPath = await requireFile("icon.svg");

if (indexPath && manifestPath && workerPath && iconPath) {
  const [html, manifestText, worker] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(workerPath, "utf8"),
  ]);

  let manifest;
  try { manifest = JSON.parse(manifestText); }
  catch { fail("manifest.webmanifest is not valid JSON"); }

  if (manifest) {
    for (const field of ["name", "short_name", "start_url", "scope", "display"]) {
      if (typeof manifest[field] !== "string" || !manifest[field].trim()) fail(`manifest field ${field} is missing`);
    }
    if (manifest.start_url?.startsWith("/") || manifest.scope?.startsWith("/")) {
      fail("manifest start_url and scope must remain relative for GitHub Pages project paths");
    }
    if (!Array.isArray(manifest.icons) || !manifest.icons.some(icon => icon.src === "./icon.svg")) {
      fail("manifest must reference the shipped SVG app icon");
    }
    for (const icon of manifest.icons ?? []) {
      const iconPathname = icon.src?.replace(/^\.\//, "");
      if (!iconPathname || !(await requireFile(iconPathname))) fail(`manifest icon cannot be resolved: ${icon.src}`);
    }
  }

  if (!html.includes("manifest.webmanifest")) fail("index.html does not link the PWA manifest");
  if (!/\bserviceWorker\b/.test(await readFile(path.resolve("src/main.tsx"), "utf8"))) fail("service worker registration is missing");
  if (!worker.includes("self.addEventListener(\"fetch\"")) fail("service worker fetch handler is missing");

  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])
    .filter(value => /\.(?:js|css|webmanifest|svg)(?:\?.*)?$/i.test(value));
  if (!references.some(value => value.endsWith(".js"))) fail("no JavaScript entry reference found in index.html");
  for (const reference of references) {
    if (/^(?:https?:)?\/\//i.test(reference)) continue;
    if (reference.startsWith("/")) {
      fail(`root-relative asset path is not safe for GitHub Pages project deployments: ${reference}`);
      continue;
    }
    const clean = decodeURIComponent(reference.split("?")[0]).replace(/^\.\//, "");
    if (!(await requireFile(clean))) fail(`index.html asset cannot be resolved: ${reference}`);
  }

  const assetsDir = path.join(root, "assets");
  try {
    const assets = await readdir(assetsDir);
    if (!assets.some(name => name.endsWith(".js"))) fail("dist/assets contains no JavaScript bundle");
    if (!assets.some(name => name.endsWith(".css"))) fail("dist/assets contains no CSS bundle");
  } catch { fail("dist/assets directory is missing"); }
}

if (process.exitCode) process.exit(process.exitCode);
console.log("Production artifact structure and relative PWA paths verified.");
