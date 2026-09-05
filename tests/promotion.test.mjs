import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROMOTION, normalizePromotion, isPromotionVisible, safePromotionUrl, validatePromotion } from '../src/utils/promotion.js';

test('campaign starts and ends at the configured instant across timezone offsets', () => {
  const p = { startsAt: '2026-09-05T12:00:00-05:00', endsAt: '2026-09-05T14:00:00-05:00' };
  assert.equal(isPromotionVisible(p, { now: Date.parse('2026-09-05T16:59:59Z') }), false);
  assert.equal(isPromotionVisible(p, { now: Date.parse('2026-09-05T17:00:00Z') }), true);
  assert.equal(isPromotionVisible(p, { now: Date.parse('2026-09-05T19:00:00Z') }), false);
  assert.equal(normalizePromotion(p).startsAt, '2026-09-05T17:00:00.000Z');
});
test('disabled, blank and customer-specific campaigns are filtered', () => {
  assert.equal(isPromotionVisible({ enabled: false }), false);
  assert.equal(isPromotionVisible({ title: '  ' }), false);
  assert.equal(isPromotionVisible({ audience: 'table' }), false);
  assert.equal(isPromotionVisible({ audience: 'table' }, { tableNumber: '3' }), true);
  assert.equal(isPromotionVisible({ audience: 'delivery' }, { tableNumber: '3' }), false);
  assert.equal(isPromotionVisible({ audience: 'delivery' }), true);
});
test('banner rejects executable and protocol-relative destinations', () => {
  for (const url of ['javascript:alert(1)', '//evil.com', '/\\evil.com', 'data:text/html,<script>', 'http://example.com', 'java\nscript:alert(1)']) assert.equal(safePromotionUrl(url), '');
  assert.equal(safePromotionUrl('https://example.com/oferta'), 'https://example.com/oferta');
  assert.equal(safePromotionUrl('/ofertas'), '/ofertas');
  assert.equal(safePromotionUrl('#catalog'), '#catalog');
  assert.equal(safePromotionUrl('#catalog', { image: true }), '');
});
test('invalid campaigns are rejected before normalization can hide bad input', () => {
  assert.ok(validatePromotion({ ...DEFAULT_PROMOTION, startsAt: '2026-09-05T20:00Z', endsAt: '2026-09-05T18:00Z' }));
  assert.ok(validatePromotion({ ...DEFAULT_PROMOTION, action: 'link', link: 'javascript:alert(1)' }));
  assert.ok(validatePromotion({ ...DEFAULT_PROMOTION, image: 'broken link' }));
  assert.equal(validatePromotion(DEFAULT_PROMOTION), '');
  const p = normalizePromotion({ radius: 999, height: -1, background: 'url(evil)', titleSize: 100 });
  assert.equal(p.radius, 48); assert.equal(p.height, 180); assert.equal(p.titleSize, 64);
  assert.equal(p.background, DEFAULT_PROMOTION.background);
});
test('campaign survives settings serialization including explicit blank fields', () => {
  const settings = { open: false, promotion: { ...DEFAULT_PROMOTION, coupon: 'VERANO', image: '', buttonText: '', radius: 0 } };
  const restored = normalizePromotion(JSON.parse(JSON.stringify(settings)).promotion);
  assert.equal(restored.coupon, 'VERANO'); assert.equal(restored.image, ''); assert.equal(restored.buttonText, ''); assert.equal(restored.radius, 0);
});
