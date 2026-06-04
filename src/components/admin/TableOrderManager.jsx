import React, { useState, useEffect, useRef } from 'react';
import { updateSyncedData } from '../../utils/supabaseSync';
import { generateOrderId } from '../../utils/orderId';

export default function TableOrderManager({
  orders,
  onUpdateOrders,
  flavors,
  toppings,
  bases,
  packs,
  literConfig,
  waiterTakerEnabled,
  addLog,
  currentUser,
  showAlert,
  tableCalls = [],
  shopConfig
}) {
  const [selectedTable, setSelectedTable] = useState(null);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [selectedBarraOrderId, setSelectedBarraOrderId] = useState(null);
  const [newOrderType, setNewOrderType] = useState('Mesa'); // Mesa, Mesa_Llevar, Barra

  // Campos para nuevo pedido
  const [newOrderClient, setNewOrderClient] = useState('');
  const [newOrderPhone, setNewOrderPhone] = useState('');
  const [newOrderItems, setNewOrderItems] = useState([]);
  
  // Elementos del catálogo para el mozo
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // all, flavors, packs, liters

  // Estado para armar helado personalizado
  const [customScoopsCount, setCustomScoopsCount] = useState(1);
  const [selectedScoops, setSelectedScoops] = useState([]);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const selectedBase = bases?.[0] || { id: 'cono', name: 'Cono de Galleta', price: 0.0 };
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Estado para armar litro
  const [literScoops, setLiterScoops] = useState([]);
  const [showLiterCustomizer, setShowLiterCustomizer] = useState(false);

  // Método de pago para cierre de mesa
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('Yape');
  const [showCheckoutSection, setShowCheckoutSection] = useState(false);

  const totalTables = shopConfig?.totalTables || 12;

  const alert = (msg, type = 'info') => {
    if (showAlert) {
      showAlert(type === 'error' ? 'Atención' : 'Éxito', msg, type === 'error' ? 'warning' : 'success');
    } else {
      window.alert(msg);
    }
  };

  const playCallSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn("AudioContext failed to start.", e);
    }
  };

  const activeCallsCount = useRef(tableCalls.filter(c => !c.resolved).length);

  useEffect(() => {
    const currentActive = tableCalls.filter(c => !c.resolved).length;
    if (currentActive > activeCallsCount.current) {
      playCallSound();
    }
    activeCallsCount.current = currentActive;
  }, [tableCalls]);

  const handleResolveCall = async (call) => {
    const updatedCall = {
      ...call,
      resolved: true
    };
    await updateSyncedData(`order_call_Mesa_${call.table}`, updatedCall);
    addLog(`Llamado de Mesa ${call.table} ("${call.request}") marcado como atendido por ${currentUser?.name || 'Personal'}.`);
  };

  // Encontrar el pedido activo de una mesa
  const getActiveTableOrder = (tableNum) => {
    return orders.find(
      o => (o.customer?.orderType === 'Mesa' || o.customer?.orderType === 'Mesa_Llevar') && 
           String(o.customer?.tableNumber) === String(tableNum) && 
           o.status !== 'Cancelado' && 
           !o.tablePaid
    );
  };

  // Agregar item al pedido local temporal (para nueva mesa) o directo a la mesa activa
  const handleAddItemToOrder = (item) => {
    if (selectedTable) {
      const activeOrder = selectedTable === 'Barra'
        ? orders.find(o => o.id === selectedBarraOrderId && o.customer?.orderType === 'Barra' && o.status !== 'Cancelado' && !o.tablePaid)
        : getActiveTableOrder(selectedTable);

      if (activeOrder) {
        // Añadir a pedido existente en la base de datos
        const updatedItems = [...activeOrder.items];
        const existingIdx = updatedItems.findIndex(i => i.name === item.name && i.type === item.type);
        if (existingIdx !== -1) {
          updatedItems[existingIdx].quantity += 1;
        } else {
          updatedItems.push(item);
        }

        const newSubtotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        
        // Mantener descuento si se usó cupón
        let discount = 0;
        if (activeOrder.couponCode) {
          const discountPct = activeOrder.total > 0 ? (activeOrder.discount / activeOrder.total) : 0;
          discount = newSubtotal * discountPct;
        }

        const updatedOrders = orders.map(o => {
          if (o.id === activeOrder.id) {
            const orderVal = {
              ...o,
              items: updatedItems,
              total: newSubtotal,
              discount: discount,
              grandTotal: Math.max(0, newSubtotal - discount)
            };
            updateSyncedData(`order_${o.id}`, orderVal);
            return orderVal;
          }
          return o;
        });

        onUpdateOrders(updatedOrders);
        const nameType = selectedTable === 'Barra' ? 'Barra' : `Mesa ${selectedTable}`;
        addLog(`Mozo ${currentUser?.name || ''} agregó ${item.name} a ${nameType}.`);
        alert(`Se agregó ${item.name} a ${nameType}.`);
      } else {
        // Agregar a la cola temporal de nueva mesa
        setNewOrderItems(prev => {
          const existingIdx = prev.findIndex(i => i.name === item.name && i.type === item.type);
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx].quantity += 1;
            return updated;
          }
          return [...prev, item];
        });
      }
    }
  };

  const handleUpdateActiveOrderItemQty = (activeOrder, itemIndex, delta) => {
    let updatedItems = activeOrder.items.map((item, idx) => {
      if (idx === itemIndex) {
        const newQty = item.quantity + delta;
        return { ...item, quantity: Math.max(1, newQty) };
      }
      return item;
    });

    const subtotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    let discount = 0;
    if (activeOrder.couponCode) {
      const discountPct = activeOrder.total > 0 ? (activeOrder.discount / activeOrder.total) : 0;
      discount = subtotal * discountPct;
    }

    const updatedOrders = orders.map(o => {
      if (o.id === activeOrder.id) {
        const orderVal = {
          ...o,
          items: updatedItems,
          total: subtotal,
          discount: discount,
          grandTotal: Math.max(0, subtotal - discount)
        };
        // También subirlo individualmente si es en la nube
        updateSyncedData(`order_${o.id}`, orderVal);
        return orderVal;
      }
      return o;
    });

    onUpdateOrders(updatedOrders);
  };

  const handleRemoveActiveOrderItem = (activeOrder, itemIndex) => {
    const updatedItems = activeOrder.items.filter((_, idx) => idx !== itemIndex);
    
    if (updatedItems.length === 0) {
      alert("El pedido no puede quedar vacío. Si deseas cancelarlo, usa el botón Cancelar.", 'error');
      return;
    }

    const subtotal = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    
    let discount = 0;
    if (activeOrder.couponCode) {
      const discountPct = activeOrder.total > 0 ? (activeOrder.discount / activeOrder.total) : 0;
      discount = subtotal * discountPct;
    }

    const updatedOrders = orders.map(o => {
      if (o.id === activeOrder.id) {
        const orderVal = {
          ...o,
          items: updatedItems,
          total: subtotal,
          discount: discount,
          grandTotal: Math.max(0, subtotal - discount)
        };
        updateSyncedData(`order_${o.id}`, orderVal);
        return orderVal;
      }
      return o;
    });

    onUpdateOrders(updatedOrders);
  };

  const handleCorroborarOrder = (activeOrder) => {
    const updatedOrders = orders.map(o => {
      if (o.id === activeOrder.id) {
        const history = o.statusHistory || [];
        const orderVal = {
          ...o,
          status: 'Pendiente',
          statusHistory: [...history, { status: 'Pendiente', timestamp: new Date().toISOString() }]
        };
        updateSyncedData(`order_${o.id}`, orderVal);
        return orderVal;
      }
      return o;
    });

    onUpdateOrders(updatedOrders);
    addLog(`Pedido ${activeOrder.id} de Mesa ${selectedTable} corroborado por ${currentUser?.name || 'Personal'}.`);
    alert(`Pedido ${activeOrder.id} corroborado y enviado a preparación.`);
  };

  // Crear nuevo pedido de mesa
  const handleCreateOrderSubmit = (e) => {
    e.preventDefault();
    if (!selectedTable) return;
    if (newOrderItems.length === 0) {
      alert("Debes agregar al menos un producto al pedido.", 'error');
      return;
    }

    const orderId = generateOrderId();
    const isBarra = selectedTable === 'Barra';
    const finalClient = newOrderClient.trim() || (isBarra ? `Barra` : `Mesa ${selectedTable}`);
    const subtotal = newOrderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    let finalAddress = `Mesa ${selectedTable}`;
    let finalOrderType = newOrderType;
    let finalTableNumber = String(selectedTable);

    if (isBarra) {
      finalAddress = 'Recojo en Barra';
      finalOrderType = 'Barra';
      finalTableNumber = null;
    } else if (newOrderType === 'Mesa_Llevar') {
      finalAddress = `Mesa ${selectedTable} (Para Llevar)`;
    }

    const newOrder = {
      id: orderId,
      customer: {
        name: finalClient,
        phone: newOrderPhone.trim() || 'Sin teléfono',
        address: finalAddress,
        paymentMethod: 'Efectivo',
        orderType: finalOrderType,
        tableNumber: finalTableNumber
      },
      items: [...newOrderItems],
      total: subtotal,
      deliveryFee: 0,
      discount: 0,
      couponCode: null,
      grandTotal: subtotal,
      status: 'Pendiente',
      statusHistory: [
        { status: 'Pendiente', timestamp: new Date().toISOString() }
      ],
      date: new Date().toISOString()
    };

    onUpdateOrders([newOrder, ...orders]);
    // Sincronizar de inmediato
    updateSyncedData(`order_${newOrder.id}`, newOrder);
    if (isBarra) {
      setSelectedBarraOrderId(newOrder.id);
    }

    const logMsg = isBarra 
      ? `Nuevo pedido de Barra registrado por ${currentUser?.name || ''}: Código ${orderId}.`
      : `Nuevo pedido de mesa registrado por mozo ${currentUser?.name || ''}: Mesa ${selectedTable} (${newOrderType === 'Mesa_Llevar' ? 'Para Llevar' : 'Local'}) - Código ${orderId}.`;
    
    addLog(logMsg);
    
    const alertMsg = isBarra
      ? `Pedido en Barra abierto correctamente.`
      : `Mesa ${selectedTable} abierta correctamente con el pedido.`;
      
    alert(alertMsg);
    
    // Resetear formulario
    setNewOrderClient('');
    setNewOrderPhone('');
    setNewOrderItems([]);
    setShowNewOrderForm(false);
  };

  // Cambiar tipo de pedido a Para Llevar / Delivery
  const handleConvertToTakeout = (activeOrder) => {
    const addressPrompt = window.prompt("Dirección para la entrega (o escribe 'Recojo en tienda'):", "Recojo en Tienda");
    if (addressPrompt === null) return; // Canceló

    const deliveryFeeVal = addressPrompt.toLowerCase().includes('recojo') ? 0 : 4.0; // Cargo estándar

    let orderVal = null;
    const updatedOrders = orders.map(o => {
      if (o.id === activeOrder.id) {
        orderVal = {
          ...o,
          customer: {
            ...o.customer,
            orderType: 'Llevar',
            tableNumber: null,
            address: addressPrompt
          },
          deliveryFee: deliveryFeeVal,
          grandTotal: Math.max(0, o.total + deliveryFeeVal - o.discount)
        };
        return orderVal;
      }
      return o;
    });

    if (orderVal) {
      updateSyncedData(`order_${orderVal.id}`, orderVal);
    }
    onUpdateOrders(updatedOrders);
    addLog(`Pedido ${activeOrder.id} de Mesa ${selectedTable} cambiado a Para Llevar por ${currentUser?.name}.`);
    alert("Pedido cambiado a Para Llevar con éxito.");
    setSelectedTable(null); // Quitar selección de mesa
  };

  // Cambiar estado de orden de mesa
  const handleUpdateTableOrderStatus = (activeOrder, newStatus) => {
    let orderVal = null;
    const updatedOrders = orders.map(o => {
      if (o.id === activeOrder.id) {
        const history = o.statusHistory || [];
        orderVal = {
          ...o,
          status: newStatus,
          statusHistory: [...history, { status: newStatus, timestamp: new Date().toISOString() }]
        };
        return orderVal;
      }
      return o;
    });
    if (orderVal) {
      updateSyncedData(`order_${orderVal.id}`, orderVal);
    }
    onUpdateOrders(updatedOrders);
    addLog(`Estado de pedido ${activeOrder.id} (Mesa ${selectedTable}) cambiado a ${newStatus} por ${currentUser?.name}.`);
    alert(`Estado de la Mesa ${selectedTable} cambiado a ${newStatus}.`);
  };

  // Cierre y Cobro de Mesa
  const handleCheckoutTable = (activeOrder) => {
    let orderVal = null;
    const updatedOrders = orders.map(o => {
      if (o.id === activeOrder.id) {
        orderVal = {
          ...o,
          tablePaid: true,
          status: 'Entregado',
          customer: {
            ...o.customer,
            paymentMethod: checkoutPaymentMethod
          }
        };
        return orderVal;
      }
      return o;
    });

    if (orderVal) {
      updateSyncedData(`order_${orderVal.id}`, orderVal);
    }
    onUpdateOrders(updatedOrders);
    addLog(`Mesa ${selectedTable} pagada y cerrada vía ${checkoutPaymentMethod}. Pedido ${activeOrder.id} cobrado.`);
    alert(`Mesa ${selectedTable} cerrada y liberada exitosamente.`);
    
    setShowCheckoutSection(false);
    setSelectedTable(null);
  };

  // Cancelar orden de mesa
  const handleCancelTableOrder = (activeOrder) => {
    if (!window.confirm("¿Seguro que deseas cancelar el pedido de la mesa? Esta acción liberará la mesa inmediatamente.")) return;
    handleUpdateTableOrderStatus(activeOrder, 'Cancelado');
    setSelectedTable(null);
  };

  // Eliminar item de la lista temporal
  const handleRemoveLocalItem = (index) => {
    setNewOrderItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Renderizar la cuadrícula de mesas
  const renderTablesGrid = () => {
    const tableCards = [];
    for (let i = 1; i <= totalTables; i++) {
      const activeOrder = getActiveTableOrder(i);
      let cardBg = 'rgba(46, 204, 113, 0.1)';
      let cardBorder = '1px solid rgba(46, 204, 113, 0.3)';
      let cardTextColor = 'var(--success)';
      let statusLabel = 'Libre';

      if (activeOrder) {
        if (activeOrder.status === 'Por Corroborar') {
          cardBg = 'rgba(230, 126, 34, 0.12)';
          cardBorder = '1px solid rgba(230, 126, 34, 0.4)';
          cardTextColor = '#e67e22';
          statusLabel = 'Por corroborar';
        } else if (activeOrder.status === 'Pendiente') {
          cardBg = 'rgba(241, 196, 15, 0.12)';
          cardBorder = '1px solid rgba(241, 196, 15, 0.4)';
          cardTextColor = '#d98811';
          statusLabel = 'Esperando aceptación';
        } else if (activeOrder.status === 'Preparando') {
          cardBg = 'rgba(52, 152, 219, 0.12)';
          cardBorder = '1px solid rgba(52, 152, 219, 0.4)';
          cardTextColor = 'var(--primary-color)';
          statusLabel = 'En preparación';
        } else if (activeOrder.status === 'Entregado') {
          cardBg = 'rgba(155, 89, 182, 0.12)';
          cardBorder = '1px solid rgba(155, 89, 182, 0.4)';
          cardTextColor = '#9b59b6';
          statusLabel = 'Consumiendo / Servido';
        }
      }

      const isSelected = selectedTable === i;

      tableCards.push(
        <div
          key={i}
          onClick={() => {
            setSelectedTable(i);
            setShowNewOrderForm(false);
            setShowCheckoutSection(false);
            setNewOrderItems([]);
          }}
          style={{
            background: isSelected ? 'var(--primary-color)' : cardBg,
            border: isSelected ? '1px solid var(--primary-color)' : cardBorder,
            color: isSelected ? 'white' : cardTextColor,
            padding: '15px',
            borderRadius: '12px',
            cursor: 'pointer',
            textAlign: 'center',
            boxShadow: isSelected ? '0 8px 16px rgba(255, 64, 129, 0.25)' : 'none',
            transform: isSelected ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100px'
          }}
        >
          <span style={{ fontSize: '1.6rem', marginBottom: '4px' }}>🍽️</span>
          <strong style={{ fontSize: '1.05rem', display: 'block', color: isSelected ? 'white' : 'inherit' }}>Mesa {i}</strong>
          <span style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.85, fontWeight: 'bold' }}>{statusLabel}</span>
          {activeOrder && (
            <span style={{ fontSize: '0.65rem', marginTop: '2px', display: 'block', padding: '1px 6px', background: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)', borderRadius: '8px' }}>
              S/. {activeOrder.grandTotal.toFixed(2)}
            </span>
          )}
        </div>
      );
    }

    // Agregar Barra (Llevar)
    const activeBarraOrders = orders.filter(
      o => o.customer?.orderType === 'Barra' && 
           o.status !== 'Cancelado' && 
           !o.tablePaid
    );
    const barraCount = activeBarraOrders.length;
    let barraBg = 'rgba(52, 152, 219, 0.1)';
    let barraBorder = '1px solid rgba(52, 152, 219, 0.3)';
    let barraTextColor = 'var(--primary-color)';
    let barraStatus = 'Sin pedidos';

    if (barraCount > 0) {
      const hasPorCorroborar = activeBarraOrders.some(o => o.status === 'Por Corroborar');
      if (hasPorCorroborar) {
        barraBg = 'rgba(230, 126, 34, 0.12)';
        barraBorder = '1px solid rgba(230, 126, 34, 0.4)';
        barraTextColor = '#e67e22';
        barraStatus = `${barraCount} pedido(s) (Por corroborar)`;
      } else {
        barraBg = 'rgba(155, 89, 182, 0.12)';
        barraBorder = '1px solid rgba(155, 89, 182, 0.4)';
        barraTextColor = '#9b59b6';
        barraStatus = `${barraCount} pedido(s) activo(s)`;
      }
    }

    const isBarraSelected = selectedTable === 'Barra';

    tableCards.push(
      <div
        key="barra"
        onClick={() => {
          setSelectedTable('Barra');
          setShowNewOrderForm(false);
          setShowCheckoutSection(false);
          setNewOrderItems([]);
          
          if (activeBarraOrders.length > 0) {
            setSelectedBarraOrderId(activeBarraOrders[0].id);
          } else {
            setSelectedBarraOrderId(null);
          }
        }}
        style={{
          background: isBarraSelected ? 'var(--primary-color)' : barraBg,
          border: isBarraSelected ? '1px solid var(--primary-color)' : barraBorder,
          color: isBarraSelected ? 'white' : barraTextColor,
          padding: '15px',
          borderRadius: '12px',
          cursor: 'pointer',
          textAlign: 'center',
          boxShadow: isBarraSelected ? '0 8px 16px rgba(255, 64, 129, 0.25)' : 'none',
          transform: isBarraSelected ? 'translateY(-2px)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100px'
        }}
      >
        <span style={{ fontSize: '1.6rem', marginBottom: '4px' }}>🛍️</span>
        <strong style={{ fontSize: '1.05rem', display: 'block', color: isBarraSelected ? 'white' : 'inherit' }}>Barra (Llevar)</strong>
        <span style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.85, fontWeight: 'bold' }}>{barraStatus}</span>
      </div>
    );

    return tableCards;
  };

  // Filtrar catálogo para el tomador de pedidos
  const activeFlavors = flavors ? flavors.filter(f => f.active) : [];
  const activePacks = packs ? packs.filter(p => p.active) : [];

  const getFilteredCatalogItems = () => {
    let result = [];
    if (selectedCategory === 'all' || selectedCategory === 'flavors') {
      result.push({
        id: 'custom_icecream',
        name: '🍦 Helado Personalizado (Copa/Cono)',
        priceRange: 'S/. 6.00 - S/. 15.00',
        type: 'custom_launcher'
      });
    }
    if (selectedCategory === 'all' || selectedCategory === 'liters') {
      if (literConfig?.active !== false) {
        result.push({
          id: 'liter_custom',
          name: '🏺 Litro de Helado Personalizado',
          price: literConfig?.price || 15.00,
          type: 'liter_launcher'
        });
      }
    }
    if (selectedCategory === 'all' || selectedCategory === 'packs') {
      activePacks.forEach(p => {
        result.push({
          ...p,
          type: 'pack'
        });
      });
    }

    if (searchQuery.trim()) {
      result = result.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return result;
  };

  // Armar Helado Personalizado
  const handleAddCustomIceCream = () => {
    if (selectedScoops.length === 0) {
      alert("Debes seleccionar al menos 1 sabor de helado.", 'error');
      return;
    }

    // Calcular precio basado en bolas
    const scoopsPrice = selectedScoops.reduce((sum, s) => sum + s.price, 0);
    const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    const basePrice = selectedBase.price || 0.0;
    const finalPrice = scoopsPrice + toppingsPrice + basePrice;

    const nameStr = `Helado Personalizado (${selectedScoops.map(s => s.name).join(' + ')})`;
    const item = {
      type: 'custom',
      base: selectedBase,
      scoops: [...selectedScoops],
      toppings: [...selectedToppings],
      price: finalPrice,
      quantity: 1,
      name: nameStr
    };

    handleAddItemToOrder(item);

    // Resetear customizer
    setSelectedScoops([]);
    setSelectedToppings([]);
    setShowCustomizer(false);
  };

  // Armar Litro Personalizado
  const handleAddCustomLiter = () => {
    if (literScoops.length === 0) {
      alert("Debes seleccionar al menos 1 sabor para el litro.", 'error');
      return;
    }

    const maxFlavors = literConfig?.maxFlavors || 3;
    if (literScoops.length > maxFlavors) {
      alert(`Un pote de litro solo puede llevar hasta ${maxFlavors} sabores.`, 'error');
      return;
    }

    const item = {
      type: 'liter',
      price: literConfig?.price || 15.00,
      scoops: [...literScoops], // Guardar como scoops/sabores
      toppings: [],
      quantity: 1,
      name: `Helado de 1 Litro (${literScoops.map(s => s.name).join(' + ')})`
    };

    handleAddItemToOrder(item);
    setLiterScoops([]);
    setShowLiterCustomizer(false);
  };

  const activeBarraOrders = orders.filter(
    o => o.customer?.orderType === 'Barra' && o.status !== 'Cancelado' && !o.tablePaid
  );

  const activeOrder = selectedTable === 'Barra'
    ? orders.find(o => o.id === selectedBarraOrderId && o.customer?.orderType === 'Barra' && o.status !== 'Cancelado' && !o.tablePaid)
    : (selectedTable ? getActiveTableOrder(selectedTable) : null);

  return (
    <div className="table-order-manager-layout">
      <style>{`
        .table-order-manager-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
          align-items: start;
        }
        .new-order-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .table-actions-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .table-actions-row > button, .table-actions-row > select {
          flex: 1 1 auto;
          min-width: 80px;
        }
        @media (max-width: 768px) {
          .table-order-manager-layout {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 480px) {
          .new-order-form-grid {
            grid-template-columns: 1fr;
          }
          .table-actions-row {
            flex-direction: column;
          }
          .table-actions-row > button, .table-actions-row > select {
            width: 100%;
          }
        }
      `}</style>
      
      {/* Columna Izquierda: Monitoreo de Mesas */}
      <div className="glass" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>📊 Monitor de Mesas de la Tienda</h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)' }}>
            Total: {totalTables} Mesas comerciales
          </span>
        </div>

        {/* Panel de Llamados Activos (🛎️) */}
        {tableCalls.filter(c => !c.resolved).length > 0 && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.08)',
            border: '1px solid rgba(231, 76, 60, 0.25)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '15px',
            animation: 'pulse-border 2s infinite'
          }}>
            <strong style={{ display: 'block', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '8px', textAlign: 'left' }}>
              🛎️ Llamados de Mesa Activos ({tableCalls.filter(c => !c.resolved).length})
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tableCalls.filter(c => !c.resolved).map((call, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-secondary)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.75rem'
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ color: 'var(--primary-color)' }}>Mesa {call.table}</strong>
                    <span style={{ marginLeft: '10px', fontWeight: 600 }}>{call.request}</span>
                    <small style={{ display: 'block', color: 'var(--text-light)', marginTop: '2px', fontSize: '0.65rem' }}>
                      Hace: {new Date(call.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                  <button
                    onClick={() => handleResolveCall(call)}
                    className="btn btn-primary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.7rem',
                      background: 'var(--success)',
                      borderColor: 'var(--success)',
                      borderRadius: '6px'
                    }}
                  >
                    ✅ Atendido
                  </button>
                </div>
              ))}
            </div>
            <style>{`
              @keyframes pulse-border {
                0% { border-color: rgba(231, 76, 60, 0.25); }
                50% { border-color: rgba(231, 76, 60, 0.6); }
                100% { border-color: rgba(231, 76, 60, 0.25); }
              }
            `}</style>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
          {renderTablesGrid()}
        </div>
      </div>

      {/* Columna Derecha: Detalle / Tomador de Pedidos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {selectedTable ? (
          <div className="glass" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', borderLeft: '4px solid var(--primary-color)' }}>
            
            {/* Cabecera de Mesa Seleccionada */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px' }}>
              <div>
                {selectedTable === 'Barra' ? (
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>🛍️ Pedidos en Barra (Llevar)</h4>
                ) : (
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary-color)' }}>🍽️ Mesa Seleccionada: {selectedTable}</h4>
                )}
                {activeOrder ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                    Código Pedido: <strong>{activeOrder.id}</strong> ({new Date(activeOrder.date).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    {selectedTable === 'Barra' ? 'Sin pedido seleccionado.' : 'Mesa vacía y libre.'}
                  </span>
                )}
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '3px 8px', fontSize: '0.7rem' }} 
                onClick={() => { setSelectedTable(null); setShowNewOrderForm(false); setShowCheckoutSection(false); }}
              >
                Cerrar Detalle
              </button>
            </div>

            {/* Selector de pedidos activos en Barra */}
            {selectedTable === 'Barra' && (
              <div style={{ marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: 'var(--text-light)' }}>
                  Pedidos Activos ({activeBarraOrders.length}):
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {activeBarraOrders.map(o => {
                    const isSelected = o.id === selectedBarraOrderId;
                    const isPorCorroborar = o.status === 'Por Corroborar';
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedBarraOrderId(o.id);
                          setShowNewOrderForm(false);
                          setShowCheckoutSection(false);
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          borderRadius: '20px',
                          border: isSelected 
                            ? '2px solid var(--primary-color)' 
                            : '1px solid var(--border-color)',
                          background: isSelected 
                            ? 'rgba(255, 64, 129, 0.15)' 
                            : (isPorCorroborar ? 'rgba(230, 126, 34, 0.1)' : 'var(--bg-secondary)'),
                          color: isSelected 
                            ? 'var(--primary-color)' 
                            : (isPorCorroborar ? '#e67e22' : 'var(--text-color)'),
                          fontWeight: isSelected ? 'bold' : 'normal',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        {isPorCorroborar && '⏳'}
                        <span>{o.customer?.name || o.id}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBarraOrderId(null);
                      setShowNewOrderForm(true);
                      setNewOrderItems([]);
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      borderRadius: '20px',
                      border: '1px dashed var(--primary-color)',
                      background: 'transparent',
                      color: 'var(--primary-color)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    ➕ Nuevo Pedido
                  </button>
                </div>
              </div>
            )}

            {/* Si la mesa está Ocupada (Tiene pedido activo) */}
            {activeOrder ? (
              <div>
                {/* Alerta de Pedido por Corroborar */}
                {activeOrder.status === 'Por Corroborar' && (
                  <div style={{
                    background: 'rgba(230, 126, 34, 0.12)',
                    border: '1px solid rgba(230, 126, 34, 0.3)',
                    color: '#e67e22',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    marginBottom: '12px',
                    textAlign: 'left'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>⏳ Pedido por Corroborar</strong>
                    <span style={{ fontSize: '0.75rem', lineHeight: '1.3', display: 'block' }}>Este pedido fue enviado por el cliente. Corrobora los productos y presiona el botón para enviarlo a la cocina.</span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleCorroborarOrder(activeOrder)}
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '6px',
                        fontSize: '0.75rem',
                        background: '#e67e22',
                        borderColor: '#e67e22',
                        color: 'white',
                        fontWeight: 'bold'
                      }}
                    >
                      ✅ Corroborar y Enviar a Cocina
                    </button>
                  </div>
                )}

                {/* Info Cliente */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '12px', fontSize: '0.75rem' }}>
                  <div style={{ flex: '1 1 120px' }}>
                    <strong>Cliente:</strong> {activeOrder.customer.name}
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <strong>Celular:</strong> {activeOrder.customer.phone}
                  </div>
                  <div style={{ width: '100%', display: 'flex', gap: '10px', marginTop: '6px', alignItems: 'center' }}>
                    <strong>Estado Cocina:</strong> 
                    <span style={{
                      fontWeight: 'bold',
                      color: activeOrder.status === 'Por Corroborar' ? '#e67e22' : (activeOrder.status === 'Pendiente' ? '#d98811' : (activeOrder.status === 'Preparando' ? 'var(--primary-color)' : '#9b59b6')),
                      background: 'rgba(0,0,0,0.03)',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {activeOrder.status}
                    </span>
                  </div>
                </div>

                {/* Lista de Ítems Consumidos */}
                <strong style={{ fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>📋 Detalle de la Cuenta</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', background: 'var(--bg-secondary)', marginBottom: '12px' }}>
                  {activeOrder.items.map((item, index) => {
                    let itemDetails = '';
                    if (item.type === 'custom' && item.scoops) {
                      itemDetails = item.scoops.map(s => s.name).join(', ');
                    } else if (item.type === 'liter' && item.scoops) {
                      itemDetails = item.scoops.map(s => s.name).join(', ');
                    }
                    return (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px', paddingTop: '4px' }}>
                        <span style={{ flex: 1, paddingRight: '8px' }}>
                          <strong style={{ color: 'var(--primary-color)' }}>{item.quantity}x</strong> {item.name}
                          {itemDetails && <small style={{ color: 'var(--text-light)', display: 'block', fontSize: '0.7rem', marginTop: '2px' }}>{itemDetails}</small>}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateActiveOrderItemQty(activeOrder, index, -1)}
                            style={{ padding: '2px 6px', fontSize: '0.65rem', border: '1px solid var(--border-color)', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateActiveOrderItemQty(activeOrder, index, 1)}
                            style={{ padding: '2px 6px', fontSize: '0.65rem', border: '1px solid var(--border-color)', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveActiveOrderItem(activeOrder, index)}
                            style={{ padding: '2px 6px', fontSize: '0.65rem', border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                          <strong style={{ marginLeft: '5px', minWidth: '55px', textAlign: 'right' }}>S/. {(item.price * item.quantity).toFixed(2)}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotales y Totales */}
                <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '8px', fontSize: '0.8rem', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>Subtotal:</span>
                    <span>S/. {activeOrder.total.toFixed(2)}</span>
                  </div>
                  {activeOrder.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', color: 'var(--success)', fontWeight: 'bold' }}>
                      <span>Descuento cupón ({activeOrder.couponCode}):</span>
                      <span>- S/. {activeOrder.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary-color)', marginTop: '4px' }}>
                    <span>Total a Pagar:</span>
                    <span>S/. {activeOrder.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Caja de Cobro Rápido / Checkout */}
                {showCheckoutSection ? (
                  <div style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--success)', marginBottom: '8px' }}>💳 Registrar Pago y Liberar Mesa</strong>
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Método de Pago:</label>
                      <select 
                        className="form-control" 
                        value={checkoutPaymentMethod}
                        onChange={(e) => setCheckoutPaymentMethod(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '6px', marginTop: '4px' }}
                      >
                        <option value="Yape">📱 Yape</option>
                        <option value="Plin">💸 Plin</option>
                        <option value="Efectivo">💵 Efectivo / Tarjeta</option>
                      </select>
                    </div>
                    <div className="table-actions-row">
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        style={{ flex: 1, padding: '6px', fontSize: '0.75rem', background: 'var(--success)', border: 'none' }}
                        onClick={() => handleCheckoutTable(activeOrder)}
                      >
                        ✅ Registrar Pago (S/. {activeOrder.grandTotal.toFixed(2)})
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        onClick={() => setShowCheckoutSection(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Botonera de Acciones */
                  <>
                    <div className="table-actions-row">
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '8px', fontSize: '0.75rem', background: 'var(--success)', borderColor: 'var(--success)' }}
                        onClick={() => setShowCheckoutSection(true)}
                      >
                        💳 Cerrar Cuenta / Cobrar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '0.75rem' }}
                        onClick={() => handleConvertToTakeout(activeOrder)}
                      >
                        🛍️ Llevar
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', fontSize: '0.75rem', background: 'rgba(230, 126, 34, 0.08)', color: '#e67e22', border: '1px solid rgba(230,126,34,0.15)' }}
                        onClick={() => {
                          if (window.confirm("¿Seguro que deseas liberar la mesa? Se marcará el pedido como cobrado para vaciar la mesa.")) {
                            handleCheckoutTable(activeOrder);
                          }
                        }}
                      >
                        🔓 Liberar
                      </button>
                    </div>
 
                    <div className="table-actions-row">
                      <select
                        className="form-control"
                        value={activeOrder.status}
                        onChange={(e) => handleUpdateTableOrderStatus(activeOrder, e.target.value)}
                        style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                      >
                        <option value="Por Corroborar">⏳ Cocina: Por Corroborar</option>
                        <option value="Pendiente">⏳ Cocina: Pendiente</option>
                        <option value="Preparando">🍦 Cocina: Preparando</option>
                        <option value="Entregado">🍽️ Cocina: Servido a Mesa</option>
                      </select>
                      
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(231, 76, 60, 0.1)', color: 'var(--danger)', border: '1px solid rgba(231,76,60,0.2)' }}
                        onClick={() => handleCancelTableOrder(activeOrder)}
                      >
                        🚫 Cancelar
                      </button>
                    </div>
                  </>
                )}

                {/* Módulo Mozo: Agregar Productos a la mesa activa */}
                {waiterTakerEnabled && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                    <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '8px', color: 'var(--primary-color)' }}>
                      🤵 Tomador de Pedidos (Agregar a Mesa {selectedTable})
                    </strong>
                    
                    {/* Buscador de Catálogo */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="Buscar sabor, pack..."
                        className="form-control"
                        style={{ fontSize: '0.75rem', padding: '5px 10px', flex: 1 }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <select
                        className="form-control"
                        style={{ fontSize: '0.75rem', padding: '5px', width: '90px' }}
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                      >
                        <option value="all">Filtro: Todo</option>
                        <option value="flavors">Helados</option>
                        <option value="packs">Combos</option>
                        <option value="liters">Potes Litro</option>
                      </select>
                    </div>

                    {/* Resultados del Catálogo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: 'rgba(0,0,0,0.01)' }}>
                      {getFilteredCatalogItems().map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingBottom: '4px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                          <span>
                            <strong>{item.name}</strong>
                            <span style={{ color: 'var(--primary-color)', marginLeft: '8px' }}>
                              {item.price ? `S/. ${item.price.toFixed(2)}` : item.priceRange}
                            </span>
                          </span>
                          
                          {item.type === 'custom_launcher' ? (
                            <button 
                              type="button" 
                              className="btn btn-primary" 
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              onClick={() => { setShowCustomizer(true); setShowLiterCustomizer(false); }}
                            >
                              ⚙️ Armar
                            </button>
                          ) : item.type === 'liter_launcher' ? (
                            <button 
                              type="button" 
                              className="btn btn-primary" 
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              onClick={() => { setShowLiterCustomizer(true); setShowCustomizer(false); }}
                            >
                              🏺 Armar
                            </button>
                          ) : (
                            <button 
                              type="button" 
                              className="btn btn-primary" 
                              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              onClick={() => handleAddItemToOrder({
                                type: item.type,
                                id: item.id,
                                name: item.name,
                                price: item.price,
                                quantity: 1,
                                image: item.image || ''
                              })}
                            >
                              ➕ Añadir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Si la mesa está LIBRE */
              <div>
                {!showNewOrderForm ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    {selectedTable === 'Barra' ? (
                      <>
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🛍️</span>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '15px' }}>
                          No hay pedidos activos en Barra. Puedes iniciar uno nuevo para llevar.
                        </p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🟢</span>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '15px' }}>
                          La mesa está libre y lista para recibir comensales.
                        </p>
                      </>
                    )}
                    
                    {waiterTakerEnabled ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '8px 20px', fontSize: '0.8rem' }}
                        onClick={() => setShowNewOrderForm(true)}
                      >
                        {selectedTable === 'Barra' ? '➕ Registrar Nuevo Pedido en Barra' : '➕ Registrar Nuevo Pedido (Abrir Mesa)'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-light)' }}>
                        El tomador de pedidos de mozo está desactivado.
                      </span>
                    )}
                  </div>
                ) : (
                  /* Formulario de Apertura / Nuevo Pedido de Mesa */
                  <form onSubmit={handleCreateOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <strong style={{ fontSize: '0.8rem', display: 'block', color: 'var(--primary-color)' }}>
                      {selectedTable === 'Barra' ? '📝 Nuevo Pedido en Barra (Llevar)' : `📝 Abrir Mesa ${selectedTable}`}
                    </strong>
                    
                    <div className="new-order-form-grid">
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Nombre Cliente:</label>
                        <input
                          type="text"
                          placeholder={selectedTable === 'Barra' ? "Ej: Carlos o Barra" : `Ej: Mesa ${selectedTable} o Carlos`}
                          className="form-control"
                          style={{ fontSize: '0.8rem', padding: '6px' }}
                          value={newOrderClient}
                          onChange={(e) => setNewOrderClient(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>WhatsApp (Opcional):</label>
                        <input
                          type="tel"
                          placeholder="Ej: 987654321"
                          className="form-control"
                          style={{ fontSize: '0.8rem', padding: '6px' }}
                          value={newOrderPhone}
                          onChange={(e) => setNewOrderPhone(e.target.value)}
                        />
                      </div>
                      
                      {selectedTable !== 'Barra' && (
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tipo de Servicio:</label>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.8rem', padding: '6px' }}
                            value={newOrderType}
                            onChange={(e) => setNewOrderType(e.target.value)}
                          >
                            <option value="Mesa">🍽️ Consumo Local (Mesa)</option>
                            <option value="Mesa_Llevar">🛍️ Para Llevar (Mesa)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Previa de Ítems agregados a la nueva mesa */}
                    <strong style={{ fontSize: '0.75rem', display: 'block', marginTop: '5px' }}>Productos del Pedido:</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: 'var(--bg-secondary)', fontSize: '0.75rem' }}>
                      {newOrderItems.length === 0 ? (
                        <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>El pedido está vacío. Selecciona productos abajo.</span>
                      ) : (
                        newOrderItems.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.02)', paddingBottom: '3px' }}>
                            <span>{item.quantity}x {item.name} - S/. {(item.price * item.quantity).toFixed(2)}</span>
                            <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleRemoveLocalItem(idx)}>🗑️</button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="table-actions-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.75rem', background: 'var(--success)', border: 'none' }}>
                        🚀 Confirmar y Abrir Mesa (S/. {newOrderItems.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)})
                      </button>
                      <button type="button" className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.75rem' }} onClick={() => { setShowNewOrderForm(false); setNewOrderItems([]); }}>
                        Cancelar
                      </button>
                    </div>

                    {/* Buscador y selector de productos */}
                    <div style={{ marginTop: '5px' }}>
                      <strong style={{ fontSize: '0.75rem', display: 'block', marginBottom: '5px' }}>Añadir al Pedido:</strong>
                      
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <input
                          type="text"
                          placeholder="Buscar sabor..."
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', flex: 1 }}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <select
                          className="form-control"
                          style={{ fontSize: '0.75rem', padding: '5px', width: '90px' }}
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                          <option value="all">Todo</option>
                          <option value="flavors">Helados</option>
                          <option value="packs">Combos</option>
                          <option value="liters">Potes Litro</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: 'rgba(0,0,0,0.01)' }}>
                        {getFilteredCatalogItems().map(item => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', paddingBottom: '4px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                            <span>
                              <strong>{item.name}</strong>
                              <span style={{ color: 'var(--primary-color)', marginLeft: '8px' }}>
                                {item.price ? `S/. ${item.price.toFixed(2)}` : item.priceRange}
                              </span>
                            </span>
                            
                            {item.type === 'custom_launcher' ? (
                              <button 
                                type="button" 
                                className="btn btn-primary" 
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                onClick={() => { setShowCustomizer(true); setShowLiterCustomizer(false); }}
                              >
                                ⚙️ Armar
                              </button>
                            ) : item.type === 'liter_launcher' ? (
                              <button 
                                type="button" 
                                className="btn btn-primary" 
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                onClick={() => { setShowLiterCustomizer(true); setShowCustomizer(false); }}
                              >
                                🏺 Armar
                              </button>
                            ) : (
                              <button 
                                type="button" 
                                className="btn btn-primary" 
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                onClick={() => handleAddItemToOrder({
                                  type: item.type,
                                  id: item.id,
                                  name: item.name,
                                  price: item.price,
                                  quantity: 1,
                                  image: item.image || ''
                                })}
                              >
                                ➕ Añadir
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="glass" style={{ padding: '25px', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-light)' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>🍽️</span>
            <h4>Selecciona una Mesa</h4>
            <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
              Haz clic sobre cualquier mesa de la cuadrícula para ver el pedido activo, agregar helados, cambiar a para llevar o cerrar su consumo.
            </p>
          </div>
        )}

        {/* Modal / Selector de Armado de Helado Personalizado (Copa / Cono) */}
        {showCustomizer && (
          <div className="glass" style={{ padding: '15px', borderRadius: '8px', border: '1px solid var(--primary-color)', background: 'var(--bg-secondary)' }}>
            <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--primary-color)' }}>🍦 Armar Helado Personalizado</strong>
            
            {/* Bolas / Scoops select */}
            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Bolas de helado:</label>
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {[1, 2, 3].map(n => (
                  <button 
                    key={n} 
                    type="button" 
                    className={`payment-btn ${customScoopsCount === n ? 'selected' : ''}`}
                    onClick={() => { setCustomScoopsCount(n); setSelectedScoops([]); }}
                    style={{ flex: 1, padding: '4px', fontSize: '0.75rem' }}
                  >
                    {n} Bola{n > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Sabor selector */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Selecciona Sabores ({selectedScoops.length} / {customScoopsCount}):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', background: 'white' }}>
                {activeFlavors.map(f => {
                  const isSelected = selectedScoops.some(s => s.id === f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: isSelected ? 'var(--primary-color)' : '#f5f5f5',
                        color: isSelected ? 'white' : '#333',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedScoops(selectedScoops.filter(s => s.id !== f.id));
                        } else if (selectedScoops.length < customScoopsCount) {
                          setSelectedScoops([...selectedScoops, f]);
                        }
                      }}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toppings selector */}
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Toppings (Opcional):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', background: 'white' }}>
                {toppings ? toppings.map(t => {
                  const isSelected = selectedToppings.some(st => st.id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: isSelected ? 'var(--primary-color)' : '#f5f5f5',
                        color: isSelected ? 'white' : '#333',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedToppings(selectedToppings.filter(st => st.id !== t.id));
                        } else {
                          setSelectedToppings([...selectedToppings, t]);
                        }
                      }}
                    >
                      {t.name} (+S/. {t.price.toFixed(2)})
                    </button>
                  );
                }) : null}
              </div>
            </div>

            <div className="table-actions-row">
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '5px', fontSize: '0.75rem' }} 
                onClick={handleAddCustomIceCream}
              >
                Añadir Helado
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '5px 10px', fontSize: '0.75rem' }} 
                onClick={() => setShowCustomizer(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Modal / Selector de Armado de Litro */}
        {showLiterCustomizer && (
          <div className="glass" style={{ padding: '15px', borderRadius: '8px', border: '1px solid var(--primary-color)', background: 'var(--bg-secondary)' }}>
            <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--primary-color)' }}>🏺 Armar Pote de 1 Litro (S/. {literConfig?.price || 15.00})</strong>
            
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Selecciona Sabores (hasta {literConfig?.maxFlavors || 3} sabores):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px', background: 'white' }}>
                {activeFlavors.map(f => {
                  const isSelected = literScoops.some(s => s.id === f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      style={{
                        padding: '3px 8px',
                        fontSize: '0.7rem',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                        background: isSelected ? 'var(--primary-color)' : '#f5f5f5',
                        color: isSelected ? 'white' : '#333',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        if (isSelected) {
                          setLiterScoops(literScoops.filter(s => s.id !== f.id));
                        } else if (literScoops.length < (literConfig?.maxFlavors || 3)) {
                          setLiterScoops([...literScoops, f]);
                        }
                      }}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="table-actions-row">
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '5px', fontSize: '0.75rem' }} 
                onClick={handleAddCustomLiter}
              >
                Añadir Pote
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '5px 10px', fontSize: '0.75rem' }} 
                onClick={() => setShowLiterCustomizer(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
