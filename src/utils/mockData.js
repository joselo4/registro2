// Datos iniciales de la heladería

export const INITIAL_FLAVORS = [
  { id: 'fresa', name: 'Fresa Silvestre', price: 1.0, color: '#ff6b81', isPremium: false, active: true, description: 'Helado cremoso elaborado con fresas naturales seleccionadas.' },
  { id: 'vainilla', name: 'Vainilla Francesa', price: 1.0, color: '#f7d794', isPremium: false, active: true, description: 'Sabor clásico con esencia pura de vainilla y toque cremoso.' },
  { id: 'mango', name: 'Mango Tropical', price: 1.0, color: '#ffbe76', isPremium: false, active: true, description: 'Refrescante y dulce, hecho de pulpa pura de mango del norte.' },
  { id: 'maracuya', name: 'Maracuyá Ácida', price: 1.0, color: '#f9ca24', isPremium: false, active: true, description: 'Sabor frutal cítrico y refrescante, ideal para los días calurosos.' },
  { id: 'menta', name: 'Menta Chocochip', price: 1.0, color: '#9aecdb', isPremium: false, active: true, description: 'Helado refrescante de menta con chispas de chocolate crujientes.' },
  { id: 'lucuma', name: 'Lúcuma de Seda', price: 1.5, color: '#e58e26', isPremium: true, active: true, description: 'Exclusivo sabor nacional elaborado con lúcuma premium.' },
  { id: 'chocolate', name: 'Chocolate Belga', price: 1.5, color: '#574b90', isPremium: true, active: true, description: 'Intenso y cremoso helado con cacao al 70% de origen selecto.' },
  { id: 'coco', name: 'Coco Loco', price: 1.5, color: '#f5f6fa', isPremium: true, active: true, description: 'Cremoso y exótico helado de coco rallado y leche condensada.' }
];

export const INITIAL_BASES = [
  { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0.0, icon: '🍦', description: 'El clásico barquillo de galleta dulce.' },
  { id: 'vaso', name: 'Vaso Eco-Amigable', price: 0.0, icon: '🍧', description: 'Vaso de cartón biodegradable con cucharita.' },
  { id: 'waffle', name: 'Copa Waffle Artesanal', price: 1.5, icon: '🧇', description: 'Copa comestible crujiente hecha a mano (+S/. 1.50).' }
];

export const INITIAL_TOPPINGS = [
  { id: 'chispas', name: 'Chispas de Colores', price: 0.5, category: 'solido', active: true },
  { id: 'oreo', name: 'Trozos de Galleta Oreo', price: 0.5, category: 'solido', active: true },
  { id: 'mani', name: 'Maní Tostado Crujiente', price: 0.5, category: 'solido', active: true },
  { id: 'gomitas', name: 'Gomitas de Oso', price: 0.5, category: 'solido', active: true },
  { id: 'fudge', name: 'Fudge de Chocolate Caliente', price: 0.5, category: 'liquido', active: true },
  { id: 'fresa_sauce', name: 'Salsa de Fresa Dulce', price: 0.5, category: 'liquido', active: true },
  { id: 'manjar', name: 'Hilos de Manjar Blanco', price: 0.5, category: 'liquido', active: true }
];

export const INITIAL_PACKS = [
  {
    id: 'pack_ahorro',
    name: 'Pack Ahorro Familiar',
    description: 'Perfecto para compartir en familia. Incluye 5 helados clásicos de 1 bola (cono o vaso) con toppings gratis.',
    price: 6.0,
    items: '5 Helados de 1 bola + Toppings clásicos',
    active: true,
    discountText: '¡Ahorra S/. 1.50!',
    badge: 'Popular'
  },
  {
    id: 'pack_pareja',
    name: 'Pack Dúo Romántico',
    description: 'Ideal para dos personas. Contiene 2 Copas Waffle artesanales con 3 bolas de helado premium a elección y salsa de fudge.',
    price: 10.0,
    items: '2 Copas Waffle de 3 bolas + Fudge de chocolate gratis',
    active: true,
    discountText: '¡Ahorra S/. 2.00!',
    badge: 'Favorito'
  },
  {
    id: 'pack_mega_fiesta',
    name: 'Pack Mega Fiesta Helada',
    description: '¡La fiesta definitiva! 12 barquillos clásicos de 1 bola con variedad de sabores y frascos de toppings y jarabes para compartir.',
    price: 15.0,
    items: '12 Helados clásicos + Kit de Toppings y salsas independientes',
    active: true,
    discountText: '¡El más económico!',
    badge: 'Super Ahorro'
  }
];

export const INITIAL_ORDERS = [
  {
    id: 'PED-1001',
    customer: {
      name: 'Carlos Mendoza',
      phone: '987654321',
      address: 'Av. Larco 456, Miraflores',
      paymentMethod: 'Yape'
    },
    items: [
      {
        type: 'custom',
        base: { id: 'cono', name: 'Cono de Galleta Crujiente', price: 0 },
        scoops: [
          { id: 'lucuma', name: 'Lúcuma de Seda', price: 1.5 },
          { id: 'chocolate', name: 'Chocolate Belga', price: 1.5 }
        ],
        toppings: [
          { id: 'chispas', name: 'Chispas de Colores', price: 0.5 },
          { id: 'fudge', name: 'Fudge de Chocolate Caliente', price: 0.5 }
        ],
        price: 4.0,
        quantity: 1
      }
    ],
    total: 4.0,
    deliveryFee: 2.0,
    grandTotal: 6.0,
    status: 'Pendiente', // Pendiente, Preparando, En camino, Entregado, Cancelado
    date: new Date(Date.now() - 30 * 60 * 1000).toISOString() // hace 30 minutos
  },
  {
    id: 'PED-1002',
    customer: {
      name: 'Sofía Rodríguez',
      phone: '955412896',
      address: 'Jr. Junín 1025, Magdalena',
      paymentMethod: 'Plin'
    },
    items: [
      {
        type: 'pack',
        id: 'pack_pareja',
        name: 'Pack Dúo Romántico',
        price: 10.0,
        quantity: 1
      }
    ],
    total: 10.0,
    deliveryFee: 3.0,
    grandTotal: 13.0,
    status: 'Preparando',
    date: new Date(Date.now() - 15 * 60 * 1000).toISOString() // hace 15 minutos
  }
];
