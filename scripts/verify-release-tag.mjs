import { readFile } from "node:fs/promises";

const tag = process.argv[2];
const pkg = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const tauri = JSON.parse(
  await readFile(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
);
const cargo = await readFile(
  new URL("../src-tauri/Cargo.toml", import.meta.url),
  "utf8",
);
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (pkg.version !== tauri.version || pkg.version !== cargoVersion) {
  console.error(
    `Version mismatch: package=${pkg.version}, tauri=${tauri.version}, cargo=${cargoVersion ?? "missing"}`,
  );
  process.exit(1);
}
const expected = `v${pkg.version}`;
if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  console.error(
    `Release tag must be a semantic v* tag; received: ${tag ?? "<empty>"}`,
  );
  process.exit(1);
}
if (tag !== expected) {
  console.error(
    `Release tag ${tag} does not match package version ${expected}`,
  );
  process.exit(1);
}
console.log(`Release tag ${tag} matches package version.`);
