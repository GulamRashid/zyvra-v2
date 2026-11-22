import { useEffect, useRef } from 'react';

/**
 * useModalBack - Hook to intercept Android hardware back & browser back for modals, drawers, and popups.
 * 
 * When a modal is open:
 * 1. Pushes a sentinel history state to trap the back button.
 * 2. On hardware/browser back, dismisses the modal instead of navigating the underlying page away.
 * 3. On UI dismissal (e.g. close 'X' button or backdrop), cleans up the history state safely without ghost pops.
 *
 * @param {boolean} isOpen - Whether the modal is currently open / mounted.
 * @param {function} onClose - Function to call to dismiss the modal.
 * @param {string} modalId - Unique identifier for debugging and state tagging.
 */
export function useModalBack(isOpen, onClose, modalId = 'modal') {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const poppedByHardwareRef = useRef(false);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;

    // Reset flag for this open session
    poppedByHardwareRef.current = false;

    // Push history state to trap back action
    const stateTag = `zyvra_modal_${modalId}`;
    try {
      window.history.pushState({ [stateTag]: true, zyvraModal: modalId }, '', window.location.href);
    } catch {
      // Ignore security errors in restricted environments
    }

    const handlePopState = () => {
      // Check if this pop was triggered programmatically during cleanup
      if (window.__zyvra_suppress_modal_pop) {
        window.__zyvra_suppress_modal_pop = false;
        return;
      }

      // Hardware or browser Back was pressed
      poppedByHardwareRef.current = true;
      if (typeof onCloseRef.current === 'function') {
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // If closed via UI (X button, backdrop, ESC key) rather than hardware back,
      // pop the history entry we pushed so history remains clean
      if (!poppedByHardwareRef.current) {
        window.__zyvra_suppress_modal_pop = true;
        try {
          window.history.back();
        } catch {
          window.__zyvra_suppress_modal_pop = false;
        }
      }
    };
  }, [isOpen, modalId]);
}

export default useModalBack;
