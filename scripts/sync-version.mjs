import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/sync-version.mjs <version>");
  process.exit(1);
}

function patchJson(path, mutate) {
  const full = resolve(path);
  const data = JSON.parse(readFileSync(full, "utf8"));
  mutate(data);
  writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
}

patchJson("package.json", (data) => {
  data.version = version;
});
patchJson("src-tauri/tauri.conf.json", (data) => {
  data.version = version;
});

const cargoPath = resolve("src-tauri/Cargo.toml");
const cargo = readFileSync(cargoPath, "utf8").replace(
  /^version = ".*"$/m,
  `version = "${version}"`,
);
writeFileSync(cargoPath, cargo);

const updatesPath = resolve("src/lib/updates.ts");
const updates = readFileSync(updatesPath, "utf8").replace(
  /export const APP_VERSION = ".*";/,
  `export const APP_VERSION = "${version}";`,
);
writeFileSync(updatesPath, updates);
console.log(`Synced version to ${version}`);
