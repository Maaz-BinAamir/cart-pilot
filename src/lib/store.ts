import { catalog, type Category, type Product } from "@/src/data/catalog";
import { demoSessionSchema, type DemoSession } from "./demo-session";

export type OrderStatus = "processing" | "packed" | "shipped" | "delivered" | "cancelled";

export type OrderEvent = {
  id: string;
  label: string;
  detail: string;
  at: string;
};

export type Order = {
  id: string;
  productId: string;
  productName: string;
  productBrand: string;
  productAccent: string;
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  eta: string;
  address: string;
  paymentLabel: string;
  createdAt: string;
  checkoutId?: string;
  events: OrderEvent[];
};

export type StoreEvent = {
  id: string;
  kind: "stock" | "price" | "shipping" | "order" | "reset";
  message: string;
  at: string;
};

type StoreState = {
  products: Product[];
  orders: Order[];
  events: StoreEvent[];
};

const initialProducts = () => catalog.map((product) => ({
  ...product,
  specs: { ...product.specs },
  reviews: product.reviews.map((review) => ({ ...review })),
}));

const createState = (): StoreState => ({
  products: initialProducts(),
  orders: [],
  events: [{
    id: "event-welcome",
    kind: "reset",
    message: "Demo store initialized with 72 products.",
    at: new Date().toISOString(),
  }],
});

const money = (value: number) => Math.round(value * 100) / 100;

const futureDate = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const productSummary = (product: Product) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: product.category,
  price: product.price,
  compareAtPrice: product.compareAtPrice,
  rating: product.rating,
  reviewCount: product.reviewCount,
  stock: product.stock,
  shippingDays: product.shippingDays,
  estimatedArrival: futureDate(product.shippingDays),
  shortDescription: product.shortDescription,
  tags: product.tags,
  specs: product.specs,
});

// Every request gets its own store, reconstructed from this tab's demo snapshot.
// Client snapshots are validated demo data, not authenticated purchase records.
export function createStore(input?: unknown) {
  const session = input == null ? null : demoSessionSchema.parse(input);
  const state = createState();
  if (session) {
    const changes = new Map(session.products.map((product) => [product.id, product]));
    for (const product of state.products) Object.assign(product, changes.get(product.id));
    state.orders = session.orders;
    state.events = session.events;
  }
  const getStore = () => state;
  const getSession = (): DemoSession => ({
    version: 1,
    products: state.products.map(({ id, stock, price, shippingDays }) => ({ id, stock, price, shippingDays })),
    orders: state.orders.map((order) => ({ ...order, events: order.events.slice(0, 20) })),
    events: state.events.slice(0, 20),
  });
  const resetStore = () => Object.assign(state, createState());
  const searchProducts = (input: {
    query?: string;
    category?: Category;
    minPrice?: number;
    maxPrice?: number;
    mustArriveBy?: string;
    limit?: number;
  }) => {
    const terms = (input.query ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const deadline = input.mustArriveBy ? new Date(`${input.mustArriveBy}T23:59:59`) : null;
    const products = getStore().products
      .filter((product) => !input.category || product.category === input.category)
      .filter((product) => input.minPrice === undefined || product.price >= input.minPrice)
      .filter((product) => input.maxPrice === undefined || product.price <= input.maxPrice)
      .filter((product) => !deadline || new Date(`${futureDate(product.shippingDays)}T12:00:00`) <= deadline)
      .map((product) => {
        const haystack = [
          product.name,
          product.brand,
          product.category,
          product.shortDescription,
          ...product.tags,
          ...Object.values(product.specs),
        ].join(" ").toLowerCase();
        const matches = terms.reduce((score, term) => score + (haystack.includes(term) ? 3 : 0), 0);
        const stockScore = product.stock > 0 ? 2 : -20;
        const valueScore = product.compareAtPrice ? 1 : 0;
        return { product, score: matches + stockScore + valueScore + product.rating / 10 };
      })
      .filter(({ score }) => terms.length === 0 || score > -10)
      .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
      .slice(0, Math.min(input.limit ?? 6, 10))
      .map(({ product }) => productSummary(product));

    return { count: products.length, products };
  };

  const getProduct = (productId: string) => {
    const product = getStore().products.find((item) => item.id === productId);
    if (!product) return { error: `Product ${productId} was not found.` };
    return {
      ...productSummary(product),
      reviews: product.reviews,
    };
  };

  const compareProducts = (productIds: string[]) => ({
    products: productIds
      .slice(0, 4)
      .map((id) => getStore().products.find((product) => product.id === id))
      .filter((product): product is Product => Boolean(product))
      .map(productSummary),
  });

  const checkInventory = (productId: string, quantity = 1) => {
    const product = getStore().products.find((item) => item.id === productId);
    if (!product) return { available: false, error: `Product ${productId} was not found.` };
    return {
      available: product.stock >= quantity,
      productId,
      productName: `${product.brand} ${product.name}`,
      requestedQuantity: quantity,
      stock: product.stock,
      unitPrice: product.price,
      total: money(product.price * quantity),
      shippingDays: product.shippingDays,
      estimatedArrival: futureDate(product.shippingDays),
    };
  };

  const placeOrder = (productId: string, quantity = 1, checkoutId?: string): Order | { error: string } => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) return { error: "Choose a quantity between 1 and 5." };
    const existing = checkoutId ? getStore().orders.find((order) => order.checkoutId === checkoutId) : undefined;
    if (existing) return existing.productId === productId && existing.quantity === quantity ? existing : { error: "This checkout was already used." };
    if (getStore().orders.length >= 100) return { error: "This demo has reached its order limit. Reset the demo to start again." };
    const state = getStore();
    const product = state.products.find((item) => item.id === productId);
    if (!product) return { error: `Product ${productId} was not found.` };
    if (product.stock < quantity) {
      return { error: `Only ${product.stock} units remain. The order was not placed.` };
    }

    product.stock -= quantity;
    const now = new Date().toISOString();
    const order: Order = {
      id: "CP-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
      checkoutId,
      productId,
      productName: product.name,
      productBrand: product.brand,
      productAccent: product.accent,
      quantity,
      unitPrice: product.price,
      total: money(product.price * quantity),
      status: "processing",
      eta: futureDate(product.shippingDays),
      address: "18 Mercer Street, Brooklyn, NY 11201",
      paymentLabel: "Simulated card ending in 4242",
      createdAt: now,
      events: [{
        id: `${now}-confirmed`,
        label: "Order confirmed",
        detail: "Payment simulation approved. The warehouse has the order.",
        at: now,
      }],
    };
    state.orders.unshift(order);
    state.events.unshift({
      id: `${now}-order`,
      kind: "order",
      message: `${order.id} placed for ${product.brand} ${product.name}.`,
      at: now,
    });
    return order;
  };

  const getOrder = (orderId: string) => {
    const order = getStore().orders.find((item) => item.id.toLowerCase() === orderId.toLowerCase());
    if (!order) return { error: `Order ${orderId} was not found.` };
    return { ...order, cancellationEligible: ["processing", "packed"].includes(order.status) };
  };

  const cancelOrder = (orderId: string) => {
    const state = getStore();
    const order = state.orders.find((item) => item.id.toLowerCase() === orderId.toLowerCase());
    if (!order) return { cancelled: false, error: `Order ${orderId} was not found.` };
    if (!["processing", "packed"].includes(order.status)) {
      return { cancelled: false, error: `${order.id} is already ${order.status} and is no longer eligible for cancellation.` };
    }
    order.status = "cancelled";
    const product = state.products.find((item) => item.id === order.productId);
    if (product) product.stock += order.quantity;
    const now = new Date().toISOString();
    order.events.unshift({
      id: `${now}-cancelled`,
      label: "Order cancelled",
      detail: "The simulated payment hold was released and stock was restored.",
      at: now,
    });
    state.events.unshift({ id: `${now}-cancel`, kind: "order", message: `${order.id} was cancelled.`, at: now });
    return { cancelled: true, orderId: order.id, status: order.status };
  };

  const updateProduct = (input: { productId: string; stock?: number; price?: number; shippingDays?: number }) => {
    const state = getStore();
    const product = state.products.find((item) => item.id === input.productId);
    if (!product) return { error: `Product ${input.productId} was not found.` };
    const changes: string[] = [];
    if (input.stock !== undefined) {
      product.stock = Math.max(0, Math.floor(input.stock));
      changes.push(`inventory set to ${product.stock}`);
    }
    if (input.price !== undefined) {
      product.price = money(Math.max(1, input.price));
      changes.push(`price set to $${product.price}`);
    }
    if (input.shippingDays !== undefined) {
      product.shippingDays = Math.max(1, Math.floor(input.shippingDays));
      changes.push(`shipping set to ${product.shippingDays} days`);
    }
    const now = new Date().toISOString();
    state.events.unshift({
      id: `${now}-${product.id}`,
      kind: input.stock !== undefined ? "stock" : input.price !== undefined ? "price" : "shipping",
      message: `${product.brand} ${product.name}: ${changes.join(", ")}.`,
      at: now,
    });
    return productSummary(product);
  };

  const updateOrder = (input: { orderId: string; status?: OrderStatus; delayDays?: number }) => {
    const state = getStore();
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) return { error: `Order ${input.orderId} was not found.` };
    const now = new Date().toISOString();
    if (input.status) {
      order.status = input.status;
      order.events.unshift({ id: `${now}-status`, label: `Order ${input.status}`, detail: `Admin simulation moved this order to ${input.status}.`, at: now });
    }
    if (input.delayDays && input.delayDays > 0) {
      const eta = new Date(`${order.eta}T12:00:00`);
      eta.setDate(eta.getDate() + Math.floor(input.delayDays));
      order.eta = eta.toISOString().slice(0, 10);
      order.events.unshift({ id: `${now}-delay`, label: "Delivery delayed", detail: `Expected arrival moved by ${input.delayDays} days.`, at: now });
    }
    state.events.unshift({ id: `${now}-${order.id}`, kind: "shipping", message: `${order.id} was updated by the admin simulation.`, at: now });
    return getOrder(order.id);
  };

  const listOrders = () => getStore().orders.map((order) => ({
    ...order,
    cancellationEligible: ["processing", "packed"].includes(order.status),
  }));

  const getPublicStore = () => ({
    session: getSession(),
    products: getStore().products,
    orders: listOrders(),
    events: getStore().events.slice(0, 20),
    apiConfigured: Boolean(process.env.GROQ_API_KEY),
    model: process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
  });


  return { getStore, getSession, resetStore, searchProducts, getProduct, compareProducts, checkInventory, placeOrder, getOrder, cancelOrder, updateProduct, updateOrder, listOrders, getPublicStore };
}
