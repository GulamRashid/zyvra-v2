import { cn } from '@/lib/utils';

/**
 * Adapted from Vengeance UI (`@vengeanceui/aurora-hero`).
 * Dependencies: `cn` only (pure CSS + SVG fluted glass filter, zero new npm packages).
 * Recoloured from default rainbow to calm low-opacity Indigo / Slate / White stops,
 * with `prefers-reduced-motion: reduce` support and zero `background-attachment: fixed`
 * mobile scroll jank.
 */
export function AuroraHero({ isDark = false, className, children, ...props }) {
  const filterImageHref =
    'data:image/svg+xml,' +
    encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' color-interpolation-filters='sRGB'>
        <g>
          <rect width='1' height='1' fill='black' />
          <rect width='1' height='1' fill='url(#red)' style='mix-blend-mode:screen' />
          <rect width='1' height='1' fill='url(#green)' style='mix-blend-mode:screen' />
          <rect width='1' height='1' fill='url(#yellow)' style='mix-blend-mode:screen' />
        </g>
        <defs>
          <radialGradient id='yellow' cx='0' cy='0' r='1'>
            <stop stop-color='yellow' />
            <stop stop-color='yellow' offset='1' stop-opacity='0' />
          </radialGradient>
          <radialGradient id='green' cx='1' cy='0' r='1'>
            <stop stop-color='green' />
            <stop stop-color='green' offset='1' stop-opacity='0' />
          </radialGradient>
          <radialGradient id='red' cx='0' cy='1' r='1'>
            <stop stop-color='red' />
            <stop stop-color='red' offset='1' stop-opacity='0' />
          </radialGradient>
        </defs>
      </svg>
    `);

  return (
    <section
      className={cn(
        'zyvra-aurora-hero relative overflow-hidden',
        isDark ? 'zyvra-aurora-dark' : 'zyvra-aurora-light',
        className
      )}
      {...props}
    >
      {/* Calm recoloured Indigo / Slate Aurora backdrop + soft fluted light glass */}
      <div className="zyvra-aurora-backdrop pointer-events-none" aria-hidden="true">
        <div className="zyvra-aurora-bands" />
        <div className="zyvra-aurora-fluted" />
      </div>

      {/* Foreground hero content stays 100% sharp & readable */}
      <div className="relative z-10">{children}</div>

      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        colorInterpolationFilters="sRGB"
        style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
        aria-hidden="true"
        focusable="false"
      >
        <filter id="zyvra-fluted" primitiveUnits="objectBoundingBox">
          <feImage
            x="0"
            y="0"
            result="image_0"
            crossOrigin="anonymous"
            href={filterImageHref}
            preserveAspectRatio="none meet"
            width=".03"
            height="1"
          />
          <feTile in="image_0" result="tile_0" />
          <feGaussianBlur stdDeviation=".0001" edgeMode="none" in="tile_0" result="bar_smoothness" x="0" y="0" />
          <feDisplacementMap
            scale=".03"
            xChannelSelector="R"
            yChannelSelector="G"
            in="SourceGraphic"
            in2="bar_smoothness"
            result="displacement_0"
          />
        </filter>
      </svg>
    </section>
  );
}

export default AuroraHero;
