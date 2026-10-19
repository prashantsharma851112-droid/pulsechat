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

const menuItemGpuStyle = {
  willChange: 'transform',
  transform: 'translateZ(0)',
  transition: 'transform 0.08s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease'
};

/**
 * Atomic Menu Item: Voice Call
 */
export const VoiceCallMenuItem = React.memo(function VoiceCallMenuItem({ isGroup, activeChat, onStartCall, onStartGroupCall, onCloseMenu }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, false)) : onStartCall?.(false);
      }}
    >
      <Phone size={16} color="var(--accent)" />
      <span>{isGroup ? 'Group Voice Call' : 'Voice Call'}</span>
    </button>
  );
});

/**
 * Atomic Menu Item: Video Call
 */
export const VideoCallMenuItem = React.memo(function VideoCallMenuItem({ isGroup, activeChat, onStartCall, onStartGroupCall, onCloseMenu }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        isGroup ? (onStartGroupCall && onStartGroupCall(activeChat, true)) : onStartCall?.(true);
      }}
    >
      <Video size={16} color="var(--accent)" />
      <span>{isGroup ? 'Group Video Call' : 'Video Call'}</span>
    </button>
  );
});

/**
 * Atomic Menu Item: Search in Chat
 */
export const SearchInChatMenuItem = React.memo(function SearchInChatMenuItem({ onCloseMenu, onOpenSearch }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        onOpenSearch?.();
      }}
    >
      <Search size={16} color="var(--accent)" />
      <span>Search in chat</span>
    </button>
  );
});

/**
 * Atomic Menu Item: Chat Background
 */
export const ChatBackgroundMenuItem = React.memo(function ChatBackgroundMenuItem({ onCloseMenu, onOpenThemeModal }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        onOpenThemeModal?.();
      }}
    >
      <ImageIcon size={16} color="var(--accent)" />
      <span>Chat background</span>
    </button>
  );
});

/**
 * Atomic Menu Item: Solid Theme
 */
export const SolidThemeMenuItem = React.memo(function SolidThemeMenuItem({ onCloseMenu, onOpenSolidThemeModal }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        onOpenSolidThemeModal?.();
      }}
    >
      <Palette size={16} color="var(--accent)" />
      <span>Change Solid Theme</span>
    </button>
  );
});

/**
 * Atomic Menu Item: Disappearing Messages
 */
export const DisappearingMessagesMenuItem = React.memo(function DisappearingMessagesMenuItem({ isGroup, disappearingEnabled, onCloseMenu, onOpenProfile }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        onOpenProfile?.();
      }}
    >
      <Clock size={16} color="var(--accent)" />
      <span>Disappearing Messages {disappearingEnabled ? '(On)' : '(Off)'}</span>
    </button>
  );
});

/**
 * Atomic Menu Item: Vanish Mode
 */
export const VanishModeMenuItem = React.memo(function VanishModeMenuItem({ isVanishMode, onCloseMenu, onToggleVanish }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={() => {
        onCloseMenu?.();
        onToggleVanish?.();
      }}
    >
      <Ghost size={16} color={isVanishMode ? '#c084fc' : 'var(--accent)'} />
      <span>Vanish Mode {isVanishMode ? '(On)' : '(Off)'}</span>
    </button>
  );
});

/**
 * Atomic Menu Item: More SubMenu Toggle
 */
export const MoreSubMenuToggleItem = React.memo(function MoreSubMenuToggleItem({ onOpenSubMenu }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenSubMenu?.();
      }}
      style={{
        ...menuItemGpuStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MoreVertical size={16} color="var(--accent)" />
        <span>More</span>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </button>
  );
});

/**
 * Atomic SubMenu Item: Back to Main Menu
 */
export const SubMenuBackItem = React.memo(function SubMenuBackItem({ onCloseSubMenu }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCloseSubMenu?.();
      }}
      style={{
        ...menuItemGpuStyle,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 700,
        borderBottom: '1px solid var(--border)',
        paddingBottom: '8px',
        marginBottom: '4px',
        width: '100%'
      }}
    >
      <ChevronLeft size={16} color="var(--accent)" />
      <span>More</span>
    </button>
  );
});

/**
 * Atomic SubMenu Item: Chat Lock
 */
export const ChatLockMenuItem = React.memo(function ChatLockMenuItem({ isLocked, onToggleLock }) {
  return (
    <button type="button" style={menuItemGpuStyle} onClick={onToggleLock}>
      {isLocked ? <Unlock size={16} color="#10b981" /> : <Lock size={16} color="var(--accent)" />}
      <span>{isLocked ? 'Unlock Chat' : 'Chat Lock 🔒'}</span>
    </button>
  );
});

/**
 * Atomic SubMenu Item: Mute / Unmute Notifications
 */
export const MuteNotificationsMenuItem = React.memo(function MuteNotificationsMenuItem({ isMuted, onToggleMute }) {
  return (
    <button type="button" style={menuItemGpuStyle} onClick={onToggleMute}>
      {isMuted ? <Bell size={16} color="var(--accent)" /> : <BellOff size={16} color="#f59e0b" />}
      <span>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</span>
    </button>
  );
});

/**
 * Atomic SubMenu Item: Clear Chat
 */
export const ClearChatMenuItem = React.memo(function ClearChatMenuItem({ onClearChat }) {
  return (
    <button
      type="button"
      onClick={onClearChat}
      style={{ ...menuItemGpuStyle, color: '#ef4444' }}
    >
      <Trash2 size={16} color="#ef4444" />
      <span>Clear Chat</span>
    </button>
  );
});

/**
 * Atomic SubMenu Item: Block / Unblock Contact
 */
export const BlockContactMenuItem = React.memo(function BlockContactMenuItem({ isBlocked, onToggleBlock }) {
  return (
    <button
      type="button"
      onClick={onToggleBlock}
      style={{ ...menuItemGpuStyle, color: isBlocked ? 'var(--accent)' : '#ef4444' }}
    >
      <Ban size={16} color={isBlocked ? 'var(--accent)' : '#ef4444'} />
      <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
    </button>
  );
});

/**
 * Atomic SubMenu Item: Contact / Group Info
 */
export const ContactInfoMenuItem = React.memo(function ContactInfoMenuItem({ isGroup, onOpenInfo }) {
  return (
    <button
      type="button"
      style={menuItemGpuStyle}
      onClick={onOpenInfo}
    >
      <Info size={16} color="var(--accent)" />
      <span>{isGroup ? 'Group Info' : 'Contact Info'}</span>
    </button>
  );
});

/**
 * ChatHeaderMoreMenu - Composed Container of Atomic Memoized Menu Items
 */
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
  blockUser,
  unblockUser
}) {
  if (!showMoreMenu) return null;

  const handleCloseMenu = () => setShowMoreMenu(false);

  const handleOpenSearch = () => {
    setShowInChatSearch(true);
    setTimeout(() => inChatSearchInputRef?.current?.focus(), 120);
  };

  const handleOpenProfile = () => {
    if (isGroup) {
      setShowGroupProfileModal(true);
    } else {
      setShowUserProfileModal(true);
    }
  };

  const handleClearChatAction = () => {
    setShowMoreMenu(false);
    setMoreSubMenuOpen(false);
    handleClearCurrentChat();
  };

  const handleToggleBlockAction = async () => {
    setShowMoreMenu(false);
    setMoreSubMenuOpen(false);
    const willBlock = !blockStatus?.isBlockedByMe;
    const confirmMsg = willBlock
      ? `Are you sure you want to block ${activeChat?.displayName}? You will no longer receive their messages or calls.`
      : `Unblock ${activeChat?.displayName}?`;
    if (window.confirm(confirmMsg)) {
      if (willBlock) {
        await blockUser?.(activeChat?.id);
        setBlockStatus?.(prev => ({ ...prev, isBlockedByMe: true }));
      } else {
        await unblockUser?.(activeChat?.id);
        setBlockStatus?.(prev => ({ ...prev, isBlockedByMe: false }));
      }
    }
  };

  const handleOpenInfoAction = () => {
    setShowMoreMenu(false);
    setMoreSubMenuOpen(false);
    if (isGroup) {
      setShowGroupProfileModal(true);
    } else {
      setShowUserProfileModal(true);
    }
  };

  return (
    <div
      className="chat-header-dropdown-menu"
      onClick={(e) => e.stopPropagation()}
    >
      {!moreSubMenuOpen ? (
        <>
          {/* Voice & Video Calls */}
          <VoiceCallMenuItem
            isGroup={isGroup}
            activeChat={activeChat}
            onStartCall={onStartCall}
            onStartGroupCall={onStartGroupCall}
            onCloseMenu={handleCloseMenu}
          />
          <VideoCallMenuItem
            isGroup={isGroup}
            activeChat={activeChat}
            onStartCall={onStartCall}
            onStartGroupCall={onStartGroupCall}
            onCloseMenu={handleCloseMenu}
          />

          {/* Search in chat */}
          <SearchInChatMenuItem
            onCloseMenu={handleCloseMenu}
            onOpenSearch={handleOpenSearch}
          />

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

          {/* Themes & Disappearing */}
          <ChatBackgroundMenuItem
            onCloseMenu={handleCloseMenu}
            onOpenThemeModal={() => setShowThemeModal(true)}
          />
          <SolidThemeMenuItem
            onCloseMenu={handleCloseMenu}
            onOpenSolidThemeModal={() => setShowSolidThemeModal(true)}
          />
          <DisappearingMessagesMenuItem
            isGroup={isGroup}
            disappearingEnabled={Boolean(chatSetting?.disappearingEnabled)}
            onCloseMenu={handleCloseMenu}
            onOpenProfile={handleOpenProfile}
          />
          <VanishModeMenuItem
            isVanishMode={Boolean(isVanishMode)}
            onCloseMenu={handleCloseMenu}
            onToggleVanish={handleToggleVanishMode}
          />

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

          {/* Submenu Trigger */}
          <MoreSubMenuToggleItem onOpenSubMenu={() => setMoreSubMenuOpen(true)} />
        </>
      ) : (
        <>
          {/* Back Button */}
          <SubMenuBackItem onCloseSubMenu={() => setMoreSubMenuOpen(false)} />

          {/* 1. Chat Lock */}
          <ChatLockMenuItem
            isLocked={Boolean(isChatLockedState)}
            onToggleLock={handleToggleChatLockFromMenu}
          />

          {/* 2. Mute / Unmute Notifications */}
          <MuteNotificationsMenuItem
            isMuted={Boolean(isChatMutedState)}
            onToggleMute={handleToggleChatMuteFromMenu}
          />

          {/* 3. Clear Chat */}
          <ClearChatMenuItem onClearChat={handleClearChatAction} />

          {/* 4. Block Contact (if direct chat) */}
          {!isGroup && (
            <BlockContactMenuItem
              isBlocked={Boolean(blockStatus?.isBlockedByMe)}
              onToggleBlock={handleToggleBlockAction}
            />
          )}

          {/* 5. Contact Info / Group Info (Placed LAST in the list!) */}
          <ContactInfoMenuItem
            isGroup={isGroup}
            onOpenInfo={handleOpenInfoAction}
          />
        </>
      )}
    </div>
  );
});

export default ChatHeaderMoreMenu;
