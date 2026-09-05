import { useEffect, useRef, useState } from 'react';
import PromotionBanner from './PromotionBanner';
import { isPromotionVisible, normalizePromotion } from '../utils/promotion';

// Dismissal lasts for this page visit, including navigation to the cart and back.
const dismissedCampaigns = new Set();

export default function WelcomePromotion({ promotion, tableNumber, onAction, ready = true }) {
  const p = normalizePromotion(promotion);
  const campaignKey = JSON.stringify(p);
  const [now, setNow] = useState(Date.now);
  const [dismissed, setDismissed] = useState(() => dismissedCampaigns.has(campaignKey));
  const dialog = useRef(null);
  const visible = ready && p.showWelcome && isPromotionVisible(p, { tableNumber, now });
  useEffect(() => {
    setDismissed(dismissedCampaigns.has(campaignKey));
  }, [campaignKey]);
  useEffect(() => {
    if (!p.startsAt && !p.endsAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [p.startsAt, p.endsAt]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (visible && !dismissed && !element.open) element.showModal();
    if ((!visible || dismissed) && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [visible, dismissed]);
  const close = () => { dismissedCampaigns.add(campaignKey); setDismissed(true); };
  if (!visible) return null;
  return <>
    {dismissed && <button className="promotion-reopen" onClick={() => { dismissedCampaigns.delete(campaignKey); setDismissed(false); }}>Ver promoción <span aria-hidden="true">↗</span></button>}
    <dialog ref={dialog} className="promotion-dialog" aria-label={p.title || 'Promoción de bienvenida'} onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <button className="promotion-dialog-close" autoFocus aria-label="Cerrar promoción y ver la tienda" onClick={close}>×</button>
      <PromotionBanner promotion={p} tableNumber={tableNumber} onAction={action => { close(); onAction?.(action); }} />
      <button className="promotion-continue" onClick={close}>Seguir viendo la tienda →</button>
    </dialog>
  </>;
}
