async function test() {
  const orderId = `PED-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const dummyOrder = {
    id: orderId,
    customer: {
      name: "Cliente De Prueba",
      phone: "51999999999",
      address: "Calle Principal 123",
      paymentMethod: "Yape",
      orderType: "Delivery"
    },
    items: [
      {
        type: "custom",
        name: "Helado de Fresa",
        price: 5.0,
        quantity: 1
      }
    ],
    total: 5.0,
    deliveryFee: 2.0,
    discount: 0,
    grandTotal: 7.0,
    date: new Date().toISOString()
  };

  console.log(`Sending test checkout to http://localhost:5174 for order ID: ${orderId}...`);

  try {
    const response = await fetch("http://localhost:5174/api/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Host": "localhost:5174",
        "Origin": "http://localhost:5174"
      },
      body: JSON.stringify({ id: orderId, order: dummyOrder })
    });

    const status = response.status;
    const bodyText = await response.text();
    console.log(`Response Status: ${status}`);
    console.log("Response Body:", bodyText);
  } catch (err) {
    console.error("Fetch request failed:", err);
  }
}

test();
