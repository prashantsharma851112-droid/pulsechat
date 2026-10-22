const path = require('path');
const { pathToFileURL } = require('url');

console.log('================================================================');
console.log(' RUNNING E2EE IDENTITY MANAGER & TOFU SECURITY TESTS');
console.log('================================================================\n');

let total = 0;
let passed = 0;
function assert(description, condition) {
  total += 1;
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${description}`);
  } else {
    process.exitCode = 1;
    console.error(`[FAIL] ${description}`);
  }
}

async function run() {
  const managerPath = path.resolve(__dirname, '../../frontend/src/utils/e2eeIdentityManager.js');
  const {
    assertMatrixDeviceTrusted,
    chooseTrustedDevice,
    clearPinnedDevices,
    pinDeviceKey,
    getPinnedDeviceKey
  } = await import(pathToFileURL(managerPath).href);

  // 1. Incomplete device metadata
  clearPinnedDevices();
  let threw = false;
  try {
    assertMatrixDeviceTrusted(null);
  } catch (e) {
    threw = e.message.includes('UNTRUSTED_DEVICE');
  }
  assert('Null device throws UNTRUSTED_DEVICE', threw);

  threw = false;
  try {
    assertMatrixDeviceTrusted({ userId: 'alice' }); // missing deviceId
  } catch (e) {
    threw = e.message.includes('UNTRUSTED_DEVICE');
  }
  assert('Device missing deviceId throws UNTRUSTED_DEVICE', threw);

  // 2. Missing required algorithm
  threw = false;
  try {
    assertMatrixDeviceTrusted({
      userId: 'alice',
      deviceId: 'A1',
      algorithms: ['m.other.algo'],
      keys: { 'ed25519:A1': 'key_ed' },
      signatures: { alice: { 'ed25519:A1': 'sig' } }
    });
  } catch (e) {
    threw = e.message.includes('UNTRUSTED_DEVICE: Missing required algorithm');
  }
  assert('Device missing required algorithm throws UNTRUSTED_DEVICE', threw);

  // 3. Blocked device rejection (via method or property)
  threw = false;
  try {
    assertMatrixDeviceTrusted({
      userId: 'alice',
      deviceId: 'A1',
      algorithms: ['m.olm.v1.curve25519-aes-sha2'],
      keys: { 'ed25519:A1': 'key_ed' },
      signatures: { alice: { 'ed25519:A1': 'sig' } },
      isBlocked: () => true
    });
  } catch (e) {
    threw = e.message.includes('is blocked');
  }
  assert('Device with isBlocked() === true throws UNTRUSTED_DEVICE', threw);

  threw = false;
  try {
    assertMatrixDeviceTrusted({
      userId: 'alice',
      deviceId: 'A1',
      algorithms: ['m.olm.v1.curve25519-aes-sha2'],
      keys: { 'ed25519:A1': 'key_ed' },
      signatures: { alice: { 'ed25519:A1': 'sig' } },
      blocked: true
    });
  } catch (e) {
    threw = e.message.includes('is blocked');
  }
  assert('Device with blocked: true throws UNTRUSTED_DEVICE', threw);

  // 4. Unverified device rejection (SDK method or boolean)
  threw = false;
  try {
    assertMatrixDeviceTrusted({
      userId: 'alice',
      deviceId: 'A1',
      algorithms: ['m.olm.v1.curve25519-aes-sha2'],
      keys: { 'ed25519:A1': 'key_ed' },
      signatures: { alice: { 'ed25519:A1': 'sig' } },
      isVerified: () => false
    });
  } catch (e) {
    threw = e.message.includes('is not verified');
  }
  assert('Device with isVerified() === false throws UNTRUSTED_DEVICE', threw);

  threw = false;
  try {
    assertMatrixDeviceTrusted({
      userId: 'alice',
      deviceId: 'A1',
      algorithms: ['m.olm.v1.curve25519-aes-sha2'],
      keys: { 'ed25519:A1': 'key_ed' },
      signatures: { alice: { 'ed25519:A1': 'sig' } },
      isVerified: false
    });
  } catch (e) {
    threw = e.message.includes('is not verified');
  }
  assert('Device with isVerified: false throws UNTRUSTED_DEVICE', threw);

  // 5. Strict mode rejects unverified plain objects
  threw = false;
  try {
    assertMatrixDeviceTrusted(
      {
        userId: 'bob',
        deviceId: 'B1',
        algorithms: ['m.olm.v1.curve25519-aes-sha2'],
        keys: { 'ed25519:B1': 'key_bob_ed' },
        signatures: { bob: { 'ed25519:B1': 'sig_bob' } }
      },
      { strict: true }
    );
  } catch (e) {
    threw = e.message.includes('requires explicit verification');
  }
  assert('Strict mode rejects unverified plain device', threw);

  // 6. TOFU mode pins fingerprint on first use and trusts it
  clearPinnedDevices();
  const bobDevice = {
    userId: 'bob',
    deviceId: 'B1',
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:B1': 'initial_bob_fingerprint' },
    signatures: { bob: { 'ed25519:B1': 'sig_bob' } }
  };
  const firstUseTrusted = assertMatrixDeviceTrusted(bobDevice);
  assert('First use in TOFU mode is trusted', firstUseTrusted === true);
  assert('First use pins fingerprint into TOFU store', getPinnedDeviceKey('bob', 'B1') === 'initial_bob_fingerprint');

  // 7. Subsequent use with same fingerprint continues to be trusted
  const secondUseTrusted = assertMatrixDeviceTrusted(bobDevice);
  assert('Subsequent use with matching pinned key is trusted', secondUseTrusted === true);

  // 8. MITM KEY CHANGE ATTACK: Fingerprint changes for same userId/deviceId -> CRITICAL REJECTION
  const hijackedBobDevice = {
    userId: 'bob',
    deviceId: 'B1',
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:B1': 'FORGED_ATTACKER_FINGERPRINT' },
    signatures: { bob: { 'ed25519:B1': 'sig_forged' } }
  };
  threw = false;
  let errorMsg = '';
  try {
    assertMatrixDeviceTrusted(hijackedBobDevice);
  } catch (e) {
    threw = true;
    errorMsg = e.message;
  }
  assert('Fingerprint change for pinned device triggers critical MITM alert', threw && errorMsg.includes('Fingerprint changed'));

  // 9. Verified SDK device is trusted
  const verifiedSdkDevice = {
    userId: 'alice',
    deviceId: 'A2',
    algorithms: ['m.olm.v1.curve25519-aes-sha2'],
    keys: { 'ed25519:A2': 'key_a2' },
    signatures: { alice: { 'ed25519:A2': 'sig_a2' } },
    isVerified: () => true
  };
  assert('Verified SDK device is trusted', assertMatrixDeviceTrusted(verifiedSdkDevice) === true);

  // 10. chooseTrustedDevice selects trusted device and skips untrusted
  clearPinnedDevices();
  const devicesMap = {
    bad: {
      userId: 'alice',
      deviceId: 'A_BAD',
      algorithms: ['m.olm.v1.curve25519-aes-sha2'],
      keys: { 'ed25519:A_BAD': 'bad_k' },
      signatures: { alice: { 'ed25519:A_BAD': 'sig' } },
      isVerified: () => false
    },
    good: verifiedSdkDevice
  };
  const chosen = chooseTrustedDevice(devicesMap);
  assert('chooseTrustedDevice skips unverified device and chooses verified one', chosen?.deviceId === 'A2');

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

run().catch((error) => {
  console.error('Test execution error:', error);
  process.exit(1);
});
