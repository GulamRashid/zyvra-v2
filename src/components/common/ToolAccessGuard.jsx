import { LockKeyhole } from 'lucide-react';

export default function ToolAccessGuard({ locked, price, validityDays, comboPrice, comboValidityDays, onBuyTool, onBuyCombo, children }) {
  return <div className={`tool-access-guard ${locked ? 'locked' : ''}`}>
    <div className="tool-access-content" aria-hidden={locked || undefined} inert={locked || undefined}>
      {children}
    </div>
    {locked && <div className="tool-access-overlay">
      <span className="tool-access-lock"><LockKeyhole size={21} /></span>
      <strong>Premium tool</strong>
      <p>Unlock this tool to continue using it.</p>
      <div className="tool-access-actions">
        <button type="button" className="button button-gold" onClick={onBuyTool} disabled={!price}>
          {price ? `Unlock Tool · ₹${Number(price).toLocaleString('en-IN')} / ${validityDays || 30} days` : 'Price unavailable'}
        </button>
        {comboPrice > 0 && <button type="button" className="button button-outline" onClick={onBuyCombo}>
          Get All Tools Combo · ₹{Number(comboPrice).toLocaleString('en-IN')} / {comboValidityDays || 30} days
        </button>}
      </div>
    </div>}
  </div>;
}
