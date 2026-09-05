import { useEffect, useState } from 'react';
import { isPromotionVisible, normalizePromotion } from '../utils/promotion';
import './promotion.css';

export default function PromotionBanner({ promotion, tableNumber, onAction, preview = false }) {
  const [now, setNow] = useState(Date.now);
  const [failedImage, setFailedImage] = useState('');
  const p = normalizePromotion(promotion);
  useEffect(() => {
    if (preview || (!p.startsAt && !p.endsAt)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [preview, p.startsAt, p.endsAt]);
  if (!preview && !isPromotionVisible(p, { tableNumber, now })) return null;
  const hasImage = p.layout !== 'text-only' && p.image && failedImage !== p.image;
  return (
    <section className={`promotion-banner ${p.layout} ${hasImage ? 'has-image' : 'no-image'}`} aria-label="Promoción destacada" style={{
      '--promo-bg': p.background, '--promo-text': p.textColor,
      '--promo-button': p.buttonColor, '--promo-button-text': p.buttonTextColor,
      '--promo-title-size': `${p.titleSize}px`, '--promo-height': `${p.height}px`, '--promo-radius': `${p.radius}px`,
    }}>
      <div className="promotion-copy">
        {p.eyebrow && <span className="promotion-eyebrow">{p.eyebrow}</span>}
        <h2>{p.title}</h2>
        {p.description && <p>{p.description}</p>}
        <div className="promotion-actions">
          {p.buttonText && (p.action === 'link' && p.link
            ? <a className="promotion-button" href={preview ? undefined : p.link} aria-disabled={preview || undefined}>{p.buttonText} <span aria-hidden="true">↗</span></a>
            : <button type="button" className="promotion-button" disabled={preview} onClick={() => onAction?.(p.action)}>{p.buttonText} <span aria-hidden="true">→</span></button>)}
          {p.coupon && <span className="promotion-coupon">Código: <strong>{p.coupon}</strong></span>}
        </div>
        {p.terms && <small className="promotion-terms">{p.terms}</small>}
      </div>
      {hasImage && <div className="promotion-image"><img src={p.image} alt={p.imageAlt} loading="lazy" decoding="async" style={{ objectFit: p.imageFit }} onError={() => setFailedImage(p.image)} /></div>}
    </section>
  );
}
