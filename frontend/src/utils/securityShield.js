// Client security setup

export function initSecurityShield() {
  if (typeof window === 'undefined') return;

  // disable right click context menu outside inputs
  document.addEventListener('contextmenu', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    const isEditable = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if (!isEditable) {
      e.preventDefault();
      return false;
    }
  }, { capture: true });

  // block devtools and view source key combos
  document.addEventListener('keydown', (e) => {
    // F12 key
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // inspect elements key shortcuts
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      const key = (e.key || '').toUpperCase();
      if (key === 'I' || key === 'J' || key === 'C' || key === 'K') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }

    // view source shortcut
    if ((e.ctrlKey || e.metaKey) && ((e.key || '').toUpperCase() === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // save shortcut
    if ((e.ctrlKey || e.metaKey) && ((e.key || '').toUpperCase() === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  try {
    console.log(
      "%cSTOP!",
      "color: #ef4444; font-size: 18px; font-weight: 800;"
    );
  } catch (e) {}
}
