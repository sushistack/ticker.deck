import fs from "node:fs";

const tag = process.argv[2];
const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;

if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) {
  console.error(`Release tag must use vMAJOR.MINOR.PATCH, received: ${tag}`);
  process.exit(1);
}

if (tag !== `v${version}`) {
  console.error(`Release tag ${tag} does not match package version ${version}`);
  process.exit(1);
}

console.log(`Release tag ${tag} matches package version ${version}`);
