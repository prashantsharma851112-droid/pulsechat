import { useState } from 'react';
import { useEphemeralChat } from './useEphemeralChat.js';

// Example UI only. Mount this inside your authenticated app and pass the Socket.IO
// instance your app already creates. `me` must be the logged-in user object.
export default function EphemeralChatExample({ socket, me, peer }) {
  const [draft, setDraft] = useState('');
  const peerId = String(peer?._id ?? peer?.id ?? '');
  const { messages, loadingLocal, lastError, sendMessage } = useEphemeralChat({
    socket,
    me,
    activePeerId: peerId
  });

  async function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    try {
      await sendMessage(peerId, text);
      setDraft('');
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', height: 'min(75vh, 720px)', border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden' }}>
      <header style={{ padding: 12, borderBottom: '1px solid #eee', fontWeight: 600 }}>
        {peer?.name || peer?.username || 'Chat'}
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#fafafa' }}>
        {loadingLocal && <p>Loading messages from this device…</p>}
        {!loadingLocal && messages.length === 0 && <p>No messages saved on this device yet.</p>}
        {messages.map((message) => (
          <div key={message.messageId} style={{ display: 'flex', justifyContent: message.direction === 'outgoing' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{ maxWidth: '78%', padding: '8px 11px', borderRadius: 12, background: message.direction === 'outgoing' ? '#d9fdd3' : '#fff', border: '1px solid #e5e5e5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <div>{message.content}</div>
              <small style={{ display: 'block', marginTop: 4, opacity: 0.65, textAlign: 'right' }}>
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {message.direction === 'outgoing' && ` · ${message.status === 'read' ? '✓✓ Read' : message.status === 'delivered' ? '✓✓ Delivered' : message.status === 'sent' ? '✓ Sent' : message.status === 'expired' ? 'Expired' : 'Sending…'}`}
              </small>
            </div>
          </div>
        ))}
      </div>

      {lastError && <div role="alert" style={{ padding: 8, color: '#a40000', fontSize: 12 }}>{lastError}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid #eee' }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={10000}
          placeholder="Write a message…"
          aria-label="Message"
          style={{ flex: 1, minWidth: 0, border: '1px solid #ddd', borderRadius: 20, padding: '10px 14px' }}
        />
        <button type="submit" disabled={!draft.trim() || !peerId} style={{ border: 0, borderRadius: 20, padding: '0 18px', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </section>
  );
}
