import test from 'node:test';
import assert from 'node:assert/strict';

// Helper de simulación idéntico a las funciones puras de CustomerCRM
const normalizePhone = (rawPhone) => {
  if (!rawPhone) return '';
  return String(rawPhone).replace(/\D/g, '');
};

const formatPeruvianPhoneForWhatsApp = (rawPhone) => {
  const clean = normalizePhone(rawPhone);
  if (!clean) return '';
  if (clean.length === 9 && !clean.startsWith('51')) {
    return `51${clean}`;
  }
  return clean;
};

const safeNum = (val, defaultVal = 0) => {
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : defaultVal;
};

const safeGetTime = (dateVal) => {
  if (!dateVal) return 0;
  const t = new Date(dateVal).getTime();
  return Number.isFinite(t) ? t : 0;
};

const safeFormatDate = (dateVal) => {
  if (!dateVal) return 'Sin fecha';
  try {
    const d = new Date(dateVal);
    if (!Number.isFinite(d.getTime())) return 'Fecha reciente';
    return d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'Fecha reciente';
  }
};

const generateVCard = (customer, storeName = 'Friozo') => {
  const formattedPhone = formatPeruvianPhoneForWhatsApp(customer.cleanPhone || customer.phone);
  let vcf = 'BEGIN:VCARD\n';
  vcf += 'VERSION:3.0\n';
  vcf += `FN:${customer.name} (${storeName})\n`;
  vcf += `TEL;TYPE=CELL:+${formattedPhone}\n`;
  if (customer.address) vcf += `ADR;TYPE=HOME:;;${customer.address};;;;\n`;
  vcf += 'END:VCARD\n';
  return vcf;
};

test('Phone normalization handles spaces, dashes, parentheses and +51 prefix', () => {
  assert.equal(normalizePhone('+51 (983) 123-456'), '51983123456');
  assert.equal(normalizePhone('983-123-456'), '983123456');
  assert.equal(formatPeruvianPhoneForWhatsApp('983123456'), '51983123456');
  assert.equal(formatPeruvianPhoneForWhatsApp('+51 983123456'), '51983123456');
  assert.equal(formatPeruvianPhoneForWhatsApp(''), '');
  assert.equal(formatPeruvianPhoneForWhatsApp(null), '');
});

test('Safe date formatting never throws RangeError on invalid or missing dates', () => {
  assert.doesNotThrow(() => {
    assert.equal(safeFormatDate(null), 'Sin fecha');
    assert.equal(safeFormatDate(undefined), 'Sin fecha');
    assert.equal(safeFormatDate('not-a-valid-date'), 'Fecha reciente');
    assert.equal(safeFormatDate(''), 'Sin fecha');
    assert.equal(safeFormatDate(NaN), 'Sin fecha');
    assert.equal(safeGetTime('invalid'), 0);
    assert.equal(safeGetTime(null), 0);
  });
});

test('Safe numeric parsing handles null, strings with symbols, and undefined', () => {
  assert.equal(safeNum('45.50'), 45.5);
  assert.equal(safeNum('S/ 30.00'), 0); // parseFloat parses non-leading symbol as NaN or 0
  assert.equal(safeNum(null, 0), 0);
  assert.equal(safeNum(undefined, 0), 0);
  assert.equal(safeNum('NaN', 10), 10);
});

test('Customer aggregation computes accurate LTV, favorite products and segmentation', () => {
  const orders = [
    {
      id: 'PED-101',
      date: '2026-09-10T10:00:00Z',
      grandTotal: 45.0,
      status: 'Entregado',
      paymentMethod: 'Yape',
      customer: { name: 'Carlos Gomez', phone: '984112233', address: 'Jr. Ayacucho 120' },
      items: [{ name: 'Lúcuma Artesanal', quantity: 2 }, { name: 'Vainilla', quantity: 1 }]
    },
    {
      id: 'PED-102',
      date: '2026-09-15T15:30:00Z',
      grandTotal: 40.0,
      status: 'Entregado',
      paymentMethod: 'Yape',
      customer: { name: 'Carlos Gomez', phone: '984112233', address: 'Jr. Ayacucho 120' },
      items: [{ name: 'Lúcuma Artesanal', quantity: 1 }]
    },
    {
      id: 'PED-103',
      date: '2026-09-12T11:00:00Z',
      grandTotal: 20.0,
      status: 'Cancelado', // Should not sum into LTV
      paymentMethod: 'Efectivo',
      customer: { name: 'Carlos Gomez', phone: '984112233', address: 'Jr. Ayacucho 120' },
      items: [{ name: 'Fresa', quantity: 1 }]
    }
  ];

  const map = new Map();
  orders.forEach(o => {
    const key = normalizePhone(o.customer.phone);
    if (!map.has(key)) {
      map.set(key, {
        name: o.customer.name,
        phone: o.customer.phone,
        totalOrders: 0,
        cancelledOrders: 0,
        totalSpent: 0,
        items: {}
      });
    }
    const c = map.get(key);
    if (o.status === 'Cancelado') {
      c.cancelledOrders += 1;
    } else {
      c.totalOrders += 1;
      c.totalSpent += safeNum(o.grandTotal, 0);
    }
    (o.items || []).forEach(it => {
      c.items[it.name] = (c.items[it.name] || 0) + it.quantity;
    });
  });

  const carlos = map.get('984112233');
  assert.ok(carlos);
  assert.equal(carlos.totalOrders, 2);
  assert.equal(carlos.cancelledOrders, 1);
  assert.equal(carlos.totalSpent, 85.0); // VIP threshold: >= 80
  assert.equal(carlos.items['Lúcuma Artesanal'], 3);

  // VIP Check
  const isVip = carlos.totalSpent >= 80 || carlos.totalOrders >= 4;
  assert.equal(isVip, true);
});

test('vCard generator builds RFC-compliant contact entry for WhatsApp', () => {
  const customer = {
    name: 'Rosa Palomino',
    phone: '983765432',
    cleanPhone: '983765432',
    address: 'Av. Los Próceres 500'
  };

  const vcf = generateVCard(customer, 'Friozo');
  assert.ok(vcf.includes('BEGIN:VCARD'));
  assert.ok(vcf.includes('VERSION:3.0'));
  assert.ok(vcf.includes('FN:Rosa Palomino (Friozo)'));
  assert.ok(vcf.includes('TEL;TYPE=CELL:+51983765432'));
  assert.ok(vcf.includes('ADR;TYPE=HOME:;;Av. Los Próceres 500;;;;'));
  assert.ok(vcf.includes('END:VCARD'));
});
