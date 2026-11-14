#!/usr/bin/env node
/**
 * The component list (SBOM) of a release, in CycloneDX 1.5 JSON: every package that ships inside the app, with its
 * version and licence, plus Electron and the Chromium and Node.js it carries.
 *
 *   node scripts/make-sbom.js <output.cdx.json>
 *
 * The list is the one the app's own About ▸ Components shows (dist/notices/third-party.json, written by
 * scripts/build-assets.js at build): it follows what main loads and what the renderer bundle imports, so it holds
 * the renderer libraries too, which `npm sbom --omit dev` would leave out. Run after `npm run build`.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function purl(name, version) {
  const [scope, bare] = name.startsWith('@') ? name.split('/') : [null, name];
  return scope ? `pkg:npm/${encodeURIComponent(scope)}/${bare}@${version}` : `pkg:npm/${name}@${version}`;
}

function licenceEntry(license) {
  if (!license || license === 'UNKNOWN') return [];
  // A single SPDX id goes in `license.id`; an expression (MIT OR Apache-2.0) in `expression`.
  return /^[A-Za-z0-9.+-]+$/.test(license) ? [{ license: { id: license } }] : [{ expression: license }];
}

/** Chromium and Node.js versions of the Electron in node_modules (the one packaged), or null when it cannot run. */
function electronRuntime() {
  try {
    const electron = require('electron');
    const out = execFileSync(electron, ['-p', 'JSON.stringify({chrome: process.versions.chrome, node: process.versions.node})'], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf8',
      timeout: 30000,
    });
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

function makeSbom({ pkg, components, runtime, timestamp }) {
  const list = components
    .filter((component) => component && typeof component.name === 'string' && typeof component.version === 'string')
    .map((component) => ({
      type: component.name === 'electron' ? 'framework' : 'library',
      'bom-ref': purl(component.name, component.version),
      name: component.name,
      version: component.version,
      purl: purl(component.name, component.version),
      licenses: licenceEntry(component.license),
    }));
  const electron = components.find((component) => component.name === 'electron');
  if (electron && runtime) {
    list.push(
      { type: 'framework', 'bom-ref': `pkg:generic/chromium@${runtime.chrome}`, name: 'chromium', version: runtime.chrome, purl: `pkg:generic/chromium@${runtime.chrome}`, licenses: [{ license: { id: 'BSD-3-Clause' } }] },
      { type: 'framework', 'bom-ref': `pkg:generic/nodejs@${runtime.node}`, name: 'node.js', version: runtime.node, purl: `pkg:generic/nodejs@${runtime.node}`, licenses: [{ license: { id: 'MIT' } }] },
    );
  }
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp,
      tools: { components: [{ type: 'application', name: 'make-sbom.js', version: pkg.version }] },
      component: {
        type: 'application',
        'bom-ref': `pkg:generic/${pkg.name}@${pkg.version}`,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        licenses: licenceEntry(pkg.license),
      },
    },
    components: list,
  };
}

function main(output) {
  if (!output) {
    console.error('Usage: node scripts/make-sbom.js <output.cdx.json>');
    process.exit(2);
  }
  const pkg = require(path.join(root, 'package.json'));
  const noticesFile = path.join(root, 'dist', 'notices', 'third-party.json');
  if (!fs.existsSync(noticesFile)) {
    console.error(`SBOM_FAILED ${noticesFile} is missing: run npm run build first`);
    process.exit(1);
  }
  const components = JSON.parse(fs.readFileSync(noticesFile, 'utf8'));
  const runtime = electronRuntime();
  const timestamp = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : new Date().toISOString();
  const sbom = makeSbom({ pkg, components, runtime, timestamp });
  fs.writeFileSync(output, `${JSON.stringify(sbom, null, 2)}\n`);
  console.log(`SBOM ${output} components=${sbom.components.length}${runtime ? ` chromium=${runtime.chrome} node=${runtime.node}` : ' (Chromium version unknown)'}`);
}

module.exports = { makeSbom, purl };

if (require.main === module) main(process.argv[2]);
