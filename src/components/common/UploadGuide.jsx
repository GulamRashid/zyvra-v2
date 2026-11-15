import { Info } from 'lucide-react';

/**
 * Reusable Upload Guide helper caption/box
 * 
 * @param {Object} props
 * @param {string} [props.formats] - e.g. ".svg (recommended), .png, .webp"
 * @param {string} [props.dimensions] - e.g. "200×200 px (1:1 Square), transparent background"
 * @param {string} [props.maxSize] - e.g. "100 KB for SVG, 300 KB for PNG/WebP"
 * @param {string} [props.notes] - Optional extra note
 * @param {string} [props.className] - Optional custom styling
 */
export default function UploadGuide({
  formats = '.svg (recommended), .png, .webp',
  dimensions = '200×200 px (1:1 Square)',
  maxSize = 'Max 100 KB for SVG, 300 KB for PNG',
  notes,
  className = ''
}) {
  return (
    <div
      className={`rounded-xl p-2.5 sm:p-3 text-[11px] leading-relaxed dark:bg-[#0F172A]/80 bg-slate-50 border dark:border-slate-700/60 border-slate-200 text-slate-600 dark:text-slate-400 space-y-1.5 transition-colors ${className}`}
    >
      <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 text-xs">
        <Info size={13} className="shrink-0" />
        <span>Upload Guidelines</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-0.5 text-[10px] sm:text-[11px]">
        <div>
          <span className="font-semibold text-slate-700 dark:text-slate-300 block">Allowed Formats:</span>
          <span className="font-mono text-slate-600 dark:text-slate-400">{formats}</span>
        </div>
        {dimensions && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">Recommended Ratio:</span>
            <span>{dimensions}</span>
          </div>
        )}
        {maxSize && (
          <div>
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">Max File Size:</span>
            <span className="text-amber-600 dark:text-amber-400 font-semibold">{maxSize}</span>
          </div>
        )}
      </div>

      {notes && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t dark:border-slate-800 border-slate-200">
          💡 {notes}
        </div>
      )}
    </div>
  );
}
