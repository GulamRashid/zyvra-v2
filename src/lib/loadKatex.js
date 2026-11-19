let cachedKatex = null;
let katexPromise = null;

export function getCachedKatex() {
  return cachedKatex;
}

export function loadKatex() {
  if (cachedKatex) {
    return Promise.resolve(cachedKatex);
  }
  if (!katexPromise) {
    katexPromise = import('katex')
      .then((module) => {
        cachedKatex = module.default || module;
        return cachedKatex;
      })
      .catch((error) => {
        katexPromise = null;
        throw error;
      });
  }
  return katexPromise;
}
