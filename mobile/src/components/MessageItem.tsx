import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
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

  return (
    <View style={[styles.container, isMe ? styles.myContainer : styles.theirContainer]}>
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        {message.mediaUrl && (
          <Image source={{ uri: message.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
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
              {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
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
});
