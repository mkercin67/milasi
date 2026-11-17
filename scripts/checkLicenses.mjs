#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_LICENSES = new Set([
  'MIT',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  'OFL-1.1',
  'SIL OFL 1.1'
]);

const FORBIDDEN_PATTERNS = [
  /GPL/i,
  /AGPL/i,
  /SSPL/i,
  /COMMONS/i,
  /NON-COMMERCIAL/i,
  /PROPRIETARY/i
];

function checkLicenses() {
  const rootPkgPath = path.resolve('package.json');
  if (!fs.existsSync(rootPkgPath)) {
    console.error('Error: package.json not found');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const prodDeps = Object.keys(pkg.dependencies || {});

  const visited = new Set();
  const queue = [...prodDeps];
  const auditResults = [];
  const errors = [];

  while (queue.length > 0) {
    const depName = queue.shift();
    if (visited.has(depName)) continue;
    visited.add(depName);

    const depPkgJsonPath = path.resolve('node_modules', depName, 'package.json');
    if (!fs.existsSync(depPkgJsonPath)) {
      errors.push(`Missing installed dependency package.json: ${depName}`);
      continue;
    }

    try {
      const depPkg = JSON.parse(fs.readFileSync(depPkgJsonPath, 'utf8'));
      const rawLicense = depPkg.license || (depPkg.licenses && depPkg.licenses[0]?.type) || 'UNKNOWN';
      const license = typeof rawLicense === 'string' ? rawLicense : JSON.stringify(rawLicense);

      // Check forbidden patterns
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(license)) {
          errors.push(`Forbidden license detected in ${depName}@${depPkg.version}: ${license}`);
        }
      }

      // Check allowed list
      if (!ALLOWED_LICENSES.has(license)) {
        errors.push(`Disallowed or unapproved license in ${depName}@${depPkg.version}: ${license}`);
      }

      auditResults.push({
        name: depName,
        version: depPkg.version,
        license
      });

      if (depPkg.dependencies) {
        for (const subDep of Object.keys(depPkg.dependencies)) {
          if (!visited.has(subDep)) {
            queue.push(subDep);
          }
        }
      }
    } catch (err) {
      errors.push(`Failed to read/parse ${depName}: ${err.message}`);
    }
  }

  // Also verify Bravura font asset attribution
  const fontPath = path.resolve('public/fonts/Bravura.woff2');
  const fontLicense = path.resolve('public/fonts/LICENSE-Bravura.txt');
  const metadataPath = path.resolve('public/fonts/bravura_metadata.json');
  if (!fs.existsSync(fontPath) || !fs.existsSync(metadataPath) || !fs.existsSync(fontLicense)) {
    errors.push('Bravura font asset, license, or metadata missing from public/fonts/');
  }

  // Also verify THIRD_PARTY_LICENSES.md exists
  const licenseDoc = path.resolve('THIRD_PARTY_LICENSES.md');
  if (!fs.existsSync(licenseDoc)) {
    errors.push('THIRD_PARTY_LICENSES.md is missing');
  }

  console.log('--- Production Dependency License Audit ---');
  for (const item of auditResults) {
    console.log(`- ${item.name}@${item.version} -> [${item.license}]`);
  }
  console.log(`Total audited production dependencies: ${auditResults.length}`);

  if (errors.length > 0) {
    console.error('\n❌ License audit FAILED:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('\n✓ All production dependencies comply with permissive license standards (MIT, 0BSD, OFL-1.1).');
}

checkLicenses();
