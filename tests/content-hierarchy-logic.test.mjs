import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFolderUnlocked,
  isChapterUnlocked,
  getFolderPricing,
  getChapterAccess,
  slugify,
  getFolderPath
} from '../src/lib/content.js';

test('slugify: creates clean URL-safe slugs with unicode normalization', () => {
  assert.equal(slugify('BPSC 70th Prelims 2026'), 'bpsc-70th-prelims-2026');
  assert.equal(slugify('General Studies & Current Affairs!'), 'general-studies-current-affairs');
  assert.equal(slugify('  Leading and Trailing Spaces  '), 'leading-and-trailing-spaces');
});

test('isFolderUnlocked: verifies hierarchical unlock for child folders', () => {
  const folders = [
    { id: 'f-root', title: 'Root Folder', parent_folder_id: null },
    { id: 'f-sub1', title: 'Subfolder 1', parent_folder_id: 'f-root' },
    { id: 'f-sub2', title: 'Deep Subfolder', parent_folder_id: 'f-sub1' }
  ];

  // If root folder is purchased, all subfolders should be unlocked
  const purchasedRoots = ['f-root'];
  assert.equal(isFolderUnlocked('f-root', folders, purchasedRoots), true);
  assert.equal(isFolderUnlocked('f-sub1', folders, purchasedRoots), true);
  assert.equal(isFolderUnlocked('f-sub2', folders, purchasedRoots), true);

  // If only child folder is purchased, parent should NOT be unlocked
  const purchasedChild = ['f-sub2'];
  assert.equal(isFolderUnlocked('f-sub2', folders, purchasedChild), true);
  assert.equal(isFolderUnlocked('f-sub1', folders, purchasedChild), false);
  assert.equal(isFolderUnlocked('f-root', folders, purchasedChild), false);
});

test('isChapterUnlocked: unlocks chapter when either chapter itself or parent folder is purchased', () => {
  const folders = [
    { id: 'f-1', title: 'Folder 1', parent_folder_id: null }
  ];
  const chapterInFolder = { id: 'c-1', folder_id: 'f-1', title: 'Chapter 1' };
  const standaloneChapter = { id: 'c-2', folder_id: null, title: 'Chapter 2' };

  // Case 1: Folder purchased -> Chapter unlocked
  assert.equal(isChapterUnlocked(chapterInFolder, folders, ['f-1'], []), true);

  // Case 2: Chapter directly purchased -> Chapter unlocked
  assert.equal(isChapterUnlocked(chapterInFolder, folders, [], ['c-1']), true);

  // Case 3: Neither purchased -> Chapter locked
  assert.equal(isChapterUnlocked(chapterInFolder, folders, [], []), false);

  // Case 4: Standalone chapter directly purchased -> Chapter unlocked
  assert.equal(isChapterUnlocked(standaloneChapter, folders, [], ['c-2']), true);
  assert.equal(isChapterUnlocked(standaloneChapter, folders, [], []), false);
});

test('getFolderPricing: properly inherits pricing or uses own price', () => {
  const folders = [
    { id: 'f-parent', title: 'Parent Paid', pricing_mode: 'paid-own', price: 199, parent_folder_id: null },
    { id: 'f-child', title: 'Child Inherit', pricing_mode: 'inherit', parent_folder_id: 'f-parent' },
    { id: 'f-free', title: 'Free Folder', pricing_mode: 'free', price: 0, parent_folder_id: null }
  ];

  const parentPricing = getFolderPricing(folders[0], folders);
  assert.equal(parentPricing.amount, 199);
  assert.equal(parentPricing.label, 'Paid · ₹199');

  const childPricing = getFolderPricing(folders[1], folders);
  assert.equal(childPricing.amount, 199);
  assert.ok(childPricing.label.includes('from Parent Paid'));

  const freePricing = getFolderPricing(folders[2], folders);
  assert.equal(freePricing.amount, 0);
  assert.equal(freePricing.label, 'Free');
});

test('getFolderPath: avoids infinite loops on circular references', () => {
  // Edge case: bad DB data with circular parent link
  const circularFolders = [
    { id: 'f-a', parent_folder_id: 'f-b' },
    { id: 'f-b', parent_folder_id: 'f-a' }
  ];
  // Should terminate without stack overflow
  const path = getFolderPath(circularFolders[0], circularFolders);
  assert.ok(Array.isArray(path));
  assert.ok(path.length <= 2, 'Circular reference must be guarded by visited Set');
});

