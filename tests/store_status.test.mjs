import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHour, isShopOpenCurrently, storeStatus } from '../src/utils/storeHours.js';

// Lima is UTC-5 all year.
const lima = (iso) => new Date(`${iso}-05:00`);
const week = (open, close, days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) =>
  ({ open: true, useHours: true, hours: Object.fromEntries(days.map(day => [day, { enabled: true, open, close }])) });

test('times read the way customers in Peru say them', () => {
  assert.equal(formatHour('15:00'), '3:00 p. m.');
  assert.equal(formatHour('00:30'), '12:30 a. m.');
  assert.equal(formatHour('12:05'), '12:05 p. m.');
  assert.equal(formatHour('09:00'), '9:00 a. m.');
});

test('open stores say when they close', () => {
  const config = week('15:00', '21:00');
  assert.deepEqual(storeStatus(config, lima('2026-10-29T16:00:00')), { open: true, label: 'Abierto · cierra a las 9:00 p. m.' });
  assert.equal(storeStatus(config, lima('2026-10-29T16:00:00')).open, isShopOpenCurrently(config, lima('2026-10-29T16:00:00')));
});

test('closed stores say when they open next', () => {
  const config = week('15:00', '21:00');
  assert.equal(storeStatus(config, lima('2026-10-29T10:00:00')).label, 'Cerrado · abre hoy a las 3:00 p. m.');
  assert.equal(storeStatus(config, lima('2026-10-29T22:00:00')).label, 'Cerrado · abre mañana a las 3:00 p. m.');
  const weekdays = week('15:00', '21:00', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  // Friday night → Monday.
  assert.equal(storeStatus(weekdays, lima('2026-10-30T22:00:00')).label, 'Cerrado · abre el lunes a las 3:00 p. m.');
});

test('a shift past midnight still shows its closing time after midnight', () => {
  const config = week('18:00', '02:00');
  assert.equal(storeStatus(config, lima('2026-10-29T23:30:00')).label, 'Abierto · cierra a las 2:00 a. m.');
  assert.equal(storeStatus(config, lima('2026-10-30T01:00:00')).label, 'Abierto · cierra a las 2:00 a. m.');
  assert.equal(storeStatus(config, lima('2026-10-30T03:00:00')).label, 'Cerrado · abre hoy a las 6:00 p. m.');
});

test('manual switches and missing schedules', () => {
  assert.deepEqual(storeStatus({ open: false }), { open: false, label: 'Cerrado por ahora' });
  assert.deepEqual(storeStatus({ open: true, useHours: false }), { open: true, label: 'Abierto ahora' });
  assert.equal(storeStatus({ open: true, useHours: true, hours: {} }).label, 'Cerrado por ahora');
});
