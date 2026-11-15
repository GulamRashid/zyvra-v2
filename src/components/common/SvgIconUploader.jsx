import { useState, useRef } from 'react';
import { Upload, Link2, CheckCircle2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { uploadAsset } from '../../lib/storage';
import UploadGuide from './UploadGuide';
import ContentIcon from './ContentIcon';

export default function SvgIconUploader({
  value,
  onChange,
  label = 'Custom Course / Folder Icon',
  folder = 'icons'
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsUploading(true);
    try {
      const result = await uploadAsset(file, {
        folder,
        allowedExtensions: ['svg', 'png', 'webp'],
        maxSizeBytes: 300 * 1024 // 300 KB max for icons
      });
      onChange(result.url);
    } catch (err) {
      setError(err.message || 'Icon upload failed.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    onChange('');
    setError('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold dark:text-slate-300 text-slate-700 block">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
        >
          <Link2 size={12} />
          <span>{showUrlInput ? 'Switch to Upload' : 'Enter Direct URL'}</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Icon Preview */}
        <div className="w-14 h-14 rounded-2xl dark:bg-[#0F172A] bg-slate-100 border dark:border-slate-700/80 border-slate-300 flex items-center justify-center shrink-0 p-2 shadow-inner relative group">
          {value ? (
            <ContentIcon icon={value} className="w-9 h-9 object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400 font-bold uppercase text-center leading-none">
              No Icon
            </span>
          )}

          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              title="Remove Icon"
            >
              <X size={11} strokeWidth={3} />
            </button>
          )}
        </div>

        {/* Upload Button or Direct URL Input */}
        <div className="flex-1 min-w-0">
          {showUrlInput ? (
            <div className="space-y-1">
              <input
                type="text"
                placeholder="https://.../icon.svg or Lucide icon name"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-700 border-slate-300 text-xs font-medium dark:text-white text-slate-900 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] dark:text-slate-400 text-slate-500 block">
                Paste SVG image URL or Lucide icon name (e.g. GraduationCap, BookOpen).
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="svg-icon-upload-input"
              />
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Uploading SVG...</span>
                  </>
                ) : (
                  <>
                    <Upload size={13} />
                    <span>Upload Custom SVG</span>
                  </>
                )}
              </button>

              {value && (
                <span className="text-[11px] font-bold text-emerald-500 flex items-center gap-1 truncate">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="truncate">Active</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-center gap-1.5">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Guide Helper */}
      <UploadGuide
        formats=".svg (vector recommended), .png, .webp"
        dimensions="200×200 px (1:1 Square, transparent background)"
        maxSize="Max 100 KB for SVG, 300 KB for PNG"
        notes="SVGs scale crisply on high-DPI retina mobile and desktop screens."
      />
    </div>
  );
}
