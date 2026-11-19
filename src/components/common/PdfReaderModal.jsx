import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Expand,
  Minimize,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  X,
  ExternalLink,
  Moon,
  Sun,
  Eye,
  EyeOff,
  RefreshCw,
  Compass,
  FileText,
  BookOpen
} from 'lucide-react';
import { formatDocumentEmbedUrl } from '../../lib/content';

/**
 * Enhanced In-App PDF & Study Notes Reader
 * - Responsive orientation adaptability (phone rotation portrait <-> landscape)
 * - True fullscreen API + 100dvh fallback
 * - Virtual 90° canvas rotation (0°, 90°, 180°, 270°)
 * - Dual Engine: Direct Streaming & Google Cloud Docs Viewer fallback
 * - Zoom & pan controls (50% to 200%)
 * - Night / Dark Study Mode, Sepia Warm Book Mode & Day Mode
 * - Zen / Distraction-free full-view reading mode
 * - Protected personal study watermarking & access rights
 */
export default function PdfReaderModal({ resource, url, onClose }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [readingTheme, setReadingTheme] = useState('light'); // 'light' | 'dark' | 'sepia'
  const [fullscreen, setFullscreen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [engine, setEngine] = useState('auto'); // 'auto' | 'gdocs' | 'direct'
  const [loading, setLoading] = useState(true);
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth > window.innerHeight;
    }
    return false;
  });
  const [toastMessage, setToastMessage] = useState('');

  const readerRef = useRef(null);
  const iframeRef = useRef(null);

  // Parse document URL and resolve embed & fallback URLs
  const docMeta = useMemo(() => formatDocumentEmbedUrl(url), [url]);

  // Determine active iframe source
  const activeUrl = useMemo(() => {
    if (docMeta.isGoogleDrive) {
      return docMeta.embedUrl;
    }
    if (engine === 'gdocs' && docMeta.googleDocsViewerUrl) {
      return docMeta.googleDocsViewerUrl;
    }
    if (engine === 'direct') {
      return docMeta.directUrl;
    }
    // Auto mode: For direct PDFs, native embed is tried first
    return docMeta.embedUrl || url;
  }, [docMeta, engine, url]);

  // Orientation listener
  useEffect(() => {
    const handleResize = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (fullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
      if ((event.ctrlKey || event.metaKey) && ['p', 's', 'c'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
      if (event.key === '+' || event.key === '=') {
        setZoom((z) => Math.min(200, z + 15));
      }
      if (event.key === '-') {
        setZoom((z) => Math.max(50, z - 15));
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen, onClose]);

  // Sync fullscreen state with document events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (readerRef.current?.requestFullscreen) {
          await readerRef.current.requestFullscreen();
        } else if (readerRef.current?.webkitRequestFullscreen) {
          await readerRef.current.webkitRequestFullscreen();
        }
        setFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
      // Fallback state toggle
      setFullscreen(!fullscreen);
    }
  };

  // Rotate screen / device orientation or virtual rotation
  const handleRotateToggle = async () => {
    try {
      if (window.screen?.orientation?.lock) {
        if (isLandscape) {
          await window.screen.orientation.lock('portrait').catch(() => {});
          showToast('📱 Switched to Portrait view');
        } else {
          await window.screen.orientation.lock('landscape').catch(() => {});
          showToast('🔄 Switched to Full-screen Landscape view');
        }
        return;
      }
    } catch {
      // Screen orientation lock not permitted in this context
    }

    // Virtual 90° canvas rotation
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    showToast(`🔄 Document Rotated ${nextRotation}°`);
  };

  const cycleTheme = () => {
    if (readingTheme === 'light') setReadingTheme('dark');
    else if (readingTheme === 'dark') setReadingTheme('sepia');
    else setReadingTheme('light');
  };

  // Compute CSS filter based on reading theme
  const getFilterStyle = () => {
    if (readingTheme === 'dark') {
      return {
        filter: 'invert(0.88) hue-rotate(180deg) contrast(1.05) brightness(0.95)'
      };
    }
    if (readingTheme === 'sepia') {
      return {
        filter: 'sepia(0.35) contrast(0.96) brightness(0.98)'
      };
    }
    return {};
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={readerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Document reader: ${resource?.title || 'Notes'}`}
        className="w-full h-full flex flex-col bg-slate-900 text-white select-none relative"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-slate-900/95 border border-indigo-500/50 text-indigo-200 text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Header / Toolbar */}
        {!zenMode && (
          <header className={`shrink-0 z-30 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 transition-all ${
            isLandscape ? 'min-h-[44px]' : 'min-h-[56px]'
          }`}>
            {/* Title & Badge */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-md" title={resource?.title}>
                  {resource?.title || 'Study Notes'}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  {resource?.page_count && <span>{resource.page_count} pages</span>}
                  {resource?.file_size && <span>• {resource.file_size}</span>}
                  <span className="text-emerald-400 font-semibold">• Personal Study Mode</span>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Zoom Controls (hidden on very small landscape if tight) */}
              <div className="hidden sm:flex items-center gap-0.5 bg-slate-800/80 rounded-xl p-1 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(50, z - 15))}
                  className="w-7 h-7 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(100)}
                  className="px-2 text-[11px] font-bold text-slate-300 hover:text-indigo-400 transition-colors"
                  title="Reset Zoom to 100%"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(200, z + 15))}
                  className="w-7 h-7 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Rotate Document / Screen */}
              <button
                type="button"
                onClick={handleRotateToggle}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-400 flex items-center justify-center transition-all active:scale-95"
                title="Rotate Screen / Document 90° (Screen ghumayein)"
                aria-label="Rotate Screen"
              >
                <RotateCw size={15} />
              </button>

              {/* Theme Toggle (Day / Night / Sepia) */}
              <button
                type="button"
                onClick={cycleTheme}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-indigo-400 flex items-center justify-center transition-all active:scale-95"
                title={`Reading Mode: ${readingTheme.toUpperCase()} (Click to toggle Night / Sepia / Day)`}
                aria-label="Toggle Reading Theme"
              >
                {readingTheme === 'dark' ? (
                  <Moon size={15} className="text-indigo-400" />
                ) : readingTheme === 'sepia' ? (
                  <BookOpen size={15} className="text-amber-400" />
                ) : (
                  <Sun size={15} className="text-amber-300" />
                )}
              </button>

              {/* Engine Switcher (Only if non-Google-Drive PDF) */}
              {!docMeta.isGoogleDrive && (
                <button
                  type="button"
                  onClick={() => {
                    const next = engine === 'gdocs' ? 'direct' : 'gdocs';
                    setEngine(next);
                    showToast(next === 'gdocs' ? 'Switched to Google Cloud Docs Viewer' : 'Switched to Native PDF Stream');
                  }}
                  className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                    engine === 'gdocs'
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title="Switch PDF Viewer Engine"
                >
                  <RefreshCw size={12} />
                  <span>{engine === 'gdocs' ? 'Cloud Viewer' : 'Direct'}</span>
                </button>
              )}

              {/* Zen Mode / Distraction Free */}
              <button
                type="button"
                onClick={() => {
                  setZenMode(true);
                  showToast('Zen Reading Mode active. Tap the icon to restore toolbar.');
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-emerald-400 flex items-center justify-center transition-all active:scale-95"
                title="Zen Mode (Hide toolbar for distraction-free study)"
                aria-label="Zen Mode"
              >
                <EyeOff size={15} />
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-95"
                title={fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                aria-label={fullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                {fullscreen ? <Minimize size={15} /> : <Expand size={15} />}
              </button>

              {/* Download if allowed */}
              {resource?.is_downloadable && (
                <a
                  href={docMeta.directUrl || url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
                  title="Download Document"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 hover:text-white flex items-center justify-center transition-all active:scale-95 ml-1"
                title="Close Reader (Esc)"
                aria-label="Close Reader"
              >
                <X size={16} />
              </button>
            </div>
          </header>
        )}

        {/* Zen Mode Floating Restore Button */}
        {zenMode && (
          <div className="absolute top-3 right-3 z-40 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZenMode(false)}
              className="px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700 text-xs font-semibold shadow-xl flex items-center gap-1.5 backdrop-blur-md transition-all active:scale-95"
            >
              <Eye size={13} />
              <span>Show Controls</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center shadow-xl backdrop-blur-md transition-all active:scale-95"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Landscape advice pill on initial portrait mobile */}
        {!isLandscape && !zenMode && (
          <div className="sm:hidden px-3 py-1.5 bg-indigo-950/80 border-b border-indigo-900/50 flex items-center justify-between text-[11px] text-indigo-300">
            <span className="flex items-center gap-1.5 truncate">
              <span>💡</span>
              <span>Screen rotate karein for full-screen landscape view!</span>
            </span>
            <button
              type="button"
              onClick={handleRotateToggle}
              className="font-bold underline text-amber-300 shrink-0 ml-2"
            >
              Rotate Now ↻
            </button>
          </div>
        )}

        {/* PDF Reader Canvas Area */}
        <div
          className="relative flex-1 w-full h-full overflow-auto bg-slate-950 flex items-center justify-center p-0"
          style={{
            backgroundColor: readingTheme === 'dark' ? '#090d16' : readingTheme === 'sepia' ? '#f4ecd8' : '#0f172a'
          }}
        >
          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs text-center p-4">
              <RefreshCw size={28} className="animate-spin text-indigo-400 mb-3" />
              <p className="text-sm font-bold text-white mb-1">Loading Document…</p>
              <p className="text-xs text-slate-400 max-w-xs">{resource?.title}</p>
            </div>
          )}

          {/* Document Frame Container with Zoom & Rotation */}
          <div
            className="w-full h-full transition-transform duration-200 origin-center flex items-center justify-center"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              width: rotation % 180 === 90 ? '100vh' : '100%',
              height: rotation % 180 === 90 ? '100vw' : '100%',
              ...getFilterStyle()
            }}
          >
            <iframe
              ref={iframeRef}
              title={resource?.title || 'Study Document'}
              src={activeUrl}
              onLoad={() => setLoading(false)}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
              allow="autoplay; fullscreen"
              loading="lazy"
            />
          </div>
        </div>

        {/* Bottom Status & Fallback Bar */}
        {!zenMode && (
          <footer className="shrink-0 px-3 py-1.5 sm:py-2 border-t border-slate-800 bg-slate-900/90 backdrop-blur-xs flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {readingTheme === 'dark' ? '🌙 Night Mode' : readingTheme === 'sepia' ? '📜 Sepia Eye-Care' : '☀️ Day Mode'}
                {rotation !== 0 ? ` • ${rotation}°` : ''}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Fallback to open external tab if browser restricts embed */}
              <a
                href={docMeta.directUrl || url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-indigo-400 flex items-center gap-1 transition-colors"
                title="Open in new window"
              >
                <span>Direct Open</span>
                <ExternalLink size={11} />
              </a>

              <span className="hidden sm:inline text-slate-500">
                Zyvra Secure Reader
              </span>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
