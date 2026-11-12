export const contentTables = ['exams', 'folders', 'chapters'];

export function getContentErrorMessage(error, fallback) {
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : fallback;
  if (/schema cache|could not find the .* column/i.test(message)) {
    return `${message} Apply the Zyvra content schema migration in Supabase, then retry.`;
  }
  return message;
}

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getExamStatus(exam) {
  return String(exam?.status || '').toLowerCase();
}

export function isPublished(item) {
  return ['published', 'active', 'live', 'coming-soon', 'coming_soon'].includes(String(item?.status || '').toLowerCase());
}

export function getFolderPath(folder, folders) {
  const path = [];
  const visited = new Set();
  let current = folder;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    const parentId = current.parent_folder_id || current.parent_id;
    current = folders.find((item) => item.id === parentId);
  }
  return path;
}

export function isFolderUnlocked(folderId, foldersMapOrArray, purchasedFolderIds = []) {
  if (!folderId) return false;
  const purchasedSet = purchasedFolderIds instanceof Set
    ? purchasedFolderIds
    : new Set(Array.isArray(purchasedFolderIds) ? purchasedFolderIds : []);

  if (purchasedSet.has(folderId)) return true;

  const getFolder = typeof foldersMapOrArray?.get === 'function'
    ? (id) => foldersMapOrArray.get(id)
    : Array.isArray(foldersMapOrArray)
      ? (id) => foldersMapOrArray.find((f) => f.id === id)
      : (id) => foldersMapOrArray?.[id];

  let current = getFolder(folderId);
  const visited = new Set();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (purchasedSet.has(current.id)) {
      return true;
    }
    const parentId = current.parent_folder_id || current.parent_id;
    if (!parentId) break;
    current = getFolder(parentId);
  }

  return false;
}

export function isChapterUnlocked(chapter, folders, purchasedFolderIds = [], purchasedChapterIds = []) {
  if (!chapter) return false;
  const chapterSet = purchasedChapterIds instanceof Set
    ? purchasedChapterIds
    : new Set(Array.isArray(purchasedChapterIds) ? purchasedChapterIds : []);
  if (chapterSet.has(chapter.id)) return true;

  const folderId = chapter.folder_id;
  if (!folderId) return false;
  return isFolderUnlocked(folderId, folders, purchasedFolderIds);
}

export function getFolderPricing(folder, folders) {
  if (!folder || folder.pricing_mode === 'free') return { label: 'Free', amount: 0, source: null };
  if (folder.pricing_mode === 'paid-own' || folder.pricing_mode === 'paid_own') {
    return { label: folder.price > 0 ? `Paid · ₹${Number(folder.price).toLocaleString('en-IN')}` : 'Paid · price not set', amount: Number(folder.price) || 0, source: folder };
  }
  const parentId = folder.parent_folder_id || folder.parent_id;
  if (!['inherit', 'inherit-parent', 'inherit_parent'].includes(folder.pricing_mode) || !parentId) {
    return { label: 'Free · no inherited price', amount: 0, source: null };
  }
  const parent = folders.find((item) => item.id === parentId);
  if (!parent) return { label: 'Free · parent unavailable', amount: 0, source: null };
  const inherited = getFolderPricing(parent, folders);
  if (inherited.amount > 0) {
    return { label: `${inherited.label} · from ${parent.title}`, amount: inherited.amount, source: inherited.source };
  }
  return { label: `Free · ${parent.title} has no price`, amount: 0, source: null };
}

export function getChapterAccess(chapter, folder, folders) {
  if (['coming-soon', 'coming_soon'].includes(String(chapter?.status || '').toLowerCase())) {
    return { label: 'Coming Soon', amount: 0 };
  }
  const mode = chapter?.access_mode || 'inherit';
  if (mode === 'free') return { label: 'Free', amount: 0 };
  if (mode === 'paid-own' || mode === 'paid_own') {
    return { label: Number(chapter.price) > 0 ? `Paid · ₹${Number(chapter.price).toLocaleString('en-IN')}` : 'Paid', amount: Number(chapter.price) || 0 };
  }
  const pricing = getFolderPricing(folder, folders);
  return pricing.amount > 0 ? { label: `Locked · ${pricing.label}`, amount: pricing.amount } : { label: 'Free', amount: 0 };
}
