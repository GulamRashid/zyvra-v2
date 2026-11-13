export function loadKatex() {
  return import('katex').then((module) => module.default || module);
}
