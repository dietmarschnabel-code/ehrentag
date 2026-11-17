#!/usr/bin/env node
// Keeps the version number of the app in one place's worth of effort:
//   node scripts/bump-version.js 1.0.2          set the version in package.json, Cargo.toml and tauri.conf.json
//   node scripts/bump-version.js --check        check that all three files have the same version, that the
//                                               program name is the same everywhere and that the app id is valid
//   node scripts/bump-version.js --check v1.0.2 ... and that it matches the given git tag
//
// Also prints the Android versionCode, which Tauri derives from the version
// (major * 1,000,000 + minor * 1,000 + patch) and which Google Play needs to increase with every upload.
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = [
  { file: 'package.json', re: /("version"\s*:\s*")([^"]+)(")/ },
  { file: 'src-tauri/tauri.conf.json', re: /("version"\s*:\s*")([^"]+)(")/ },
  { file: 'src-tauri/Cargo.toml', re: /^(version\s*=\s*")([^"]+)(")/m },
];
const SEMVER = /^\d+\.\d+\.\d+$/;

const read = (t) => fs.readFileSync(path.join(root, t.file), 'utf8');
const versionOf = (t) => {
  const m = t.re.exec(read(t));
  if (!m) throw new Error('no version found in ' + t.file);
  return m[2];
};
const androidVersionCode = (v) => {
  const [major, minor, patch] = v.split('.').map(Number);
  return major * 1000000 + minor * 1000 + patch;
};

// The program name must be the same in Cargo.toml, package.json and productName: on Linux the window is announced
// under the name of the program and the desktop finds the icon through the .desktop file named after productName.
function checkNames() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  const cargo = /^name\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(root, 'src-tauri/Cargo.toml'), 'utf8'));
  const names = [
    ['src-tauri/Cargo.toml (name)', cargo && cargo[1]],
    ['package.json (name)', pkg.name],
    ['src-tauri/tauri.conf.json (productName)', conf.productName],
  ];
  if (new Set(names.map((n) => n[1])).size !== 1) {
    console.error('The program name differs (it must be identical, otherwise Linux shows a generic window icon):\n' + names.map(([f, n]) => `  ${f}: ${n}`).join('\n'));
    process.exit(1);
  }
  // Android turns the identifier into the application id, which cannot contain hyphens
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(conf.identifier || '')) {
    console.error(`The identifier "${conf.identifier}" is not a valid Android application id (letters, digits and underscores in dot-separated parts, no hyphens).`);
    process.exit(1);
  }
  return { name: names[0][1], identifier: conf.identifier };
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  const versions = targets.map((t) => [t.file, versionOf(t)]);
  const unique = new Set(versions.map((v) => v[1]));
  if (unique.size !== 1) {
    console.error('The version numbers differ:\n' + versions.map(([f, v]) => `  ${f}: ${v}`).join('\n'));
    process.exit(1);
  }
  const version = versions[0][1];
  if (!SEMVER.test(version)) {
    console.error(`"${version}" is not a version like 1.2.3`);
    process.exit(1);
  }
  if (args[1] && args[1].replace(/^v/, '') !== version) {
    console.error(`The tag ${args[1]} does not match the version ${version} in the files.`);
    process.exit(1);
  }
  const { name, identifier } = checkNames();
  console.log(`version ${version} (Android versionCode ${androidVersionCode(version)}) - all files agree`);
  console.log(`program name ${name}, application id ${identifier}`);
} else if (args[0] && SEMVER.test(args[0])) {
  const version = args[0];
  for (const t of targets) {
    const p = path.join(root, t.file);
    fs.writeFileSync(p, read(t).replace(t.re, `$1${version}$3`));
    console.log(`${t.file}: ${version}`);
  }
  console.log(`Android versionCode: ${androidVersionCode(version)}`);
  console.log('Next: "cargo build" and "npm install" update Cargo.lock and package-lock.json; then commit and tag v' + version);
} else {
  console.error('Usage: node scripts/bump-version.js <x.y.z> | --check [tag]');
  process.exit(1);
}
