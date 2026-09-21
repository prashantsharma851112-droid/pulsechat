// PulseChat Client-Side Security Shield
// Protects code from DevTools inspect, right-click source viewing, and shortcut hijacking

export function initSecurityShield() {
  if (typeof window === 'undefined') return;

  // 1. Disable Right-Click Context Menu (allows only inside inputs/textareas for pasting)
  document.addEventListener('contextmenu', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    const isEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if (!isEditable) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // 2. Block Inspect & Source-Viewing Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // F12 (DevTools)
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+Shift+I or Cmd+Opt+I (Developer Tools)
    // Ctrl+Shift+J or Cmd+Opt+J (Console)
    // Ctrl+Shift+C or Cmd+Opt+C (Inspect Element)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const key = (e.key || '').toUpperCase();
      if (key === 'I' || key === 'J' || key === 'C' || key === 'K') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }

    // Ctrl+U or Cmd+Opt+U (View Page Source)
    if ((e.ctrlKey || e.metaKey) && ((e.key || '').toUpperCase() === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl+S (Save Page HTML)
    if ((e.ctrlKey || e.metaKey) && ((e.key || '').toUpperCase() === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 3. Console Warning & Clean Shield Notice
  try {
    console.log(
      "%c⛔ STOP! PULSECHAT SECURITY SHIELD ACTIVE",
      "color: #ef4444; font-size: 20px; font-weight: 800; text-shadow: 1px 1px 2px black;"
    );
    console.log(
      "%cThis browser console is protected. Attempting to reverse engineer or extract copyrighted source assets is prohibited.",
      "color: #6366f1; font-size: 13px; font-weight: 600;"
    );
  } catch (e) {}
}
