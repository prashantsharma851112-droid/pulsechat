import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Trash2, 
  Forward, 
  Check, 
  Film, 
  FileText, 
  Link2, 
  ExternalLink, 
  Download, 
  CheckSquare, 
  Square,
  HardDrive
} from 'lucide-react';

// Format bytes to human readable string
export const formatStorageSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

// Estimate byte size of a message if not explicitly saved
export const estimateMessageSize = (m) => {
  if (m.bytes && typeof m.bytes === 'number') return m.bytes;
  if (m.fileSize) {
    const s = String(m.fileSize).trim().toUpperCase();
    if (s.endsWith('MB')) return parseFloat(s) * 1024 * 1024;
    if (s.endsWith('KB')) return parseFloat(s) * 1024;
    if (s.endsWith('B')) return parseFloat(s);
  }
  if (m.type === 'video') return 2.5 * 1024 * 1024; // ~2.5 MB average
  if (m.type === 'image') return 380 * 1024; // ~380 KB average
  if (m.type === 'document') return 512 * 1024; // ~512 KB
  if (m.type === 'audio' || m.type === 'voice') return 180 * 1024;
  return 120 * 1024;
};

export default function ChatManageStorageModal({
  chatId,
  targetUser,
  messages = [],
  onClose,
  onDeleteMessages,
  onForwardMessages,
  onOpenFullDp
}) {
  const [activeTab, setActiveTab] = useState('media'); // 'media' | 'docs' | 'links'
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const isPrivateEphemeral = (m) => {
    if (!m) return false;
    return Boolean(
      m.isViewOnce ||
      m.isViewTwice ||
      m.viewLimit ||
      m.isDustImage ||
      m.isDust ||
      m.isFogSnap ||
      m.isDustText ||
      m.type === 'stealth_dust' ||
      m.type === 'viewOnce' ||
      m.viewMode === 'once' ||
      m.viewMode === 'twice' ||
      m.viewMode === 'dust'
    );
  };

  // Filter media items (Only normal public images/videos, never view-once, twice-view, or dust images)
  const mediaItems = useMemo(() => {
    return (messages || []).filter(m => 
      (m.type === 'image' || m.type === 'video') && 
      m.mediaUrl && 
      m.type !== 'deleted' &&
      !m.isDeleted &&
      !isPrivateEphemeral(m)
    );
  }, [messages]);

  // Filter doc items (Only genuine documents, never images, videos, audio, or private ephemeral media)
  const docItems = useMemo(() => {
    return (messages || []).filter(m => 
      (m.type === 'document' || (m.fileName && m.type !== 'image' && m.type !== 'video' && m.type !== 'audio' && m.type !== 'stealth_dust')) && 
      m.mediaUrl &&
      m.type !== 'deleted' &&
      !m.isDeleted &&
      !isPrivateEphemeral(m)
    );
  }, [messages]);

  // Filter links items
  const linkItems = useMemo(() => {
    const list = [];
    (messages || []).forEach(m => {
      if (m.type === 'text' && m.content && m.type !== 'deleted') {
        const matches = m.content.match(/https?:\/\/[^\s]+/g);
        if (matches) {
          matches.forEach(url => {
            list.push({
              id: m.id,
              url,
              timestamp: m.timestamp,
              senderId: m.senderId,
              rawMessage: m
            });
          });
        }
      }
    });
    return list;
  }, [messages]);

  // Calculate total storage consumed
  const totalStorageBytes = useMemo(() => {
    let bytes = 0;
    mediaItems.forEach(m => { bytes += estimateMessageSize(m); });
    docItems.forEach(m => { bytes += estimateMessageSize(m); });
    return bytes;
  }, [mediaItems, docItems]);

  // Current tab items
  const currentTabItems = useMemo(() => {
    if (activeTab === 'media') return mediaItems;
    if (activeTab === 'docs') return docItems;
    return linkItems;
  }, [activeTab, mediaItems, docItems, linkItems]);

  // Group media by date (Recent, Last Month, Older)
  const groupedMedia = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const recent = [];
    const lastMonth = [];
    const older = [];

    mediaItems.forEach(item => {
      const ts = item.timestamp ? new Date(item.timestamp).getTime() : now;
      if (ts >= sevenDaysAgo) {
        recent.push(item);
      } else if (ts >= thirtyDaysAgo) {
        lastMonth.push(item);
      } else {
        older.push(item);
      }
    });

    return { recent, lastMonth, older };
  }, [mediaItems]);

  const toggleSelectItem = (id) => {
    setSelectedIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(x => x !== id) : [...prev, id];
      if (next.length === 0) {
        setIsSelectionMode(false);
      } else {
        setIsSelectionMode(true);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = currentTabItems.map(item => item.id);
    if (selectedIds.length === allIds.length && allIds.length > 0) {
      setSelectedIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedIds(allIds);
      setIsSelectionMode(true);
    }
  };

  const handleCancelSelection = () => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Delete ${selectedIds.length} item(s) from this chat?`)) {
      if (onDeleteMessages) {
        onDeleteMessages(selectedIds);
      }
      setSelectedIds([]);
      setIsSelectionMode(false);
    }
  };

  const handleForwardSelected = () => {
    if (selectedIds.length === 0) return;
    const itemsToForward = (messages || []).filter(m => selectedIds.includes(m.id));
    if (itemsToForward.length > 0 && onForwardMessages) {
      onForwardMessages(itemsToForward);
      handleCancelSelection();
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)'
      }}
    >
      <div 
        className="modal-card" 
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '88vh',
          maxHeight: '750px',
          background: 'var(--bg-chat, #0b141a)',
          color: 'var(--text-main, #e9edef)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
        }}
      >
        {/* Top Header Bar */}
        {isSelectionMode ? (
          // Selection Action Bar (WhatsApp Style - Image 3)
          <div style={{
            background: 'var(--bg-card, #202c33)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={handleCancelSelection}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main, #fff)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Cancel selection"
              >
                <ArrowLeft size={22} />
              </button>
              <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                {selectedIds.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={handleDeleteSelected}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '50%'
                }}
                title="Delete selected media"
              >
                <Trash2 size={21} />
              </button>
              <button
                onClick={handleForwardSelected}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent, #00a884)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '50%'
                }}
                title="Forward selected media"
              >
                <Forward size={21} />
              </button>
              <button
                onClick={handleSelectAll}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main, #fff)',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                  gap: '5px'
                }}
                title="Select all"
              >
                {selectedIds.length === currentTabItems.length && currentTabItems.length > 0 ? (
                  <CheckSquare size={21} color="var(--accent, #00a884)" />
                ) : (
                  <Square size={21} />
                )}
              </button>
            </div>
          </div>
        ) : (
          // Normal Header Bar (WhatsApp Style - Image 2)
          <div style={{
            background: 'var(--bg-card, #202c33)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button 
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main, #fff)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Back"
              >
                <ArrowLeft size={22} />
              </button>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                  {targetUser?.displayName || 'All media'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #8696a0)' }}>
                  Manage storage • {formatStorageSize(totalStorageBytes)}
                </span>
              </div>
            </div>

            {currentTabItems.length > 0 && (
              <button
                onClick={() => setIsSelectionMode(true)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: 'var(--text-main, #fff)',
                  borderRadius: '16px',
                  padding: '5px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Select
              </button>
            )}
          </div>
        )}

        {/* Tab Navigation (MEDIA, DOCS, LINKS) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
          background: 'var(--bg-card, #202c33)',
          flexShrink: 0
        }}>
          <button
            onClick={() => { setActiveTab('media'); handleCancelSelection(); }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'media' ? '3px solid var(--accent, #00a884)' : '3px solid transparent',
              color: activeTab === 'media' ? 'var(--accent, #00a884)' : 'var(--text-muted, #8696a0)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.15s ease'
            }}
          >
            MEDIA ({mediaItems.length})
          </button>
          <button
            onClick={() => { setActiveTab('docs'); handleCancelSelection(); }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'docs' ? '3px solid var(--accent, #00a884)' : '3px solid transparent',
              color: activeTab === 'docs' ? 'var(--accent, #00a884)' : 'var(--text-muted, #8696a0)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.15s ease'
            }}
          >
            DOCS ({docItems.length})
          </button>
          <button
            onClick={() => { setActiveTab('links'); handleCancelSelection(); }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'links' ? '3px solid var(--accent, #00a884)' : '3px solid transparent',
              color: activeTab === 'links' ? 'var(--accent, #00a884)' : 'var(--text-muted, #8696a0)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              letterSpacing: '0.6px',
              transition: 'all 0.15s ease'
            }}
          >
            LINKS ({linkItems.length})
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 12px',
          WebkitOverflowScrolling: 'touch'
        }}>
          {/* TAB 1: MEDIA */}
          {activeTab === 'media' && (
            <div>
              {mediaItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted, #8696a0)' }}>
                  No photos or videos shared yet
                </div>
              ) : (
                <>
                  {/* RECENT Section */}
                  {groupedMedia.recent.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #8696a0)', padding: '4px 0 8px 4px', letterSpacing: '0.5px' }}>
                        RECENT
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {groupedMedia.recent.map(m => renderMediaThumbnail(m))}
                      </div>
                    </div>
                  )}

                  {/* LAST MONTH Section */}
                  {groupedMedia.lastMonth.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #8696a0)', padding: '4px 0 8px 4px', letterSpacing: '0.5px' }}>
                        LAST MONTH
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {groupedMedia.lastMonth.map(m => renderMediaThumbnail(m))}
                      </div>
                    </div>
                  )}

                  {/* OLDER Section */}
                  {groupedMedia.older.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #8696a0)', padding: '4px 0 8px 4px', letterSpacing: '0.5px' }}>
                        OLDER
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {groupedMedia.older.map(m => renderMediaThumbnail(m))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: DOCS */}
          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {docItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted, #8696a0)' }}>
                  No documents shared yet
                </div>
              ) : (
                docItems.map(f => {
                  const isSelected = selectedIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleSelectItem(f.id);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        toggleSelectItem(f.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(0, 168, 132, 0.16)' : 'var(--bg-card, #202c33)',
                        border: isSelected ? '1px solid var(--accent, #00a884)' : '1px solid var(--border, rgba(255,255,255,0.06))',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        {isSelectionMode ? (
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: isSelected ? 'var(--accent, #00a884)' : 'transparent',
                            border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                          </div>
                        ) : (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <FileText size={18} color="var(--accent, #6366f1)" />
                          </div>
                        )}
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.fileName || 'Attachment'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8696a0)' }}>
                            {f.fileSize || 'Document'} • {new Date(f.timestamp || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {!isSelectionMode && (
                        <a
                          href={f.mediaUrl}
                          download={f.fileName || 'file'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            color: 'var(--accent, #00a884)',
                            padding: '6px',
                            display: 'flex',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.06)'
                          }}
                          title="Download"
                        >
                          <Download size={16} />
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: LINKS */}
          {activeTab === 'links' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {linkItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted, #8696a0)' }}>
                  No web links shared yet
                </div>
              ) : (
                linkItems.map((l, idx) => {
                  const isSelected = selectedIds.includes(l.id);
                  return (
                    <div
                      key={l.id + '_' + idx}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleSelectItem(l.id);
                        } else {
                          window.open(l.url, '_blank');
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        toggleSelectItem(l.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(0, 168, 132, 0.16)' : 'var(--bg-card, #202c33)',
                        border: isSelected ? '1px solid var(--accent, #00a884)' : '1px solid var(--border, rgba(255,255,255,0.06))',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        {isSelectionMode ? (
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: isSelected ? 'var(--accent, #00a884)' : 'transparent',
                            border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                          </div>
                        ) : (
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Link2 size={18} color="#10b981" />
                          </div>
                        )}
                        <div style={{ overflow: 'hidden', minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.url}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8696a0)' }}>
                            {new Date(l.timestamp || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <ExternalLink size={15} color="var(--text-muted, #8696a0)" style={{ flexShrink: 0 }} />
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Helper to render media thumbnail with WhatsApp selection badge
  function renderMediaThumbnail(m) {
    const isSelected = selectedIds.includes(m.id);
    return (
      <div
        key={m.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleSelectItem(m.id);
          } else {
            if (m.type === 'video') {
              window.open(m.mediaUrl, '_blank');
            } else if (onOpenFullDp) {
              onOpenFullDp(m.mediaUrl, 'Shared Media', targetUser?.username);
            }
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          toggleSelectItem(m.id);
        }}
        style={{
          position: 'relative',
          aspectRatio: '1',
          borderRadius: '4px',
          overflow: 'hidden',
          background: '#182229',
          cursor: 'pointer',
          outline: isSelected ? '3px solid var(--accent, #00a884)' : 'none'
        }}
      >
        {m.type === 'video' ? (
          <>
            <video 
              src={m.mediaUrl} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
            <div style={{ 
              position: 'absolute', 
              bottom: '4px', 
              left: '4px', 
              background: 'rgba(0,0,0,0.6)', 
              borderRadius: '4px', 
              padding: '2px 5px', 
              display: 'flex', 
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.65rem',
              color: '#fff'
            }}>
              <Film size={11} color="#fff" />
              <span>Video</span>
            </div>
          </>
        ) : (
          <img
            src={m.mediaUrl}
            alt="Shared media"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        )}

        {/* Selected Overlay & WhatsApp-Style Green Checkmark Circle (Image 3) */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent, #00a884)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
            }}>
              <Check size={18} color="#ffffff" strokeWidth={3} />
            </div>
          </div>
        )}
      </div>
    );
  }
}
