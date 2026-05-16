#!/usr/bin/env node
/**
 * validate-home.js
 * Strips any non-import plain text prepended to app/home.tsx before the bundler runs.
 * Run: node scripts/validate-home.js
 * Or add to package.json scripts: "prestart": "node scripts/validate-home.js"
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'app', 'home.tsx');

function validateAndFix() {
  if (!fs.existsSync(FILE_PATH)) {
    console.log('[validate-home] app/home.tsx not found, skipping.');
    return;
  }

  const content = fs.readFileSync(FILE_PATH, 'utf8');

  // Find the first occurrence of "import " at the start of a line or at position 0
  const importIndex = content.search(/(?:^|\n)import\s/);

  if (importIndex === -1) {
    console.warn('[validate-home] No import statement found in app/home.tsx!');
    return;
  }

  // If file starts cleanly with import, nothing to do
  if (importIndex === 0) {
    console.log('[validate-home] app/home.tsx is clean.');
    return;
  }

  // Strip everything before the first import statement
  const fixed = content.slice(importIndex).trimStart();
  fs.writeFileSync(FILE_PATH, fixed, 'utf8');
  console.log('[validate-home] Fixed: stripped prepended text from app/home.tsx');
}

validateAndFix();
