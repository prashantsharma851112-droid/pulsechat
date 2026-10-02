import React from 'react';
import { App as CapApp } from '@capacitor/app';

// Global stack of back handlers: { id, handler, priority }
const backStack = [];
let isCapacitorListenerAttached = false;
let lastBackPressTime = 0;
let exitToastTimer = null;

function showExitToast() {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('pulsechat-exit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'pulsechat-exit-toast';
  toast.innerText = 'Press back again to exit PulseChat';
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(24, 24, 27, 0.95)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    padding: '10px 18px',
    borderRadius: '24px',
    fontSize: '0.84rem',
    fontWeight: '600',
    zIndex: '999999',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
    pointerEvents: 'none',
    transition: 'opacity 0.25s ease'
  });

  document.body.appendChild(toast);
  clearTimeout(exitToastTimer);
  exitToastTimer = setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }
  }, 2000);
}

/**
 * Register a dismiss / back handler on the global navigation stack.
 * Returns an unregister cleanup function.
 */
export function registerBackHandler(handler, options = {}) {
  const id = options.id || ('back_' + Math.random().toString(36).substring(2, 9));
  const entry = {
    id,
    handler,
    priority: options.priority || 0
  };

  // Insert maintaining priority (higher priority first) or at the end
  backStack.push(entry);

  // Push state to browser history for popstate listener
  if (typeof window !== 'undefined' && options.pushState !== false) {
    try {
      window.history.pushState({ pulseBackId: id }, '');
    } catch (e) {}
  }

  // Ensure listeners are initialized
  initBackListeners();

  return () => {
    const idx = backStack.findIndex(item => item.id === id);
    if (idx !== -1) {
      backStack.splice(idx, 1);
    }
  };
}

/**
 * Execute the topmost handler in the back stack.
 * Returns true if a handler was executed, false otherwise.
 */
export function popBackHandler() {
  if (backStack.length === 0) return false;

  // Pop from the top (LIFO)
  const entry = backStack.pop();
  if (entry && typeof entry.handler === 'function') {
    try {
      entry.handler();
      return true;
    } catch (err) {
      console.error('Error executing back handler:', err);
    }
  }
  return false;
}

/**
 * Initialize Capacitor and window listeners.
 */
export function initBackListeners() {
  if (isCapacitorListenerAttached || typeof window === 'undefined') return;
  isCapacitorListenerAttached = true;

  // 1. Capacitor Android Hardware / Swipe Back Button
  try {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      // Check if any registered modal/view handler can handle this
      const handled = popBackHandler();
      if (handled) {
        // Handled successfully, do NOT exit app!
        return;
      }

      // Check for message action overlay or sheet
      const actionOverlay = document.querySelector('.message-action-backdrop') || document.querySelector('.message-action-overlay');
      if (actionOverlay) {
        window.dispatchEvent(new CustomEvent('pulsechat_dismiss_message_action'));
        return;
      }

      // Check if an active chat window is open
      const chatWindowOpen = document.querySelector('.chat-window-container') || document.querySelector('.chat-window-active');
      if (chatWindowOpen) {
        window.dispatchEvent(new CustomEvent('pulsechat_close_active_chat'));
        return;
      }

      // If nothing is open, handle double-tap to exit
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        CapApp.exitApp();
      } else {
        lastBackPressTime = now;
        showExitToast();
      }
    });
  } catch (err) {
    console.warn('Capacitor backButton listener not available:', err);
  }

  // 2. Browser popstate (for mobile web and PWA)
  window.addEventListener('popstate', (e) => {
    const handled = popBackHandler();
    if (handled) return;

    const actionOverlay = document.querySelector('.message-action-backdrop') || document.querySelector('.message-action-overlay');
    if (actionOverlay) {
      window.dispatchEvent(new CustomEvent('pulsechat_dismiss_message_action'));
      return;
    }

    // Otherwise close active chat
    window.dispatchEvent(new CustomEvent('pulsechat_close_active_chat'));
  });

  // 3. Desktop Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      popBackHandler();
    }
  });
}

/**
 * React hook to register a back button handler when a modal or sub-view is active.
 */
export function useBackHandler(handler, isActive = true, options = {}) {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    if (!isActive) return;
    const unregister = registerBackHandler(() => {
      if (handlerRef.current) {
        handlerRef.current();
      }
    }, options);
    return unregister;
  }, [isActive]);
}

