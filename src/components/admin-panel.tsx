"use client";

import {
  Activity,

  Boxes,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  RefreshCw,
  Search,
  TriangleAlert,
  Truck,
  Zap,
} from "lucide-react";

import { useMemo, useState } from "react";
import { useShopping } from "./shopping-workspace";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function AdminPanel() {
  const { store, storeError, refreshStore, runStoreAction, status } = useShopping();
  const busy = status === "submitted" || status === "streaming";
  const [selectedProductId, setSelectedProductId] = useState("");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState("");
  const [toast, setToast] = useState("");

  const selectedProduct = store?.products.find((product) => product.id === selectedProductId) ?? store?.products[0];
  const visibleProducts = useMemo(() => {
    const term = query.toLowerCase();
    return (store?.products ?? []).filter((product) => `${product.brand} ${product.name} ${product.category}`.toLowerCase().includes(term));
  }, [query, store?.products]);

  const mutate = async (label: string, body: Record<string, unknown>) => {
    setPending(label);
    try {
      await runStoreAction("/api/admin", body);
      setToast(label);
      window.setTimeout(() => setToast(""), 2400);
    } catch {
      setToast("The update failed");
      window.setTimeout(() => setToast(""), 2400);
    } finally {
      setPending("");
    }
  };

  const reset = async () => {
    setPending("Resetting demo");
    try {
      await runStoreAction("/api/reset");
      setToast("Demo store reset");
      window.setTimeout(() => setToast(""), 2400);
    } catch {
      setToast("The reset failed");
      window.setTimeout(() => setToast(""), 2400);
    } finally {
      setPending("");
    }
  };

  const totalStock = store?.products.reduce((sum, product) => sum + product.stock, 0) ?? 0;
  const lowStock = store?.products.filter((product) => product.stock < 5).length ?? 0;
  const orderValue = store?.orders.reduce((sum, order) => sum + order.total, 0) ?? 0;

  return (
    <main className="admin-shell">
      {storeError ? <div className="catalog-error" role="alert"><p>The demo could not be loaded.</p><button onClick={() => void refreshStore()}>Try again</button></div> : null}
      {busy ? <p role="status">Wait for the chat response to finish before changing the demo.</p> : null}

      <section className="admin-title">
        <div><span className="eyebrow">Store administration</span><h1>Inventory & orders</h1><p>Manage products and test changes in the demo store.</p></div>
        <button className="button-quiet" onClick={reset} disabled={Boolean(pending) || busy}><RefreshCw size={15} /> Reset demo</button>
      </section>

      <section className="metric-grid">
        <article><div><Boxes size={18} /><span>Units available</span></div><strong>{totalStock}</strong><small>across 72 fictional products</small></article>
        <article><div><TriangleAlert size={18} /><span>Low-stock products</span></div><strong>{lowStock}</strong><small>fewer than five units</small></article>
        <article><div><PackageCheck size={18} /><span>Simulated orders</span></div><strong>{store?.orders.length ?? 0}</strong><small>{money.format(orderValue)} demonstration value</small></article>
      </section>

      <div className="admin-layout">
        <section className="inventory-section">
          <div className="section-heading"><div><span className="eyebrow">Live catalog</span><h2>Products</h2></div><label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Find a product" placeholder="Find a product" /></label></div>
          <div className="inventory-table">
            <div className="inventory-row inventory-header"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Delivery</span></div>
            {visibleProducts.map((product) => (
              <button className={`inventory-row ${selectedProductId === product.id ? "selected" : ""}`} key={product.id} onClick={() => setSelectedProductId(product.id)}>
                <span className="inventory-product"><i style={{ background: product.accent }} /><b>{product.brand} {product.name}</b><small>{product.id}</small></span>
                <span>{product.category}</span>
                <span>{money.format(product.price)}</span>
                <span className={product.stock === 0 ? "danger" : product.stock < 5 ? "warning" : ""}>{product.stock}</span>
                <span>{product.shippingDays} days</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="scenario-panel">
          <div className="section-heading"><div><span className="eyebrow">Selected product</span><h2>Edit product</h2></div><Activity size={18} /></div>
          {selectedProduct ? (
            <>
              <div className="scenario-product">
                <i style={{ background: selectedProduct.accent }} />
                <div><small>{selectedProduct.category}</small><strong>{selectedProduct.brand} {selectedProduct.name}</strong><span>{money.format(selectedProduct.price)} · {selectedProduct.stock} in stock · {selectedProduct.shippingDays}d</span></div>
              </div>
              <div className="scenario-group">
                <div><Boxes size={16} /><span><strong>Stock</strong><small>Update available units.</small></span></div>
                <div className="scenario-actions">
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Product sold out", { productId: selectedProduct.id, stock: 0 })}>Sell out</button>
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Stock reduced to two", { productId: selectedProduct.id, stock: 2 })}>Only 2 left</button>
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Product restocked", { productId: selectedProduct.id, stock: 24 })}>Restock</button>
                </div>
              </div>
              <div className="scenario-group">
                <div><CircleDollarSign size={16} /><span><strong>Price</strong><small>Adjust the current price.</small></span></div>
                <div className="scenario-actions">
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Price increased 15%", { productId: selectedProduct.id, price: Math.round(selectedProduct.price * 1.15) })}>Raise 15%</button>
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Price reduced 10%", { productId: selectedProduct.id, price: Math.round(selectedProduct.price * 0.9) })}>Drop 10%</button>
                </div>
              </div>
              <div className="scenario-group">
                <div><Clock3 size={16} /><span><strong>Delivery</strong><small>Set the shipping estimate.</small></span></div>
                <div className="scenario-actions">
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Shipping changed to seven days", { productId: selectedProduct.id, shippingDays: 7 })}>Set 7 days</button>
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate("Shipping changed to two days", { productId: selectedProduct.id, shippingDays: 2 })}>Set 2 days</button>
                </div>
              </div>
            </>
          ) : null}

          <div className="order-scenarios">
            <div className="scenario-title"><Truck size={16} /><span><strong>Orders in transit</strong><small>Delay or advance a placed order.</small></span></div>
            {store?.orders.length ? store.orders.map((order) => (
              <article key={order.id}>
                <div><strong>{order.id}</strong><span className={`status status-${order.status}`}>{order.status}</span></div>
                <p>{order.productBrand} {order.productName} · due {order.eta}</p>
                <div className="scenario-actions">
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate(`${order.id} delayed`, { orderId: order.id, delayDays: 3 })}>Delay 3d</button>
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate(`${order.id} packed`, { orderId: order.id, status: "packed" })}>Pack</button>
                  <button disabled={Boolean(pending) || busy} onClick={() => mutate(`${order.id} shipped`, { orderId: order.id, status: "shipped" })}>Ship</button>
                </div>
              </article>
            )) : <p className="no-orders-admin">Place an order in the shopper view to unlock delivery scenarios.</p>}
          </div>

        </aside>
      </div>

      {pending || toast ? (
        <div className="admin-toast" role="status" aria-live="polite">
          {pending ? <RefreshCw className="admin-pending-icon" size={15} /> : <Zap size={15} />}
          {pending ? pending === "Resetting demo" ? "Resetting demo..." : "Applying change..." : toast}
        </div>
      ) : null}
    </main>
  );
}


