import React from 'react';
import {
  Phone,
  Video,
  Search,
  Image as ImageIcon,
  Palette,
  Clock,
  Ghost,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  Lock,
  Unlock,
  Bell,
  BellOff,
  Trash2,
  Ban,
  Info
} from 'lucide-react';

const ChatHeaderMoreMenu = React.memo(function ChatHeaderMoreMenu({
  showMoreMenu,
  setShowMoreMenu,
  moreSubMenuOpen,
  setMoreSubMenuOpen,
  isGroup,
  activeChat,
  onStartCall,
  onStartGroupCall,
  setShowInChatSearch,
  inChatSearchInputRef,
  setShowThemeModal,
  setShowSolidThemeModal,
  setShowUserProfileModal,
  setShowGroupProfileModal,
  chatSetting,
  isVanishMode,
  handleToggleVanishMode,
  isChatLockedState,
  handleToggleChatLockFromMenu,
  isChatMutedState,
  handleToggleChatMuteFromMenu,
  handleClearCurrentChat,
  blockStatus,
  setBlockStatus,
  blockUser
}) {
  if (!showMoreMenu) return null;

  return (
    <div
      className="chat-header-dropdown-menu"
      onClick={(e) => e.stopPropagation()}
    >
      {!moreSubMenuOpen ? (
        <>
          {/* Voice & Video Calls */}
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, false)) : onStartCall(false);
            }}
          >
            <Phone size={16} color="var(--accent)" />
            <span>{isGroup ? 'Group Voice Call' : 'Voice Call'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, true)) : onStartCall(true);
            }}
          >
            <Video size={16} color="var(--accent)" />
            <span>{isGroup ? 'Group Video Call' : 'Video Call'}</span>
          </button>

          {/* Search in chat */}
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              setShowInChatSearch(true);
              setTimeout(() => inChatSearchInputRef?.current?.focus(), 120);
            }}
          >
            <Search size={16} color="var(--accent)" />
            <span>Search in chat</span>
          </button>

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              setShowThemeModal(true);
            }}
          >
            <ImageIcon size={16} color="var(--accent)" />
            <span>Chat background</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              setShowSolidThemeModal(true);
            }}
          >
            <Palette size={16} color="var(--accent)" />
            <span>Change Solid Theme</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              if (isGroup) {
                setShowGroupProfileModal(true);
              } else {
                setShowUserProfileModal(true);
              }
            }}
          >
            <Clock size={16} color="var(--accent)" />
            <span>Disappearing Messages {chatSetting?.disappearingEnabled ? '(On)' : '(Off)'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              handleToggleVanishMode();
            }}
          >
            <Ghost size={16} color={isVanishMode ? '#c084fc' : 'var(--accent)'} />
            <span>Vanish Mode {isVanishMode ? '(On)' : '(Off)'}</span>
          </button>

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMoreSubMenuOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MoreVertical size={16} color="var(--accent)" />
              <span>More</span>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMoreSubMenuOpen(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '4px', width: '100%' }}
          >
            <ChevronLeft size={16} color="var(--accent)" />
            <span>More</span>
          </button>

          {/* 1. Chat Lock */}
          <button type="button" onClick={handleToggleChatLockFromMenu}>
            {isChatLockedState ? <Unlock size={16} color="#10b981" /> : <Lock size={16} color="var(--accent)" />}
            <span>{isChatLockedState ? 'Unlock Chat' : 'Chat Lock 🔒'}</span>
          </button>

          {/* 2. Mute / Unmute Notifications */}
          <button type="button" onClick={handleToggleChatMuteFromMenu}>
            {isChatMutedState ? <Bell size={16} color="var(--accent)" /> : <BellOff size={16} color="#f59e0b" />}
            <span>{isChatMutedState ? 'Unmute Notifications' : 'Mute Notifications'}</span>
          </button>

          {/* 3. Clear Chat */}
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              setMoreSubMenuOpen(false);
              handleClearCurrentChat();
            }}
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={16} color="#ef4444" />
            <span>Clear Chat</span>
          </button>

          {/* 4. Block Contact (if direct chat) */}
          {!isGroup && (
            <button
              type="button"
              onClick={async () => {
                setShowMoreMenu(false);
                setMoreSubMenuOpen(false);
                const willBlock = !blockStatus?.isBlockedByMe;
                const confirmMsg = willBlock
                  ? `Are you sure you want to block ${activeChat?.displayName}? You will no longer receive their messages or calls.`
                  : `Unblock ${activeChat?.displayName}?`;
                if (window.confirm(confirmMsg)) {
                  if (willBlock) {
                    await blockUser(activeChat.id);
                    setBlockStatus(prev => ({ ...prev, isBlockedByMe: true }));
                  } else {
                    await unblockUser(activeChat.id);
                    setBlockStatus(prev => ({ ...prev, isBlockedByMe: false }));
                  }
                }
              }}
              style={{ color: blockStatus?.isBlockedByMe ? 'var(--accent)' : '#ef4444' }}
            >
              <Ban size={16} color={blockStatus?.isBlockedByMe ? 'var(--accent)' : '#ef4444'} />
              <span>{blockStatus?.isBlockedByMe ? 'Unblock Contact' : 'Block Contact'}</span>
            </button>
          )}

          {/* 5. Contact Info / Group Info (Placed LAST in the list!) */}
          <button
            type="button"
            onClick={() => {
              setShowMoreMenu(false);
              setMoreSubMenuOpen(false);
              isGroup ? setShowGroupProfileModal(true) : setShowUserProfileModal(true);
            }}
          >
            <Info size={16} color="var(--accent)" />
            <span>{isGroup ? 'Group Info' : 'Contact Info'}</span>
          </button>
        </>
      )}
    </div>
  );
});

export default ChatHeaderMoreMenu;
