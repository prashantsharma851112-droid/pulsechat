import { io } from 'socket.io-client';

// Use this helper only if your PulseChat app does not already create a socket.
export function createChatSocket(serverUrl, token, deviceId = '') {
  const normalizedDeviceId = typeof deviceId === 'string' ? deviceId.trim() : '';
  return io(serverUrl, {
    autoConnect: true,
    auth: normalizedDeviceId ? { token, deviceId: normalizedDeviceId } : { token },
    transports: ['websocket', 'polling']
  });
}
