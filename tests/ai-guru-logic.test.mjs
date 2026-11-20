import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_CONFIG,
  checkAiPermission,
  queryZyvraAiGuru
} from '../src/lib/gemini.js';
import {
  prepareSpeechText,
  splitIntoSentences,
  pickBestVoice
} from '../src/lib/speechVoice.js';

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

test('prepareSpeechText: scrubs emojis and markdown asterisks for natural voice synthesis', () => {
  const raw = '### 🏔️ **रोहतांग दर्रा** (Rohtang Pass)\n* **ऊंचाई**: 3,978 मीटर। ⚡ ट्रिक याद रखें: $v = \\frac{d}{t}$!';
  const cleaned = prepareSpeechText(raw);

  // Emojis must be scrubbed
  assert.equal(cleaned.includes('🏔️'), false);
  assert.equal(cleaned.includes('⚡'), false);
  // Markdown hashes and asterisks must be scrubbed
  assert.equal(cleaned.includes('*'), false);
  assert.equal(cleaned.includes('#'), false);
  // Fractions must be natural words
  assert.equal(cleaned.includes('बटा'), true);
});

test('splitIntoSentences: splits Hindi and English by natural sentence terminators', () => {
  const text = 'रोहतांग दर्रा हिमाचल प्रदेश में है। यह कुल्लू को जोड़ता है! क्या आप समझ गए?';
  const sentences = splitIntoSentences(text);

  assert.equal(sentences.length, 3);
  assert.equal(sentences[0].includes('हिमाचल'), true);
  assert.equal(sentences[1].includes('कुल्लू'), true);
});

test('pickBestVoice: selects Google or Natural Hindi voice when available', () => {
  const mockVoices = [
    { name: 'Microsoft David', lang: 'en-US' },
    { name: 'Google हिन्दी', lang: 'hi-IN' },
    { name: 'Microsoft Ravi', lang: 'en-IN' }
  ];

  const bestHi = pickBestVoice(mockVoices, 'hi-IN');
  assert.equal(bestHi.name, 'Google हिन्दी');

  const bestEn = pickBestVoice(mockVoices, 'en-IN');
  assert.equal(bestEn.name, 'Microsoft Ravi');
});

