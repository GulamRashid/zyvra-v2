import { cn } from '@/lib/utils';

/**
 * Zero-dependency fallback matching Vengeance UI (`@vengeanceui/stagger-text`)
 * motion curve & timing: word-by-word masked vertical slide (`110% -> 0%`),
 * `600ms` duration, `50ms` stagger per word, `cubic-bezier(0.22, 1, 0.36, 1)`,
 * single-play, disabled automatically under `prefers-reduced-motion: reduce`.
 */
export function StaggerText({
  children,
  className,
  delay = 0,
  staggerMs = 50
}) {
  const text = typeof children === 'string' || typeof children === 'number'
    ? String(children)
    : '';

  if (!text) {
    return <span className={className}>{children}</span>;
  }

  const words = text.split(' ');

  return (
    <span className={cn('inline', className)}>
      {words.map((word, idx) => (
        <span
          key={`${idx}-${word}`}
          className="inline-block overflow-hidden align-top pb-1 -mb-1"
        >
          <span
            className="zyvra-stagger-word inline-block"
            style={{ '--stagger-delay': `${delay + idx * staggerMs}ms` }}
          >
            {word}
            {idx < words.length - 1 ? '\u00A0' : ''}
          </span>
        </span>
      ))}
    </span>
  );
}

export default StaggerText;
