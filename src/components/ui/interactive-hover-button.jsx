import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Adapted from Vengeance UI (`@vengeanceui/interactive-hover-button`).
 * Dependencies: lucide-react, clsx/tailwind-merge (zero new packages).
 * Supports React Router `<Link>` navigation, mobile touch targets, and
 * `prefers-reduced-motion: reduce`.
 */
export function InteractiveHoverButton({
  children,
  className,
  to,
  onClick,
  ...props
}) {
  const content = (
    <>
      <span className="relative z-10 flex items-center justify-center gap-2.5">
        <span
          className="h-2 w-2 rounded-full bg-indigo-200 transition-all duration-300 ease-out group-hover:scale-[85] group-hover:bg-indigo-700 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:bg-indigo-200"
          aria-hidden="true"
        />
        <span className="inline-block transition-all duration-300 ease-out group-hover:translate-x-8 group-hover:opacity-0 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:opacity-100">
          {children}
        </span>
      </span>
      <span
        className="absolute inset-0 z-20 flex items-center justify-center gap-2 translate-x-6 opacity-0 text-white transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:hidden"
        aria-hidden="true"
      >
        <span>{children}</span>
        <ArrowRight size={16} className="shrink-0" />
      </span>
    </>
  );

  const sharedClasses = cn(
    'group relative inline-flex items-center justify-center min-h-[48px] px-6 rounded-xl overflow-hidden bg-indigo-600 text-white text-sm font-semibold shadow-sm cursor-pointer select-none transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transition-none',
    className
  );

  if (to) {
    return (
      <Link to={to} className={sharedClasses} onClick={onClick} {...props}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={sharedClasses} onClick={onClick} {...props}>
      {content}
    </button>
  );
}

export default InteractiveHoverButton;
