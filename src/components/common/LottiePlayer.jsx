import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';

/**
 * Reusable, GPU-friendly Lottie Animation Player
 * Complies with GEMINI.md 60fps & CLS=0 guidelines
 */
export default function LottiePlayer({
  animationData,
  path,
  loop = true,
  autoplay = true,
  className = 'w-24 h-24',
  style = {}
}) {
  const containerRef = useRef(null);
  const animInstanceRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!animationData && !path) return;

    try {
      animInstanceRef.current = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop,
        autoplay,
        ...(animationData ? { animationData } : { path })
      });
    } catch (err) {
      console.warn('Lottie animation failed to load:', err);
    }

    return () => {
      if (animInstanceRef.current) {
        try {
          animInstanceRef.current.destroy();
        } catch {}
        animInstanceRef.current = null;
      }
    };
  }, [animationData, path, loop, autoplay]);

  return (
    <div
      ref={containerRef}
      className={`inline-block pointer-events-none ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}
