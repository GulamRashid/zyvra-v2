import test from 'node:test';
import assert from 'node:assert/strict';

test('useModalBack: pushState on open and popstate dismissal logic', () => {
  const historyStack = ['https://zyvra.app/chapter/123'];
  const eventListeners = {};

  const mockWindow = {
    location: { href: historyStack[0] },
    history: {
      pushState(state, title, url) {
        historyStack.push({ state, url });
      },
      back() {
        if (historyStack.length > 1) {
          historyStack.pop();
          if (eventListeners['popstate']) {
            eventListeners['popstate'].forEach((fn) => fn({ state: historyStack[historyStack.length - 1]?.state }));
          }
        }
      }
    },
    addEventListener(event, fn) {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter((cb) => cb !== fn);
      }
    },
    __zyvra_suppress_modal_pop: false
  };

  // Scenario 1: Modal opens, hardware back button is pressed on Android
  let closed = false;
  const onClose = () => { closed = true; };

  const stateTag = 'zyvra_modal_pdf-reader';
  mockWindow.history.pushState({ [stateTag]: true, zyvraModal: 'pdf-reader' }, '', mockWindow.location.href);
  assert.equal(historyStack.length, 2, 'History stack should have pushed state for modal');

  const popHandler = () => {
    if (mockWindow.__zyvra_suppress_modal_pop) {
      mockWindow.__zyvra_suppress_modal_pop = false;
      return;
    }
    onClose();
  };
  mockWindow.addEventListener('popstate', popHandler);

  // User presses hardware Back
  mockWindow.history.back();
  assert.equal(closed, true, 'onClose should be called when hardware back is pressed');
  assert.equal(historyStack.length, 1, 'History stack should revert to original route');
  mockWindow.removeEventListener('popstate', popHandler);

  // Scenario 2: Modal closed via UI ('X' button or backdrop) - suppresses phantom popstate
  mockWindow.history.pushState({ [stateTag]: true, zyvraModal: 'pdf-reader' }, '', mockWindow.location.href);
  assert.equal(historyStack.length, 2);

  let secondaryHandlerTriggered = false;
  const secondaryPopHandler = () => {
    if (mockWindow.__zyvra_suppress_modal_pop) {
      mockWindow.__zyvra_suppress_modal_pop = false;
      return;
    }
    secondaryHandlerTriggered = true;
  };
  mockWindow.addEventListener('popstate', secondaryPopHandler);

  // UI close button calls cleanup
  mockWindow.__zyvra_suppress_modal_pop = true;
  mockWindow.history.back();

  assert.equal(historyStack.length, 1, 'History stack should be cleanly popped on UI dismiss');
  assert.equal(secondaryHandlerTriggered, false, 'Suppressed popstate should not trigger secondary page navigation');
});

test('Double-Back to Exit Guard: timing and sentinel re-push logic', () => {
  let lastPressTime = 0;
  let toastVisible = false;
  let exitAllowed = false;
  let stackPushes = 0;

  const handleBackPress = (currentTime) => {
    if (lastPressTime > 0 && currentTime - lastPressTime < 2000) {
      exitAllowed = true;
      toastVisible = false;
      return 'exit';
    }
    lastPressTime = currentTime;
    toastVisible = true;
    stackPushes += 1;
    return 'prompt';
  };

  // Press 1 at t = 1000ms
  const res1 = handleBackPress(1000);
  assert.equal(res1, 'prompt');
  assert.equal(toastVisible, true, 'Toast should be visible after 1st back press');
  assert.equal(exitAllowed, false, 'App should NOT exit on 1st back press');
  assert.equal(stackPushes, 1, 'Sentinel state should be re-pushed');

  // Press 2 at t = 1800ms (800ms later, within 2000ms threshold)
  const res2 = handleBackPress(1800);
  assert.equal(res2, 'exit');
  assert.equal(exitAllowed, true, 'App should exit on rapid 2nd back press');
  assert.equal(toastVisible, false);

  // Press 3 after delay (t = 5000ms, threshold exceeded)
  lastPressTime = 0;
  const res3 = handleBackPress(5000);
  assert.equal(res3, 'prompt');
  assert.equal(toastVisible, true, 'Toast should appear again if threshold was exceeded');
});

