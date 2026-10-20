const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('       PULSECHAT COMPREHENSIVE BACKEND TEST SUITE RUNNER       ');
console.log('================================================================\n');

const testDir = __dirname;
const testFiles = [
  'test_step1_secrets_and_vapid.js',
  'verify_concurrent_and_auth_fixes.js',
  'verify_5_deep_hardening_fixes.js',
  'test_step2_message_security_and_spoofing.js',
  'test_cross_protocol_security_and_retention.js',
  'test_backup_restore_security.js'
];

let failedSuites = 0;
let passedSuites = 0;

for (const testFile of testFiles) {
  const filePath = path.join(testDir, testFile);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing test file: ${testFile}`);
    failedSuites++;
    continue;
  }

  console.log(`\n>>> RUNNING: ${testFile}`);
  try {
    const output = execFileSync(process.execPath, [filePath], {
      cwd: path.resolve(testDir, '..'),
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8'
    });
    console.log(output.trim());
    passedSuites++;
  } catch (err) {
    console.error(`FAILED: ${testFile}`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    failedSuites++;
  }
}

console.log('\n================================================================');
console.log(` SUMMARY: ${passedSuites}/${testFiles.length} Test Suites Passed`);
console.log('================================================================\n');

if (failedSuites > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
