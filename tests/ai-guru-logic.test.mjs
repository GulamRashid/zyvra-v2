import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_CONFIG,
  checkAiPermission,
  queryZyvraAiGuru
} from '../src/lib/gemini.js';

test('checkAiPermission: allows free queries within daily free limit', () => {
  const config = { ...DEFAULT_AI_CONFIG, freeQuestionsPerDay: 3, coinsPerQuestion: 2 };
  
  // Simulation: 0 used so far
  const res = checkAiPermission('test-user-fresh', 0, config, false);
  assert.equal(res.allowed, true);
  assert.equal(res.isFree, true);
  assert.equal(res.coinsNeeded, 0);
});

test('checkAiPermission: prompts for coins when free questions are exhausted', () => {
  const config = { ...DEFAULT_AI_CONFIG, freeQuestionsPerDay: 0, coinsPerQuestion: 2 };
  
  // 0 free questions left, user has 1 coin (needs 2)
  const resNoCoins = checkAiPermission('test-user-spent', 1, config, false);
  assert.equal(resNoCoins.allowed, false);
  assert.equal(resNoCoins.isFree, false);
  assert.equal(resNoCoins.coinsNeeded, 2);
  assert.equal(resNoCoins.reason, 'insufficient_coins');

  // User has 5 coins (needs 2)
  const resWithCoins = checkAiPermission('test-user-spent', 5, config, false);
  assert.equal(resWithCoins.allowed, true);
  assert.equal(resWithCoins.isFree, false);
  assert.equal(resWithCoins.coinsNeeded, 2);
});

test('checkAiPermission: blocks when AI is disabled globally by admin', () => {
  const config = { ...DEFAULT_AI_CONFIG, enabled: false };
  const res = checkAiPermission('any-user', 100, config, true);

  assert.equal(res.allowed, false);
  assert.equal(res.reason, 'ai_disabled');
});

test('queryZyvraAiGuru: rejects empty prompt before network call', async () => {
  await assert.rejects(
    async () => {
      await queryZyvraAiGuru({ prompt: '   ' });
    },
    { message: /Please enter a question/ }
  );
});
