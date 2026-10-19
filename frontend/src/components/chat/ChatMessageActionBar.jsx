import React from 'react';
import {
  ArrowLeft,
  CornerUpLeft,
  CheckSquare,
  Copy,
  Forward,
  Trash2,
  MoreVertical,
  Star,
  Pin,
  Info,
  Ban
} from 'lucide-react';

const ChatMessageActionBar = React.memo(function ChatMessageActionBar({
  chatWallpaper,
  handleDismissActionMessage,
  selectedActionMessages,
  setSelectedActionMessages,
  messages,
  groupMembersMap,
  setReplyTo,
  replyInputRef,
  user,
  activeChat,
  handleCopyMessages,
  setShowForwardModal,
  handleDeleteActionMessage,
  showActionMoreMenu,
  setShowActionMoreMenu,
  handleToggleStarMessages,
  starredMsgIds,
  pinnedMessage,
  handlePinMessage,
  handleUnpinMessage,
  setShowMessageInfoModal,
  isGroup,
  blockUser,
  setBlockStatus,
  setActionToast
}) {
  const selectableMessages = messages.filter(m => m.type !== 'deleted' && m.type !== 'system');
  const isAllSelected = selectableMessages.length > 0 && selectableMessages.every(m => selectedActionMessages.some(sm => sm.id === m.id));
  const isAllStarred = selectedActionMessages.length > 0 && selectedActionMessages.every(m => starredMsgIds?.includes(m.id));

  return (
    <div style={{
      padding: 'calc(6px + env(safe-area-inset-top, 0px)) 0.75rem 6px 0.75rem',
      borderBottom: '2px solid var(--accent)',
      background: (chatWallpaper && chatWallpaper !== 'none')
        ? 'color-mix(in srgb, var(--bg-card) 92%, transparent)'
        : 'var(--bg-card)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 50
    }}>
      {/* Left: Close Button + Dynamic Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          type="button"
          onClick={handleDismissActionMessage}
          className="icon-btn-ghost"
          style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
          title="Unselect messages"
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
          {selectedActionMessages.length}
        </span>
      </div>

      {/* Right: Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {/* Reply - only visible when exactly 1 message is selected */}
        {selectedActionMessages.length === 1 && (
          <button
            type="button"
            onClick={() => {
              const targetMsg = selectedActionMessages[0];
              const senderInfo = groupMembersMap ? groupMembersMap[targetMsg.senderId] : null;
              setReplyTo({
                ...targetMsg,
                senderName: targetMsg.senderId === user?.id
                  ? 'You'
                  : (senderInfo?.displayName || senderInfo?.username || activeChat?.displayName)
              });
              handleDismissActionMessage();
              replyInputRef?.current?.focus();
            }}
            className="icon-btn-ghost"
            title="Reply"
            style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
          >
            <CornerUpLeft size={17} />
          </button>
        )}

        {/* Select All Button */}
        <button
          type="button"
          onClick={() => {
            if (isAllSelected) {
              handleDismissActionMessage();
            } else {
              setSelectedActionMessages(selectableMessages.length > 0 ? selectableMessages : [...messages]);
            }
          }}
          className="icon-btn-ghost"
          title={isAllSelected ? "Deselect all" : "Select all"}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            color: isAllSelected ? 'var(--accent)' : 'var(--text-main)'
          }}
        >
          <CheckSquare size={17} />
        </button>

        {/* Copy */}
        <button
          type="button"
          onClick={() => handleCopyMessages(selectedActionMessages)}
          className="icon-btn-ghost"
          title="Copy message(s)"
          style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
        >
          <Copy size={17} />
        </button>

        {/* Forward */}
        <button
          type="button"
          onClick={() => setShowForwardModal(true)}
          className="icon-btn-ghost"
          title="Forward message(s)"
          style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
        >
          <Forward size={17} />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => handleDeleteActionMessage(selectedActionMessages)}
          className="icon-btn-ghost"
          title="Delete message(s)"
          style={{ width: '34px', height: '34px', borderRadius: '50%', color: '#ef4444' }}
        >
          <Trash2 size={17} />
        </button>

        {/* 3-Dots More Options Menu */}
        {selectedActionMessages.length >= 1 && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowActionMoreMenu(prev => !prev)}
              className="icon-btn-ghost"
              title="More options"
              style={{ width: '34px', height: '34px', borderRadius: '50%', color: 'var(--text-main)' }}
            >
              <MoreVertical size={17} />
            </button>

            {showActionMoreMenu && (
              <div className="chat-header-dropdown-menu" style={{ right: 0, minWidth: '190px', zIndex: 2000 }}>
                {/* Star / Unstar in 3-dots */}
                <button
                  type="button"
                  onClick={() => {
                    setShowActionMoreMenu(false);
                    handleToggleStarMessages(selectedActionMessages);
                  }}
                >
                  <Star
                    size={16}
                    color="#f59e0b"
                    fill={isAllStarred ? "#f59e0b" : "none"}
                  />
                  <span>{isAllStarred ? 'Unstar message' : 'Star message'}</span>
                </button>

                {selectedActionMessages.length === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionMoreMenu(false);
                      const targetMsg = selectedActionMessages[0];
                      if (pinnedMessage?.id === targetMsg?.id) {
                        handleUnpinMessage();
                      } else {
                        handlePinMessage(targetMsg);
                      }
                    }}
                  >
                    <Pin size={16} color="var(--accent)" />
                    <span>{pinnedMessage?.id === selectedActionMessages[0]?.id ? 'Unpin message' : 'Pin message'}</span>
                  </button>
                )}

                {selectedActionMessages.length === 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowActionMoreMenu(false);
                      setShowMessageInfoModal(true);
                    }}
                  >
                    <Info size={16} color="var(--accent)" />
                    <span>Message info</span>
                  </button>
                )}

                {selectedActionMessages[0]?.senderId !== user?.id && !isGroup && (
                  <button
                    type="button"
                    onClick={async () => {
                      setShowActionMoreMenu(false);
                      if (window.confirm(`Report message and block ${activeChat?.displayName}?`)) {
                        await blockUser(activeChat?.id);
                        setBlockStatus(prev => ({ ...prev, isBlockedByMe: true }));
                        setActionToast('User reported and blocked 🚨');
                        setTimeout(() => setActionToast(''), 2500);
                        handleDismissActionMessage();
                      }
                    }}
                    style={{ color: '#ef4444' }}
                  >
                    <Ban size={16} color="#ef4444" />
                    <span>Report & Block</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessageActionBar;
