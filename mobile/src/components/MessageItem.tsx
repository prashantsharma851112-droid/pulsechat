import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Modal, TouchableOpacity } from 'react-native';
import { Message } from '../services/api';

interface MessageItemProps {
  message: Message;
  currentUserId: string;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, currentUserId }) => {
  const isMe = message.senderId === currentUserId;

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const [showViewOnce, setShowViewOnce] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [hasViewed, setHasViewed] = useState(
    message.viewedBy?.includes(currentUserId) || false
  );

  const isViewOnceConsumed = message.isViewOnce && (hasViewed || (!isMe && message.viewedBy?.includes(currentUserId)));

  return (
    <View style={[styles.container, isMe ? styles.myContainer : styles.theirContainer]}>
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {message.isViewOnce ? (
          <View style={{ paddingVertical: 4 }}>
            {isViewOnceConsumed ? (
              <View style={styles.viewOnceOpenedBadge}>
                <Text style={{ color: '#8696a0', fontSize: 13, fontWeight: '600' }}>1️⃣ Opened</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowViewOnce(true)}
                style={styles.viewOnceBtn}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14 }}>1️⃣ 🔒</Text>
                <Text style={styles.viewOnceBtnText}>
                  {message.type === 'image' ? 'View Once Photo' : 'View Once Media'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          message.mediaUrl && (
            <Image source={{ uri: message.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
          )
        )}

        {message.type === 'audio' && (
          <View style={styles.audioContainer}>
            <Text style={styles.audioIcon}>🎙️</Text>
            <Text style={styles.audioText}>Voice Note</Text>
          </View>
        )}

        {message.content ? (
          <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
            {message.content}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={styles.timeText}>{formattedTime}</Text>
          {isMe && (
            <Text style={styles.statusCheck}>
              {message.status === 'pending' ? '🕒' : message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>

      {/* View Once Protected Hold-to-View Modal */}
      {showViewOnce && message.mediaUrl && (
        <Modal
          visible={showViewOnce}
          transparent={false}
          animationType="fade"
          onRequestClose={() => {
            setHasViewed(true);
            setShowViewOnce(false);
          }}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalTopBar}>
              <Text style={styles.modalTitle}>🔒 View Once Protected Photo</Text>
              <TouchableOpacity
                onPress={() => {
                  setHasViewed(true);
                  setShowViewOnce(false);
                }}
                style={styles.closeBtn}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalMediaBox}>
              {isHolding ? (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Image
                    source={{ uri: message.mediaUrl }}
                    style={styles.fullMediaImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.watermarkText}>
                    🔒 PULSECHAT • DO NOT SCREENSHOT • PROTECTED
                  </Text>
                </View>
              ) : (
                <View style={styles.lockedBox}>
                  <Text style={{ fontSize: 44, marginBottom: 12 }}>🔒</Text>
                  <Text style={styles.lockedTitle}>Protected View-Once Media</Text>
                  <Text style={styles.lockedSub}>
                    Screenshots and recording are blocked. Photo is only visible while pressing the button below.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalBottomBar}>
              <TouchableOpacity
                onPressIn={() => {
                  setIsHolding(true);
                  setHasViewed(true);
                }}
                onPressOut={() => setIsHolding(false)}
                activeOpacity={0.9}
                style={[styles.holdButton, isHolding && styles.holdButtonActive]}
              >
                <Text style={styles.holdButtonText}>
                  {isHolding ? '👁️ Viewing... (Keep Pressing)' : '👆 Press & Hold to View'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.holdHint}>
                {isHolding ? 'Release finger to hide photo immediately' : 'Screenshot is strictly blocked • Disappears on release'}
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  myContainer: {
    justifyContent: 'flex-end',
  },
  theirContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  myBubble: {
    backgroundColor: '#005c4b',
    borderTopRightRadius: 2,
  },
  theirBubble: {
    backgroundColor: '#202c33',
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myText: {
    color: '#e9edef',
  },
  theirText: {
    color: '#e9edef',
  },
  mediaImage: {
    width: 220,
    height: 160,
    borderRadius: 8,
    marginBottom: 6,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 6,
    borderRadius: 6,
  },
  audioIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  audioText: {
    color: '#00a884',
    fontWeight: '600',
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#8696a0',
    marginRight: 4,
  },
  statusCheck: {
    fontSize: 12,
    color: '#53bdeb',
    fontWeight: 'bold',
  },
  viewOnceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    gap: 6,
  },
  viewOnceBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  viewOnceOpenedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  modalBg: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  modalTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMediaBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullMediaImage: {
    width: 320,
    height: 420,
    borderRadius: 14,
  },
  watermarkText: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    letterSpacing: 1,
  },
  lockedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  lockedTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedSub: {
    color: '#8696a0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalBottomBar: {
    alignItems: 'center',
    gap: 8,
  },
  holdButton: {
    width: '100%',
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdButtonActive: {
    backgroundColor: '#10b981',
  },
  holdButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  holdHint: {
    color: '#8696a0',
    fontSize: 11,
    textAlign: 'center',
  },
});
