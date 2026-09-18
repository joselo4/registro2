/**
 * Generador de tickets para comandas de cocina, despacho de delivery y cierres Z.
 * Optimizado para impresoras térmicas de 58mm y 80mm (ESC/POS).
 */

export const printThermalTicket = ({
  type = 'comanda', // 'comanda' | 'delivery' | 'cierre_z'
  order = null,
  shift = null,
  settlement = null,
  storeName = 'Friozo',
  storePhone = '',
  ticketCustomMessage = ''
}) => {
  if (typeof window === 'undefined') return;

  const nowStr = new Date().toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let contentHtml = '';

  if (type === 'comanda' || type === 'delivery') {
    if (!order) return;
    const isDelivery = order.customer?.orderType === 'Delivery' || (order.deliveryFee > 0);
    const isTable = order.customer?.orderType === 'Mesa' || order.customer?.tableNumber;

    contentHtml = `
      <div class="ticket">
        <div class="center bold title">${storeName.toUpperCase()}</div>
        <div class="center subtitle">${type === 'comanda' ? '🍳 COMANDA DE COCINA' : '🛵 TICKET DE DESPACHO'}</div>
        <div class="divider"></div>
        <div class="row"><span>ORDEN:</span> <b class="highlight">${order.id}</b></div>
        <div class="row"><span>FECHA:</span> <span>${nowStr}</span></div>
        <div class="row">
          <span>TIPO:</span> 
          <b class="type-badge ${isDelivery ? 'delivery' : isTable ? 'mesa' : 'llevar'}">
            ${isDelivery ? '🛵 DELIVERY' : isTable ? `🍽️ MESA ${order.customer?.tableNumber || ''}` : '🥡 PARA LLEVAR'}
          </b>
        </div>
        ${order.assignedDriver?.name ? `<div class="row"><span>REPARTIDOR:</span> <b>${order.assignedDriver.name}</b></div>` : ''}
        <div class="divider"></div>
        <div class="bold section-title">CLIENTE:</div>
        <div><b>${order.customer?.name || 'Cliente'}</b></div>
        ${order.customer?.phone ? `<div>Tel: ${order.customer.phone}</div>` : ''}
        ${isDelivery && order.customer?.address ? `<div class="address"><b>Dirección:</b> ${order.customer.address}</div>` : ''}
        ${order.customer?.reference ? `<div>Ref: ${order.customer.reference}</div>` : ''}
        <div class="divider"></div>
        <div class="bold section-title">PRODUCTOS:</div>
        ${(order.items || []).map((item) => {
          let desc = '';
          if (item.type === 'custom') {
            const scoops = (item.scoops || []).map(s => s.name).join(', ');
            const toppings = (item.toppings || []).map(t => t.name).join(', ');
            desc = `Sabores: ${scoops}${toppings ? ` | Top: ${toppings}` : ''}`;
          } else if (item.type === 'pack') {
            desc = `Pack: ${item.items || ''}`;
          } else if (item.type === 'liter') {
            const flavors = (item.flavors || []).map(f => f.name).join(', ');
            desc = `Sabores: ${flavors}`;
          }
          return `
            <div class="item-row">
              <span class="qty">${item.quantity || 1}x</span>
              <span class="item-name">${item.name || 'Helado'}</span>
              <span class="price">S/ ${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
            </div>
            ${desc ? `<div class="item-desc">${desc}</div>` : ''}
          `;
        }).join('')}
        <div class="divider"></div>
        <div class="row"><span>Subtotal:</span> <span>S/ ${(order.subtotal || 0).toFixed(2)}</span></div>
        ${order.deliveryFee > 0 ? `<div class="row"><span>Delivery:</span> <span>S/ ${order.deliveryFee.toFixed(2)}</span></div>` : ''}
        ${order.discount > 0 ? `<div class="row"><span>Descuento:</span> <span>-S/ ${order.discount.toFixed(2)}</span></div>` : ''}
        <div class="row total"><span>TOTAL:</span> <span>S/ ${(order.grandTotal || 0).toFixed(2)}</span></div>
        <div class="row"><span>PAGO:</span> <b>${order.paymentMethod || 'Efectivo'}</b></div>
        ${order.customer?.paymentProof ? `<div class="center" style="margin-top:4px; font-size:10px;">(Pago verificado con captura)</div>` : ''}
        ${order.notes ? `<div class="divider"></div><div class="notes"><b>Notas:</b> ${order.notes}</div>` : ''}
        ${ticketCustomMessage ? `<div class="divider"></div><div class="center footer">${ticketCustomMessage}</div>` : ''}
        <div class="divider"></div>
        <div class="center footer">¡Gracias por tu preferencia! 🍦</div>
      </div>
    `;
  } else if (type === 'cierre_z') {
    if (!shift) return;
    contentHtml = `
      <div class="ticket">
        <div class="center bold title">${storeName.toUpperCase()}</div>
        <div class="center subtitle">📋 REPORTE DE CIERRE DE CAJA (Z)</div>
        <div class="divider"></div>
        <div class="row"><span>TURNO ID:</span> <b>${shift.id || 'Z-001'}</b></div>
        <div class="row"><span>FECHA/HORA:</span> <span>${nowStr}</span></div>
        <div class="row"><span>CAJERO:</span> <b>${shift.cashierName || 'Caja'}</b></div>
        <div class="divider"></div>
        <div class="row"><span>FONDO INICIAL:</span> <b>S/ ${(shift.startingCash || 0).toFixed(2)}</b></div>
        <div class="row"><span>VENTAS EFECTIVO:</span> <span>+S/ ${(shift.cashSales || 0).toFixed(2)}</span></div>
        <div class="row"><span>INGRESOS EXTRA:</span> <span>+S/ ${(shift.cashIn || 0).toFixed(2)}</span></div>
        <div class="row"><span>RETIROS / GASTOS:</span> <span>-S/ ${(shift.cashOut || 0).toFixed(2)}</span></div>
        <div class="divider"></div>
        <div class="row total"><span>EFECTIVO ESPERADO:</span> <span>S/ ${(shift.expectedCash || 0).toFixed(2)}</span></div>
        <div class="row total"><span>EFECTIVO REAL:</span> <span>S/ ${(shift.actualCash || 0).toFixed(2)}</span></div>
        <div class="row" style="color: ${shift.difference >= 0 ? '#27ae60' : '#c0392b'}; font-weight: bold;">
          <span>DIFERENCIA:</span> 
          <span>${shift.difference >= 0 ? `+S/ ${shift.difference.toFixed(2)}` : `-S/ ${Math.abs(shift.difference).toFixed(2)}`}</span>
        </div>
        <div class="divider"></div>
        <div class="bold section-title">PAGOS DIGITALES (NO EFECTIVO):</div>
        <div class="row"><span>Yape / Plin:</span> <span>S/ ${(shift.yapeSales || 0).toFixed(2)}</span></div>
        <div class="row"><span>Tarjetas / POS:</span> <span>S/ ${(shift.cardSales || 0).toFixed(2)}</span></div>
        <div class="row"><span>Transferencias:</span> <span>S/ ${(shift.transferSales || 0).toFixed(2)}</span></div>
        <div class="divider"></div>
        <div class="row total"><span>TOTAL VENTAS DEL TURNO:</span> <span>S/ ${(shift.totalTurnover || 0).toFixed(2)}</span></div>
        <div class="row"><span>PEDIDOS ATENDIDOS:</span> <span>${shift.ordersCount || 0}</span></div>
        <div class="divider"></div>
        <div class="center footer">FIRMA CAJERO / RESPONSABLE</div>
        <br/><br/>
        <div class="center">_________________________________</div>
      </div>
    `;
  } else if (type === 'cart_settlement') {
    if (!settlement) return;
    contentHtml = `
      <div class="ticket">
        <div class="center bold title">${storeName.toUpperCase()}</div>
        <div class="center subtitle">🍦 LIQUIDACIÓN DIARIA DE CARRITO</div>
        <div class="divider"></div>
        <div class="row"><span>LIQ ID:</span> <b>${settlement.id || 'LIQ-001'}</b></div>
        <div class="row"><span>FECHA/HORA:</span> <span>${nowStr}</span></div>
        <div class="row"><span>CARRITO:</span> <b>${settlement.cartLabel || 'Carrito'}</b></div>
        <div class="row"><span>VENDEDOR:</span> <b>${settlement.vendorName || 'Vendedor'}</b></div>
        ${settlement.routeName ? `<div class="row"><span>RUTA:</span> <span>${settlement.routeName}</span></div>` : ''}
        <div class="divider"></div>
        <div class="bold section-title">DETALLE CARGA VS RETORNO:</div>
        <div class="row bold" style="font-size:10px; border-bottom:1px dashed #000; padding-bottom:3px; margin-bottom:4px;">
          <span>ITEM</span>
          <span>CRG/RET/VND</span>
          <span>SUBTOTAL</span>
        </div>
        ${(settlement.details || []).map(d => `
          <div class="row" style="font-size:10.5px; padding:2px 0;">
            <span style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${d.name} (S/${Number(d.price).toFixed(2)})</span>
            <span>${d.loaded}/${d.returned}/<b>${d.sold}</b></span>
            <b>S/${Number(d.subtotal).toFixed(2)}</b>
          </div>
        `).join('')}
        <div class="divider"></div>
        <div class="row total"><span>TOTAL UNIDADES VENDIDAS:</span> <b>${settlement.totalUnits || 0} u.</b></div>
        <div class="row total"><span>TOTAL A RENDIR:</span> <b>S/ ${(settlement.totalAmount || 0).toFixed(2)}</b></div>
        ${settlement.paymentDetails ? `
          <div class="divider"></div>
          <div class="row"><span>Efectivo entregado:</span> <span>S/ ${(settlement.paymentDetails.cash || 0).toFixed(2)}</span></div>
          <div class="row"><span>Yape / Plin rendido:</span> <span>S/ ${(settlement.paymentDetails.yape || 0).toFixed(2)}</span></div>
          <div class="row" style="font-weight:bold; color:${(settlement.paymentDetails.diff || 0) >= 0 ? '#27ae60' : '#c0392b'};">
            <span>Diferencia:</span> <span>${(settlement.paymentDetails.diff || 0) >= 0 ? `+S/ ${(settlement.paymentDetails.diff || 0).toFixed(2)}` : `-S/ ${Math.abs(settlement.paymentDetails.diff || 0).toFixed(2)}`}</span>
          </div>
        ` : ''}
        ${settlement.notes ? `<div class="divider"></div><div class="notes"><b>Obs:</b> ${settlement.notes}</div>` : ''}
        <div class="divider"></div>
        <div class="center footer" style="font-size:9.5px;">FIRMA VENDEDOR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; FIRMA SUPERVISOR</div>
        <br/><br/>
        <div class="center">______________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ______________</div>
      </div>
    `;
  }

  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) {
    window.alert('Habilita las ventanas emergentes (popups) para imprimir el ticket térmico.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Ticket ${type.toUpperCase()}</title>
        <style>
          @page {
            margin: 0;
            size: 58mm auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.35;
            margin: 0;
            padding: 8px 6px;
            color: #000;
            background: #fff;
            width: 58mm;
            box-sizing: border-box;
          }
          .ticket { width: 100%; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 15px; margin-bottom: 2px; }
          .subtitle { font-size: 11px; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .total { font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 2px 0; margin: 4px 0; }
          .highlight { font-size: 13px; font-weight: bold; }
          .section-title { font-size: 11px; margin: 4px 0 2px; }
          .item-row { display: flex; justify-content: space-between; font-weight: bold; margin-top: 3px; }
          .item-desc { font-size: 10px; color: #333; margin-bottom: 2px; padding-left: 10px; }
          .qty { width: 22px; }
          .item-name { flex: 1; padding: 0 4px; word-break: break-word; }
          .price { text-align: right; white-space: nowrap; }
          .address { font-size: 11px; margin: 2px 0; word-break: break-word; }
          .notes { font-size: 11px; background: #eee; padding: 3px; margin: 3px 0; }
          .footer { font-size: 10px; margin-top: 6px; }
          .type-badge { padding: 1px 4px; border-radius: 3px; }
          .delivery { color: #d35400; }
          .mesa { color: #2980b9; }
          .llevar { color: #8e44ad; }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 800);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
