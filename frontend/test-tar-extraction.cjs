const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

async function testCapacitorTarExtraction() {
  const tar = require('tar');
  assert.strictEqual(typeof tar.default, 'object', 'tar.default must be an object for @capacitor/cli compatibility');
  assert.strictEqual(typeof tar.default.extract, 'function', 'tar.default.extract must be a function');

  const { extractTemplate } = require('@capacitor/cli/dist/util/template.js');
  assert.strictEqual(typeof extractTemplate, 'function', 'extractTemplate must be exported by @capacitor/cli');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulsechat-tar-regression-'));
  const srcDir = path.join(tmpDir, 'source');
  const targetDir = path.join(tmpDir, 'extracted');
  const tarFile = path.join(tmpDir, 'test-template.tar.gz');

  try {
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'App.java'), 'package com.pulsechat.app;\npublic class App {}');
    fs.mkdirSync(path.join(srcDir, 'values'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'values', 'strings.xml'), '<resources><string name="app">Pulse</string></resources>');

    // Create tarball using tar@7 API
    await tar.create({ gzip: true, file: tarFile, cwd: srcDir }, ['App.java', 'values']);

    // Extract using @capacitor/cli internal utility
    await extractTemplate(tarFile, targetDir);

    // Validate extraction
    const file1 = fs.readFileSync(path.join(targetDir, 'App.java'), 'utf8');
    const file2 = fs.readFileSync(path.join(targetDir, 'values', 'strings.xml'), 'utf8');

    assert.ok(file1.includes('com.pulsechat.app'), 'App.java content mismatch');
    assert.ok(file2.includes('Pulse'), 'strings.xml content mismatch');

    console.log('[PASS] Capacitor CLI template extraction regression check passed.');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

testCapacitorTarExtraction().catch(err => {
  console.error('[FAIL] Capacitor CLI template extraction regression check failed:', err);
  process.exit(1);
});
