#!/usr/bin/env node
/*
 * Copy the project's legal texts into the browser distribution and generate a
 * license bundle for the production npm dependency tree. This runs after
 * webpack, because webpack's output.clean removes prior dist contents.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const legalFiles = [
    'LICENSE',
    'LICENSE-GPL-3.0',
    'NOTICE',
    'OFL.txt',
    'TRADEMARK',
    'THIRD_PARTY_NOTICES.md',
    'MODIFICATIONS.md',
    'CONTRIBUTING.md',
    'SECURITY.md'
];

fs.mkdirSync(dist, {recursive: true});
for (const file of legalFiles) {
    const source = file === 'MODIFICATIONS.md'
        ? path.join(root, 'src/vendor/scratch-paint/MODIFICATIONS.md')
        : path.join(root, file);
    if (fs.existsSync(source)) {
        fs.copyFileSync(source, path.join(dist, file));
    }
}

const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const sections = [];
for (const [packagePath, pkg] of Object.entries(lock.packages || {})) {
    if (!packagePath || !packagePath.startsWith('node_modules/') || pkg.dev === true) continue;
    const packageDir = path.join(root, packagePath);
    // Optional platform packages (for example esbuild binaries) are listed in
    // the lockfile but are not installed on every host and are not shipped.
    // Do not claim to distribute them.
    if (!fs.existsSync(packageDir)) continue;
    const name = pkg.name || packagePath.replace(/^node_modules\//, '');
    const version = pkg.version || '';
    const packageLicenses = {
        'color-convert': 'MIT',
        keymirror: 'Apache-2.0',
        'scratch-render-fonts': 'Apache-2.0 (package); bundled fonts under SIL OFL 1.1'
    };
    const declared = packageLicenses[name] || pkg.license ||
        (Array.isArray(pkg.licenses) ? pkg.licenses.map(item => item.type).filter(Boolean).join(' OR ') : '') ||
        'See package metadata';
    let licenseText = '';
    const candidates = [];
    try {
        for (const entry of fs.readdirSync(packageDir)) {
            const lower = entry.toLowerCase();
            if (/^(license|licence|copying)(\.|$)/.test(lower) || /^readme(\.|$)/.test(lower)) {
                candidates.push(entry);
            }
        }
    } catch (error) {
        // The package directory is not readable; leave the notice below.
    }
    // Prefer a standalone legal file over a README when both are present.
    candidates.sort((a, b) => {
        const aReadme = /^readme/i.test(a);
        const bReadme = /^readme/i.test(b);
        return Number(aReadme) - Number(bReadme) || a.localeCompare(b);
    });
    for (const candidate of candidates) {
        const file = path.join(packageDir, candidate);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
        try {
            const text = fs.readFileSync(file, 'utf8').trim();
            if (!text) continue;
            licenseText = text.length > 60000 ? `${text.slice(0, 60000)}\n\n[truncated]` : text;
            break;
        } catch (error) {
            // Try the next license candidate.
        }
    }
    sections.push([
        '='.repeat(78),
        `${name}${version ? ` ${version}` : ''}`,
        `License: ${declared}`,
        '-'.repeat(78),
        licenseText || '[No license text file was found in the installed package. See the package metadata/upstream project.]',
        ''
    ].join('\n'));
}

const output = [
    'Costume Studio — third-party license bundle',
    '',
    'This file is generated from the production packages installed in node_modules.',
    'The project itself is licensed under AGPL-3.0-only; see LICENSE and NOTICE.',
    'The corresponding source is available from the project repository.',
    '',
    ...sections
].join('\n');
fs.writeFileSync(path.join(dist, 'THIRD_PARTY_LICENSES.txt'), output);

// Fail the build if a font without redistribution permission is accidentally
// pulled in by a future dependency/alias change.
const forbiddenFonts = [
    'Scratch.ttf',
    'Grand9K-Pixel.ttf',
    'Knewave.ttf',
    'Griffy-Regular.ttf'
];
const fontDir = path.join(root, 'node_modules/scratch-render-fonts/src');
const distTexts = [];
const readDist = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) readDist(file);
        else if (/\.(?:js|css|txt|html)$/i.test(entry.name)) distTexts.push(fs.readFileSync(file, 'utf8'));
    }
};
readDist(dist);
for (const font of forbiddenFonts) {
    const fontPath = path.join(fontDir, font);
    if (!fs.existsSync(fontPath)) continue;
    const prefix = fs.readFileSync(fontPath).toString('base64').slice(0, 80);
    if (distTexts.some(text => text.includes(prefix))) {
        throw new Error(`Forbidden font detected in dist: ${font}`);
    }
}

console.log(`Copied legal files and generated dist/THIRD_PARTY_LICENSES.txt (${sections.length} packages)`);
