import { useEffect, useRef, useState } from 'react';
import { Download, Expand, Minimize, Minus, Plus, RotateCcw, X } from 'lucide-react';

export default function PdfReaderModal({ resource, url, onClose }) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const readerRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if ((event.ctrlKey || event.metaKey) && ['p', 's', 'c'].includes(event.key.toLowerCase())) event.preventDefault();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await readerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  };

  return <div className="pdf-reader-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="pdf-reader" role="dialog" aria-modal="true" aria-label={`Document reader: ${resource.title}`} ref={readerRef} onContextMenu={(event) => event.preventDefault()}>
      <header className="pdf-reader-header">
        <div className="pdf-reader-title"><span className="pdf-reader-badge">PDF</span><div><strong>{resource.title}</strong><small>{resource.page_count ? `${resource.page_count} pages` : 'Study document'}</small></div></div>
        <div className="pdf-reader-controls">
          <button type="button" className="icon-button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(50, value - 10))}><Minus size={17} /></button>
          <span className="pdf-zoom">{zoom}%</span>
          <button type="button" className="icon-button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(160, value + 10))}><Plus size={17} /></button>
          <button type="button" className="icon-button" aria-label="Reset zoom" onClick={() => setZoom(100)}><RotateCcw size={16} /></button>
          <button type="button" className="icon-button" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17} /> : <Expand size={17} />}</button>
          {resource.is_downloadable && <a className="button button-gold pdf-download" href={url} download><Download size={15} /> Download</a>}
          <button type="button" className="icon-button" aria-label="Close reader" onClick={onClose}><X size={18} /></button>
        </div>
      </header>
      <div className="pdf-reader-frame" style={{ '--pdf-zoom': zoom / 100 }} onCopy={(event) => event.preventDefault()}>
        <iframe title={resource.title} src={url} sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />
      </div>
      <div className="pdf-reader-footnote">For personal study use. Document access is enforced by your account permissions.</div>
    </section>
  </div>;
}
