import {
  BookOpen,
  GraduationCap,
  Landmark,
  Atom,
  Calculator,
  Globe2,
  Brain,
  ScrollText,
  FlaskConical,
  BookMarked,
  Folder,
  FolderOpen,
  FileText,
  Layers3,
  Trophy,
  Target,
  Rocket,
  Coins,
  Sparkles,
  Award,
  Zap,
  HelpCircle
} from 'lucide-react';

const ICON_MAP = {
  BookOpen,
  GraduationCap,
  Landmark,
  Atom,
  Calculator,
  Globe2,
  Brain,
  ScrollText,
  FlaskConical,
  BookMarked,
  Folder,
  FolderOpen,
  FileText,
  Layers3,
  Trophy,
  Target,
  Rocket,
  Coins,
  Sparkles,
  Award,
  Zap,
  HelpCircle
};

/**
 * Universal Content Icon: renders custom SVG URL, Lucide icon, or emoji cleanly.
 */
export default function ContentIcon({
  icon,
  className = 'w-5 h-5',
  size = 20,
  fallback: FallbackIcon = GraduationCap
}) {
  if (!icon) {
    return <FallbackIcon size={size} className={className} />;
  }

  const str = String(icon).trim();

  // 1. Direct SVG URL, HTTP(S) URL, or data URI
  const isUrl = /^https?:\/\//i.test(str) ||
    /^\//.test(str) ||
    /^data:image\//i.test(str) ||
    /\.(svg|png|webp|jpe?g)$/i.test(str);

  if (isUrl) {
    return (
      <img
        src={str}
        alt=""
        className={`${className} object-contain`}
        loading="lazy"
        onError={(e) => {
          // If image fails to load, replace with fallback
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // 2. Lucide Icon lookup
  const MatchedIcon = ICON_MAP[str];
  if (MatchedIcon) {
    return <MatchedIcon size={size} className={className} />;
  }

  // 3. Emoji detection
  if (/\p{Emoji}/u.test(str)) {
    return <span className={`inline-flex items-center justify-center ${className}`}>{str}</span>;
  }

  // 4. Default fallback
  return <FallbackIcon size={size} className={className} />;
}
