import { useEffect, useRef, useState } from 'react';
import PromotionBanner from './PromotionBanner';
import { isPromotionVisible, normalizePromotion, DEFAULT_POPUP_PROMOTION } from '../utils/promotion';
import { safeStorage } from '../utils/security';

// A closed campaign stays closed for 12 hours, so returning visitors can go
// straight to the menu instead of dismissing the same popup on every visit.
const dismissedCampaigns = new Set();
const DISMISSED_KEY = 'friozo_dismissed_promotions';
const DISMISS_FOR_MS = 12 * 60 * 60 * 1000;
const campaignId = key => {
  let hash = 0;
  for (let index = 0; index < key.length; index++) hash = (hash * 31 + key.charCodeAt(index)) | 0;
  return String(hash >>> 0);
};
const recentDismissals = (now = Date.now()) => Object.fromEntries(
  Object.entries(safeStorage.getJSON(DISMISSED_KEY, {})).filter(([, time]) => now - Number(time) < DISMISS_FOR_MS)
);
const wasDismissed = key => dismissedCampaigns.has(key) || Boolean(recentDismissals()[campaignId(key)]);
const rememberDismissal = key => {
  dismissedCampaigns.add(key);
  safeStorage.setJSON(DISMISSED_KEY, { ...recentDismissals(), [campaignId(key)]: Date.now() });
};

export default function WelcomePromotion({ promotion, tableNumber, onAction, ready = true }) {
  const p = normalizePromotion(promotion, DEFAULT_POPUP_PROMOTION);
  const campaignKey = JSON.stringify(p);
  const [now, setNow] = useState(Date.now);
  const [dismissed, setDismissed] = useState(() => wasDismissed(campaignKey));
  const dialog = useRef(null);
  const visible = ready && p.enabled && p.showWelcome !== false && isPromotionVisible(p, { tableNumber, now });

  useEffect(() => {
    setDismissed(wasDismissed(campaignKey));
  }, [campaignKey]);

  useEffect(() => {
    if (!p.startsAt && !p.endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [p.startsAt, p.endsAt]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (visible && !dismissed) {
      if (!element.open) {
        try {
          if (typeof element.showModal === 'function') {
            element.showModal();
          } else {
            element.setAttribute('open', '');
          }
        } catch {
          element.setAttribute('open', '');
        }
      }
    } else if (element.open) {
      try {
        if (typeof element.close === 'function') {
          element.close();
        } else {
          element.removeAttribute('open');
        }
      } catch {
        /* ignore */
      }
    }
  }, [visible, dismissed]);

  const close = () => {
    rememberDismissal(campaignKey);
    setDismissed(true);
  };

  if (!visible) return null;

  return <>
    {dismissed && <button className="promotion-reopen" onClick={() => { dismissedCampaigns.delete(campaignKey); setDismissed(false); }}><span aria-hidden="true">🎁</span> Ver promoción</button>}
    <dialog ref={dialog} className="promotion-dialog" aria-label={p.title || 'Promoción de bienvenida'} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <button className="promotion-dialog-close" autoFocus aria-label="Cerrar promoción y ver la tienda" onClick={close}>×</button>
      <PromotionBanner promotion={p} tableNumber={tableNumber} eager onAction={action => { close(); onAction?.(action); }} />
      <button className="promotion-continue" onClick={close}>Seguir viendo la tienda →</button>
    </dialog>
  </>;
}
