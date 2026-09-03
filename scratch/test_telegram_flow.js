import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 1. Cargar .env manualmente
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE FLUJO DE TELEGRAM ===");
  const orderId = 'PED-TEST-FLOW1';
  const tableNumber = '99';

  // --- PREPARACIÓN: Insertar datos en base de datos ---
  console.log(`\n1. Preparando base de datos con orden '${orderId}' y mesa '${tableNumber}'...`);
  
  const dummyOrder = {
    id: orderId,
    customer: {
      name: "Cliente Prueba Integración",
      phone: "+51 999 888 777",
      address: "Av. Las Flores 123",
      paymentMethod: "Yape",
      orderType: "Delivery"
    },
    items: [
      {
        type: "custom",
        name: "Copa Simple (Personalizado)",
        price: 7.50,
        quantity: 2,
        scoops: [{ id: "vainilla", name: "Vainilla" }],
        toppings: [{ id: "chispas", name: "Chispas de Chocolate" }],
        syrup: { id: "fresa_sauce", name: "Salsa de Fresa" }
      }
    ],
    total: 15.00,
    deliveryFee: 3.00,
    discount: 0,
    grandTotal: 18.00,
    date: new Date().toISOString(),
    survey: {
      rating: 5,
      comment: "Excelente servicio y sabor!",
      date: new Date().toISOString()
    }
  };

  const dummyTableCall = {
    table: tableNumber,
    request: "Llamado de Prueba | Carrito: Vacío",
    timestamp: new Date().toISOString(),
    resolved: false
  };

  // Upsert a helados_sync para la orden
  const { error: orderDbError } = await supabase
    .from('helados_sync')
    .upsert({
      key: `order_${orderId}`,
      value: dummyOrder,
      updated_at: new Date().toISOString()
    });

  if (orderDbError) {
    console.error("❌ Error al insertar orden en DB:", orderDbError);
    return;
  }
  console.log("✅ Orden insertada en DB.");

  // Upsert a helados_sync para el llamado de mesa
  const { error: tableDbError } = await supabase
    .from('helados_sync')
    .upsert({
      key: `order_call_Mesa_${tableNumber}`,
      value: dummyTableCall,
      updated_at: new Date().toISOString()
    });

  if (tableDbError) {
    console.error("❌ Error al insertar llamado de mesa en DB:", tableDbError);
    // limpiar orden y salir
    await supabase.from('helados_sync').delete().eq('key', `order_${orderId}`);
    return;
  }
  console.log("✅ Llamado de mesa insertado en DB.");

  // --- PRUEBA 1: Notificación de Pedidos ---
  console.log("\n2. Probando tipo 'order' (Notificación de Pedidos)...");
  try {
    const orderMsg = `🚨 *¡NUEVO PEDIDO DE PRUEBA!* 🚨\n\n` +
      `*Código:* ${orderId}\n` +
      `*Cliente:* ${dummyOrder.customer.name}\n` +
      `*WhatsApp:* ${dummyOrder.customer.phone}\n` +
      `*TOTAL:* S/. ${dummyOrder.grandTotal.toFixed(2)}`;

    const res = await fetch(`${BASE_URL}/api/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL
      },
      body: JSON.stringify({
        text: orderMsg,
        orderId: orderId,
        parse_mode: 'Markdown',
        kind: 'order'
      })
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body:`, await res.text());
  } catch (err) {
    console.error("❌ Falló el fetch de 'order':", err);
  }

  // --- PRUEBA 2: Notificación de Llamado de Mesa ---
  console.log("\n3. Probando tipo 'table_call' (Llamado de Mesa)...");
  try {
    const tableMsg = `🛎️ *Llamado de Mesa ${tableNumber} (Prueba)*\n\n*Solicitud:* Atención en mesa.`;
    const res = await fetch(`${BASE_URL}/api/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL
      },
      body: JSON.stringify({
        text: tableMsg,
        table: tableNumber,
        parse_mode: 'Markdown',
        kind: 'table_call'
      })
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body:`, await res.text());
  } catch (err) {
    console.error("❌ Falló el fetch de 'table_call':", err);
  }

  // --- PRUEBA 3: Notificación de Evaluaciones / Reseñas ---
  console.log("\n4. Probando tipo 'survey' (Encuestas)...");
  try {
    const surveyMsg = `🌟 *NUEVA VALORACIÓN DE CLIENTE (Prueba)* 🌟\n\n` +
      `*Pedido:* ${orderId}\n` +
      `*Calificación:* 🍦🍦🍦🍦🍦 (5/5)\n` +
      `*Comentario:* Excelente servicio y sabor!`;

    const res = await fetch(`${BASE_URL}/api/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL
      },
      body: JSON.stringify({
        text: surveyMsg,
        orderId: orderId,
        parse_mode: 'Markdown',
        kind: 'survey'
      })
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body:`, await res.text());
  } catch (err) {
    console.error("❌ Falló el fetch de 'survey':", err);
  }

  // --- PRUEBA 4: Notificación de Chat de Soporte ---
  console.log("\n5. Probando tipo 'support' (Chat de Soporte)...");
  try {
    const res = await fetch(`${BASE_URL}/api/telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': BASE_URL
      },
      body: JSON.stringify({
        kind: 'support',
        name: "Usuario De Soporte",
        phone: "+51 987654321",
        message: "Hola, tengo una pregunta sobre el tiempo de entrega."
      })
    });
    console.log(`Status: ${res.status}`);
    console.log(`Body:`, await res.text());
  } catch (err) {
    console.error("❌ Falló el fetch de 'support':", err);
  }

  // --- LIMPIEZA: Borrar de base de datos ---
  console.log("\n6. Limpiando base de datos...");
  await supabase.from('helados_sync').delete().eq('key', `order_${orderId}`);
  await supabase.from('helados_sync').delete().eq('key', `order_call_Mesa_${tableNumber}`);
  console.log("✅ Base de datos limpia.");
  console.log("\n=== PRUEBAS CONCLUIDAS ===");
}

runTests();
