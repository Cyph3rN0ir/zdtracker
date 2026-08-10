import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const publicDir = join(process.cwd(), ".output", "public");
const outputFile = join(publicDir, "offline-assets.json");
const allowedRootFiles = new Set([
  "apple-touch-icon.png",
  "favicon.ico",
  "icon-16.png",
  "icon-32.png",
  "icon-48.png",
  "icon-96.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
  "manifest.webmanifest",
  "zsync.png",
]);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else files.push(path);
  }
  return files;
}

const files = await walk(publicDir);
const assets = [];
for (const file of files) {
  const path = relative(publicDir, file).split(sep).join("/");
  if (
    path === "sw.js" ||
    path === "offline.html" ||
    path === "offline-assets.json" ||
    path.startsWith("workbox-") ||
    path.endsWith(".map")
  ) {
    continue;
  }
  if (!path.startsWith("assets/") && !allowedRootFiles.has(path)) continue;
  const info = await stat(file);
  assets.push({ url: `/${path}`, size: info.size });
}

assets.sort((a, b) => a.url.localeCompare(b.url));
await writeFile(
  outputFile,
  `${JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), assets }, null, 2)}\n`,
  "utf8",
);
console.log(`Offline manifest: ${assets.length} assets`);
