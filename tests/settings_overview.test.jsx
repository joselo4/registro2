import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import SettingsOverview from '../src/components/admin/SettingsOverview.jsx';

test('los canales y el acceso a GA4 aparecen al inicio de ajustes', () => {
  const html = renderToStaticMarkup(<SettingsOverview config={{ open: true, tableOrdersEnabled: false, barOrdersEnabled: true, deliveryOrdersEnabled: false }} onChangeChannel={() => {}} onSave={() => {}} onOpenAnalytics={() => {}} />);
  assert.match(html, /Centro de configuración/i);
  assert.match(html, /Canales de venta/);
  assert.match(html, /1 activo/);
  assert.match(html, /Activar Mesas/);
  assert.match(html, /Activar Barra[^>]*checked/);
  assert.match(html, /Activar Delivery/);
  assert.match(html, /Guardar canales/);
  assert.match(html, /Ver embudo GA4/);
});
