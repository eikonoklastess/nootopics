import { useEffect } from 'react';

interface KeyboardShortcutActions {
  onEscape?: () => void;
  onSearch?: () => void;
  onFocusComposer?: () => void;
}

export function useKeyboardShortcuts(actions: KeyboardShortcutActions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Escape - always works, closes panels
      if (event.key === 'Escape') {
        actions.onEscape?.();
        return;
      }

      // Don't trigger shortcuts when typing in an input
      if (isInputFocused) return;

      // Ctrl/Cmd + K - Focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        actions.onSearch?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
