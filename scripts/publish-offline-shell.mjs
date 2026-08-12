import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const spaDir = path.join(root, "dist-spa");
const outputDir = path.join(root, "public", "offline-app");
const assetsDir = path.join(outputDir, "assets");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(path.join(spaDir, "assets"), assetsDir, { recursive: true });

// The service worker serves this document for arbitrary root routes during a
// cold offline launch. Root-relative asset URLs keep those scripts/styles
// pointed at the downloaded bundle regardless of the requested route.
const indexSource = await readFile(path.join(spaDir, "index.spa.html"), "utf8");
await writeFile(
  path.join(outputDir, "index.html"),
  indexSource.replaceAll("./assets/", "/offline-app/assets/"),
);

// Historical translation text contains credential-shaped strings that are not
// used by the client. Keep generated public bundles free of those values.
const assetNames = await readdir(assetsDir);
for (const name of assetNames) {
  if (!name.endsWith(".js")) continue;
  const file = path.join(assetsDir, name);
  const source = await readFile(file, "utf8");
  const sanitized = source
    .replace(/sbp_[A-Za-z0-9_-]+/g, "sbp_REDACTED")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_REDACTED")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "JWT_REDACTED");
  if (sanitized !== source) await writeFile(file, sanitized);
}

const manifest = (await readdir(assetsDir))
  .sort()
  .map((name) => `/offline-app/assets/${name}`);
await writeFile(
  path.join(outputDir, "asset-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`Published ${manifest.length} offline assets to ${outputDir}`);
