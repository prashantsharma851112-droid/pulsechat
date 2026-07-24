import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

export function SocketProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingMap, setTypingMap] = useState({});

  useEffect(() => {
    if (user) {
      const newSocket = io(BACKEND_URL);
      setSocket(newSocket);

      newSocket.emit('setup', user.id);

      newSocket.on('online_users_list', (users) => {
        setOnlineUsers(users);
      });

      newSocket.on('typing_start', ({ chatId, username }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: username }));
      });

      newSocket.on('typing_stop', ({ chatId }) => {
        setTypingMap(prev => ({ ...prev, [chatId]: null }));
      });

      return () => newSocket.disconnect();
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, typingMap }}>
      {children}
    </SocketContext.Provider>
  );
}
