import { useEffect, useRef } from 'react';

/**
 * useModalBack - Hook to intercept Android hardware back & browser back for modals, drawers, and popups.
 *
 * When a modal is open:
 * 1. Pushes a sentinel history state to trap the back button.
 * 2. On hardware/browser back, dismisses the modal instead of navigating the underlying page away.
 * 3. On UI dismissal (e.g. close 'X' button or backdrop), cleans up the history state safely without ghost pops.
 * 4. IMPORTANT: When the user navigates FORWARD (e.g. clicks a chapter link), the page URL changes
 *    before this cleanup runs. In that case we must NOT call history.back() — doing so would
 *    pull the user back off the new page. We detect this by comparing the href at sentinel-push
 *    time vs. cleanup time.
 *
 * @param {boolean} isOpen - Whether the modal is currently open / mounted.
 * @param {function} onClose - Function to call to dismiss the modal.
 * @param {string} modalId - Unique identifier for debugging and state tagging.
 */
export function useModalBack(isOpen, onClose, modalId = 'modal') {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const poppedByHardwareRef = useRef(false);
  // Track the URL when we pushed the sentinel so we know if the user navigated away
  const sentinelHrefRef = useRef(null);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;

    // Reset flags for this open session
    poppedByHardwareRef.current = false;

    // Capture href BEFORE pushing so cleanup can compare
    sentinelHrefRef.current = window.location.href;

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

      // Only pop the sentinel we pushed if:
      //   a) The modal was dismissed via UI (not hardware back), AND
      //   b) The page URL has NOT changed — i.e. the user did NOT navigate forward
      //      (e.g. clicked a chapter/quiz link). If the URL changed, React Router
      //      already moved the user to a new page; calling history.back() here would
      //      yank them back off that page — which is exactly the "Start → auto back" bug.
      const urlChangedByNavigation = window.location.href !== sentinelHrefRef.current;

      if (!poppedByHardwareRef.current && !urlChangedByNavigation) {
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
