const REQUIRED_DEVICE_ALGORITHMS = ['m.olm.v1.curve25519-aes-sha2'];

function hasFunction(obj, name) {
  return Boolean(obj) && typeof obj[name] === 'function';
}

function ensureAlgorithms(deviceInfo) {
  const algorithms = Array.isArray(deviceInfo?.algorithms) ? deviceInfo.algorithms : [];
  for (const required of REQUIRED_DEVICE_ALGORITHMS) {
    if (!algorithms.includes(required)) {
      throw new Error(`UNTRUSTED_DEVICE: Missing required algorithm ${required}`);
    }
  }
}

export function assertMatrixDeviceTrusted(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object') {
    throw new Error('UNTRUSTED_DEVICE: Missing device identity.');
  }
  if (!deviceInfo.deviceId || !deviceInfo.userId) {
    throw new Error('UNTRUSTED_DEVICE: Device identity is incomplete.');
  }
  ensureAlgorithms(deviceInfo);
  if (hasFunction(deviceInfo, 'isVerified') && !deviceInfo.isVerified()) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is not verified.`);
  }
  if (hasFunction(deviceInfo, 'isBlocked') && deviceInfo.isBlocked()) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} is blocked.`);
  }
  if (!deviceInfo.keys || !deviceInfo.signatures) {
    throw new Error(`UNTRUSTED_DEVICE: ${deviceInfo.userId}/${deviceInfo.deviceId} has unsigned key material.`);
  }
  return true;
}

export function chooseTrustedDevice(devicesById) {
  const devices = Object.values(devicesById || {});
  for (const device of devices) {
    try {
      assertMatrixDeviceTrusted(device);
      return device;
    } catch {
      // Continue scanning for another trusted device.
    }
  }
  throw new Error('UNTRUSTED_DEVICE: No verifiable Matrix device available.');
}
