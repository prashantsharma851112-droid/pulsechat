// Compatibility bridge between @capacitor/cli (TypeScript default import) and tar@7.x (named exports CJS)
const fs = require('fs');
const path = require('path');

const tarDir = path.join(__dirname, 'node_modules', 'tar');
if (!fs.existsSync(tarDir)) {
  // tar is not installed in this environment; nothing to patch
  process.exit(0);
}

// Test if tar already exports default natively
try {
  const tar = require(tarDir);
  if (tar && typeof tar.extract === 'function' && tar.default === tar) {
    // Already has default export or already patched
    process.exit(0);
  }
} catch (e) {
  // Fallthrough to patch targets
}

const targets = [
  path.join(tarDir, 'dist', 'commonjs', 'index.min.js'),
  path.join(tarDir, 'dist', 'commonjs', 'index.js')
];

let targetFound = false;
let patched = false;

for (const p of targets) {
  if (fs.existsSync(p)) {
    targetFound = true;
    const content = fs.readFileSync(p, 'utf8');
    if (!content.includes('exports.default = exports') && !content.includes('exports.default=exports')) {
      fs.writeFileSync(p, content + '\nexports.default = exports;\n');
      patched = true;
    }
  }
}

if (!targetFound) {
  console.error('[tar-compat] FATAL: node_modules/tar exists but expected distribution files in dist/commonjs were not found. Package structure may have changed.');
  process.exit(1);
}

// Verification: ensure require('tar').default.extract is now callable
try {
  for (const k in require.cache) {
    if (k.includes(path.join('node_modules', 'tar'))) {
      delete require.cache[k];
    }
  }
  const freshTar = require(tarDir);
  if (!freshTar.default || typeof freshTar.default.extract !== 'function') {
    console.error('[tar-compat] FATAL: Verification failed after patching. freshTar.default.extract is not a function.');
    process.exit(1);
  }
} catch (err) {
  console.error('[tar-compat] FATAL: Error during post-patch verification:', err.message);
  process.exit(1);
}

if (patched) {
  console.log('[tar-compat] Successfully attached exports.default to tar for @capacitor/cli compatibility.');
}
