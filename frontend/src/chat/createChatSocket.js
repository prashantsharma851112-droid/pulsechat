import { io } from 'socket.io-client';

// Use this helper only if your PulseChat app does not already create a socket.
export function createChatSocket(serverUrl, token) {
  return io(serverUrl, {
    autoConnect: true,
    auth: { token },
    transports: ['websocket', 'polling']
  });
}
