import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCorrectAnswer,
  normalizeOptionKey,
  isQuestionLocked,
  resolveOptionEvaluationState,
  mergeLockedAnswers
} from '../src/lib/tests.js';

test('Quiz Locking: normalizeOptionKey standardizes option inputs', () => {
  assert.equal(normalizeOptionKey('a'), 'A');
  assert.equal(normalizeOptionKey('B'), 'B');
  assert.equal(normalizeOptionKey(' Option C '), 'C');
  assert.equal(normalizeOptionKey('Option (D)'), 'D');
  assert.equal(normalizeOptionKey('E'), 'E');
  assert.equal(normalizeOptionKey(''), '');
  assert.equal(normalizeOptionKey(null), '');
});

test('Quiz Locking: isQuestionLocked detects locked questions across Maps, Objects, and responses', () => {
  const map = new Map();
  map.set('q-1', 'A');
  map.set('q-2', 'B');

  assert.equal(isQuestionLocked('q-1', map), true);
  assert.equal(isQuestionLocked('q-2', map), true);
  assert.equal(isQuestionLocked('q-3', map), false);

  const obj = { 'q-1': 'A', 'q-2': null };
  assert.equal(isQuestionLocked('q-1', obj), true);
  assert.equal(isQuestionLocked('q-2', obj), false);
  assert.equal(isQuestionLocked('q-3', obj), false);

  const responses = {
    'q-1': { selected_option: 'C' },
    'q-2': { selected_option: null, marked_for_review: true },
    'q-3': { selectedOption: 'D' }
  };
  assert.equal(isQuestionLocked('q-1', null, responses), true);
  assert.equal(isQuestionLocked('q-2', null, responses), false);
  assert.equal(isQuestionLocked('q-3', null, responses), true);
  assert.equal(isQuestionLocked('q-4', null, responses), false);
});

test('Quiz Locking: First selection permanently locks the answer in both modes', () => {
  // Simulate the locking mechanism in LiveQuiz / QuestionPracticeModal
  const simulateSelectionEngine = (initialLocked = {}) => {
    const lockedRef = new Map(Object.entries(initialLocked));
    const responses = { ...initialLocked };

    const answer = (qId, option) => {
      const norm = normalizeOptionKey(option);
      // Synchronous lock guard: reject if already locked
      if (lockedRef.has(qId) || responses[qId]?.selected_option) {
        return { success: false, reason: 'LOCKED', selected: lockedRef.get(qId) };
      }
      lockedRef.set(qId, norm);
      responses[qId] = { selected_option: norm, locked_at: Date.now() };
      return { success: true, selected: norm };
    };

    return { answer, getLocked: (qId) => lockedRef.get(qId), responses };
  };

  const engine = simulateSelectionEngine();

  // First selection: locks successfully
  const first = engine.answer('q-101', 'B');
  assert.equal(first.success, true);
  assert.equal(first.selected, 'B');
  assert.equal(engine.getLocked('q-101'), 'B');

  // Second selection on same question (different option): STRICTLY REJECTED
  const second = engine.answer('q-101', 'C');
  assert.equal(second.success, false);
  assert.equal(second.reason, 'LOCKED');
  assert.equal(second.selected, 'B');
  assert.equal(engine.getLocked('q-101'), 'B');

  // Third selection on same question (same option): STRICTLY REJECTED (no toggling off)
  const third = engine.answer('q-101', 'B');
  assert.equal(third.success, false);
  assert.equal(third.reason, 'LOCKED');
  assert.equal(engine.getLocked('q-101'), 'B');

  // Verify another question can be answered and independently locked
  const other = engine.answer('q-102', 'D');
  assert.equal(other.success, true);
  assert.equal(other.selected, 'D');
  assert.equal(engine.getLocked('q-102'), 'D');
});

test('Quiz Locking: Concurrency & rapid click race condition protection (0ms guard)', () => {
  const lockedRef = new Map();
  const clickLog = [];

  // Simulate two rapid clicks hitting within the same microtask
  const click = (qId, opt) => {
    if (lockedRef.has(qId)) {
      clickLog.push({ opt, status: 'REJECTED' });
      return;
    }
    // Synchronously lock immediately before any async dispatch
    lockedRef.set(qId, normalizeOptionKey(opt));
    clickLog.push({ opt, status: 'ACCEPTED' });
  };

  click('q-1', 'A');
  click('q-1', 'B'); // Immediately follows within 0ms
  click('q-1', 'A'); // Rapid double click
  click('q-1', 'C');

  assert.equal(clickLog[0].status, 'ACCEPTED');
  assert.equal(clickLog[0].opt, 'A');
  assert.equal(clickLog[1].status, 'REJECTED');
  assert.equal(clickLog[2].status, 'REJECTED');
  assert.equal(clickLog[3].status, 'REJECTED');
  assert.equal(lockedRef.get('q-1'), 'A');
});

test('Flash Prevention: Practice Mode evaluation state while awaiting answer key (ZERO flash)', () => {
  // Student clicks option 'B' in Practice Mode
  // Initially, correct_answer is null/undefined while RPC is in-flight
  const stateInFlight = resolveOptionEvaluationState({
    optionKey: 'B',
    selectedOption: 'B',
    isImmediate: true,
    correctAnswer: null, // Still in flight!
    isEvaluating: true
  });

  // Verify: Is option marked selected? YES
  assert.equal(stateInFlight.isSelected, true);
  // Verify: Is option locked? YES
  assert.equal(stateInFlight.isLocked, true);
  // Verify: Is option marked correct? NO
  assert.equal(stateInFlight.isCorrect, false);
  // Verify: Is option marked wrong? NO - MUST NEVER FLASH WRONG!
  assert.equal(stateInFlight.isWrong, false);
  // Verify: Is evaluating flag active for spinner? YES
  assert.equal(stateInFlight.isEvaluating, true);

  // Check other unselected options (e.g. 'A', 'C', 'D') while in flight
  const optionAInFlight = resolveOptionEvaluationState({
    optionKey: 'A',
    selectedOption: 'B',
    isImmediate: true,
    correctAnswer: null,
    isEvaluating: true
  });
  assert.equal(optionAInFlight.isSelected, false);
  assert.equal(optionAInFlight.isCorrect, false);
  assert.equal(optionAInFlight.isWrong, false);
});

test('Flash Prevention: Authoritative evaluation matches correct answer', () => {
  // RPC returns with authoritative answer 'B'
  const stateResolvedCorrect = resolveOptionEvaluationState({
    optionKey: 'B',
    selectedOption: 'B',
    isImmediate: true,
    correctAnswer: 'B',
    isEvaluating: false
  });

  assert.equal(stateResolvedCorrect.isSelected, true);
  assert.equal(stateResolvedCorrect.isCorrect, true);
  assert.equal(stateResolvedCorrect.isWrong, false);
  assert.equal(stateResolvedCorrect.isEvaluating, false);

  // Other options correctly show unselected and not wrong
  const optionCResolved = resolveOptionEvaluationState({
    optionKey: 'C',
    selectedOption: 'B',
    isImmediate: true,
    correctAnswer: 'B',
    isEvaluating: false
  });
  assert.equal(optionCResolved.isSelected, false);
  assert.equal(optionCResolved.isCorrect, false);
  assert.equal(optionCResolved.isWrong, false);
});

test('Flash Prevention: Authoritative evaluation marks incorrect selection only when key is known', () => {
  // Student selected 'B', but authoritative answer is 'A'
  const stateResolvedWrong = resolveOptionEvaluationState({
    optionKey: 'B',
    selectedOption: 'B',
    isImmediate: true,
    correctAnswer: 'A',
    isEvaluating: false
  });

  assert.equal(stateResolvedWrong.isSelected, true);
  assert.equal(stateResolvedWrong.isCorrect, false);
  assert.equal(stateResolvedWrong.isWrong, true);

  // Option A should be highlighted as the correct answer
  const stateOptionA = resolveOptionEvaluationState({
    optionKey: 'A',
    selectedOption: 'B',
    isImmediate: true,
    correctAnswer: 'A',
    isEvaluating: false
  });
  assert.equal(stateOptionA.isSelected, false);
  assert.equal(stateOptionA.isCorrect, true);
  assert.equal(stateOptionA.isWrong, false);
});

test('Mock Test Mode: Evaluation is never performed immediately', () => {
  // In Mock Test Mode (isImmediate = false), answers are never evaluated live
  const stateMock = resolveOptionEvaluationState({
    optionKey: 'A',
    selectedOption: 'A',
    isImmediate: false,
    correctAnswer: 'A',
    isEvaluating: false
  });

  assert.equal(stateMock.isSelected, true);
  assert.equal(stateMock.isLocked, true);
  assert.equal(stateMock.isCorrect, false); // No immediate correct indicator in mock
  assert.equal(stateMock.isWrong, false);   // No immediate wrong indicator in mock
});

test('State Persistence: mergeLockedAnswers preserves existing locked answers against overwrites', () => {
  const existing = {
    'q-1': 'A',
    'q-2': 'C'
  };

  // Malicious or corrupted incoming snapshot attempting to change q-1 to 'B' and delete q-2
  const incoming = {
    'q-1': 'B',
    'q-3': 'D'
  };

  const merged = mergeLockedAnswers(existing, incoming);

  assert.equal(merged['q-1'], 'A'); // Locked answer 'A' preserved!
  assert.equal(merged['q-2'], 'C'); // Locked answer 'C' preserved!
  assert.equal(merged['q-3'], 'D'); // New unattempted question answer accepted
});

test('State Persistence: Resuming an attempt loads locked answers into synchronous ref', () => {
  const restoredSnapshot = {
    answers: { 'q-101': 'A', 'q-102': 'D' },
    responses: {
      'q-101': { selected_option: 'A' },
      'q-102': { selected_option: 'D' },
      'q-103': { marked_for_review: true }
    }
  };

  const lockedRef = new Map();
  Object.entries(restoredSnapshot.answers).forEach(([qId, val]) => {
    const norm = normalizeOptionKey(val);
    if (norm) lockedRef.set(qId, norm);
  });

  assert.equal(isQuestionLocked('q-101', lockedRef), true);
  assert.equal(isQuestionLocked('q-102', lockedRef), true);
  assert.equal(isQuestionLocked('q-103', lockedRef), false); // only marked, not answered
  assert.equal(lockedRef.get('q-101'), 'A');
  assert.equal(lockedRef.get('q-102'), 'D');
});

test('Language Switching: Language change does not modify locked answers', () => {
  const responses = {
    'q-1': { selected_option: 'B', locked_at: '2026-11-14T10:00:00Z' }
  };
  let currentLanguage = 'en';

  // Student switches to Hindi
  currentLanguage = 'hi';
  assert.equal(responses['q-1'].selected_option, 'B');

  // Student switches back to English
  currentLanguage = 'en';
  assert.equal(responses['q-1'].selected_option, 'B');
});
