import { LockKeyhole, Sparkles, X } from 'lucide-react';

export default function ToolUnlockModal({ title, price, validityDays, comboPrice, comboValidityDays, onBuy, onBuyCombo, onClose }) {
  return <div className="tool-unlock-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="tool-unlock-modal" role="dialog" aria-modal="true" aria-labelledby="tool-unlock-title">
      <button type="button" className="icon-button tool-unlock-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
      <span className="tool-unlock-icon"><LockKeyhole size={23} /></span>
      <div className="eyebrow">PREMIUM TOOL</div>
      <h2 id="tool-unlock-title">Unlock {title}</h2>
      <p>Get full access to this learning tool and continue your practice.</p>
      <button type="button" className="button button-gold" onClick={onBuy} disabled={!price}>
        {price ? `Buy now · ₹${Number(price).toLocaleString('en-IN')} / ${validityDays || 30} days` : 'Price unavailable'}
      </button>
      {comboPrice > 0 && <button type="button" className="button button-outline" onClick={onBuyCombo}>
        <Sparkles size={15} /> Get all tools · ₹{Number(comboPrice).toLocaleString('en-IN')} / {comboValidityDays || 30} days
      </button>}
    </section>
  </div>;
}
