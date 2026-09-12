"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import {
  ArrowRight,
  Check,
  CircleDot,
  MessageSquare,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Star,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, type ReactNode, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/src/data/catalog";
import type { Order, StoreEvent } from "@/src/lib/store";
import { ProductArt } from "./product-art";
import { ChatMarkdown } from "./chat-markdown";

type StorePayload = {
  products: Product[];
  orders: Array<Order & { cancellationEligible: boolean }>;
  events: StoreEvent[];
  apiConfigured: boolean;
  model: string;
};

const suggestedPrompts = [
  "A light laptop under $900 for university, needed by Friday",
  "Compare your best noise-cancelling headphones under $200",
  "Find a travel camera with strong autofocus",
];

const categoryFilters = ["All", "Laptops", "Audio", "Phones", "Gaming", "Cameras", "Accessories"] as const;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const transport = new DefaultChatTransport({ api: "/api/chat" });
const chatStorageKey = "cart-pilot-messages";

function isStoredMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UIMessage>;
  return typeof candidate.id === "string"
    && (candidate.role === "user" || candidate.role === "assistant" || candidate.role === "system")
    && Array.isArray(candidate.parts);
}

function restoreChat(value: string): UIMessage[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];

  const messages = parsed.filter(isStoredMessage);
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  if (lastUserIndex < 0) return messages;

  const hasUsableResponse = messages.slice(lastUserIndex + 1).some((message) => {
    if (message.role !== "assistant") return false;
    return message.parts.some((part) => {
      if (part.type === "text") return part.text.trim().length > 0;
      if (!part.type.startsWith("tool-") && part.type !== "dynamic-tool") return false;
      return (part as { state?: string }).state === "approval-requested";
    });
  });

  return hasUsableResponse ? messages : messages.slice(0, lastUserIndex);
}

function ToolActivity({ part, products, onApproval }: {
  part: Record<string, unknown>;
  products: Product[];
  onApproval: (id: string, approved: boolean) => void;
}) {
  const type = String(part.type ?? "tool").replace("tool-", "");
  const state = String(part.state ?? "");
  const input = (part.input ?? {}) as { productId?: string; quantity?: number; orderId?: string };
  const approval = part.approval as { id?: string; approved?: boolean } | undefined;
  const product = products.find((item) => item.id === input.productId);
  const requiresDecision = state === "approval-requested" && approval?.id;

  if (requiresDecision && (type === "placeOrder" || type === "cancelOrder")) {
    return (
      <section className="approval-card">
        <div className="approval-kicker"><ShieldCheck size={14} /> Approval required</div>
        <h3>{type === "placeOrder" ? "Confirm simulated checkout" : "Confirm cancellation"}</h3>
        {product ? (
          <div className="approval-product">
            <span className="approval-swatch" style={{ background: product.accent }} />
            <div>
              <strong>{product.brand} {product.name}</strong>
              <small>{input.quantity ?? 1} × {money.format(product.price)}</small>
            </div>
            <b>{money.format(product.price * (input.quantity ?? 1))}</b>
          </div>
        ) : null}
        {type === "placeOrder" ? (
          <dl className="approval-facts">
            <div><dt>Deliver to</dt><dd>18 Mercer Street, Brooklyn</dd></div>
            <div><dt>Payment</dt><dd>Simulated •••• 4242</dd></div>
          </dl>
        ) : <p className="approval-copy">Cancel order {input.orderId}. Eligible stock will be restored.</p>}
        <p className="simulation-note">No real payment will be made.</p>
        <div className="approval-actions">
          <button className="button-primary" onClick={() => onApproval(approval.id!, true)}><Check size={16} /> Approve</button>
          <button className="button-quiet" onClick={() => onApproval(approval.id!, false)}><X size={16} /> Decline</button>
        </div>
      </section>
    );
  }

  const labels: Record<string, string> = {
    searchProducts: "Searched live catalog",
    getProduct: "Read product details",
    compareProducts: "Compared current options",
    checkInventory: "Verified price and inventory",
    placeOrder: state === "output-available" ? "Order placed" : "Preparing checkout",
    listOrders: "Checked your orders",
    getOrder: "Read delivery tracking",
    cancelOrder: state === "output-available" ? "Order cancelled" : "Checking cancellation",
  };

  return (
    <div className={`tool-activity ${state === "output-available" ? "tool-complete" : ""}`}>
      {state === "output-available" ? <Check size={13} /> : <CircleDot size={13} />}
      <span>{labels[type] ?? "Using commerce tool"}</span>
      <code>{type}</code>
    </div>
  );
}

function ChatMessage({ message, products, onApproval }: {
  message: UIMessage;
  products: Product[];
  onApproval: (id: string, approved: boolean) => void;
}) {
  const isUser = message.role === "user";
  return (
    <article className={`message ${isUser ? "message-user" : "message-agent"}`}>
      <div className="message-avatar" aria-hidden="true">{isUser ? <UserRound size={15} /> : <span className="message-brand-mark" />}</div>
      <div className="message-content">
        <span className="message-author">{isUser ? "You" : "Cart Pilot"}</span>
        {message.parts.map((part, index) => {
          if (part.type === "text") return isUser
            ? <p key={index} className="message-text">{part.text}</p>
            : <ChatMarkdown key={index} text={part.text} />;
          if (part.type === "reasoning") return null;
          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
            return <ToolActivity key={index} part={part as unknown as Record<string, unknown>} products={products} onApproval={onApproval} />;
          }
          return null;
        })}
      </div>
    </article>
  );
}

function ProductCard({ product, onOpen, onAsk, preload = false }: { product: Product; onOpen: () => void; onAsk: () => void; preload?: boolean }) {
  return (
    <article className="product-card">
      <button className="product-open" onClick={onOpen} aria-label={`View ${product.name}`}>
        <ProductArt product={product} preload={preload} />
      </button>
      <div className="product-card-body">
        <div className="product-meta"><span>{product.brand}</span><span><Star size={11} fill="currentColor" /> {product.rating}</span></div>
        <h3>{product.name}</h3>
        <p>{product.shortDescription}</p>
        <div className="product-bottom">
          <div><strong>{money.format(product.price)}</strong>{product.compareAtPrice ? <del>{money.format(product.compareAtPrice)}</del> : null}</div>
          <button className="ask-button" onClick={onAsk}>Ask Pilot <ArrowRight size={13} /></button>
        </div>
        <span className={`stock-line ${product.stock === 0 ? "stock-out" : product.stock < 5 ? "stock-low" : ""}`}>
          {product.stock === 0 ? "Out of stock" : product.stock < 5 ? `Only ${product.stock} left` : `${product.stock} in stock`} · ships in {product.shippingDays}d
        </span>
      </div>
    </article>
  );
}

function ProductDetail({ product, onClose, onAsk }: { product: Product; onClose: () => void; onAsk: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="product-detail" role="dialog" aria-modal="true" aria-label={`${product.brand} ${product.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="Close product details" onClick={onClose}><X size={18} /></button>
        <ProductArt product={product} preload sizes="(max-width: 760px) 90vw, 470px" />
        <div className="detail-copy">
          <span className="eyebrow">{product.category} / {product.brand}</span>
          <h2>{product.name}</h2>
          <p className="detail-description">{product.shortDescription}</p>
          <div className="detail-price"><strong>{money.format(product.price)}</strong><span><Star size={14} fill="currentColor" /> {product.rating} from {product.reviewCount} ratings</span></div>
          <dl className="spec-grid">
            {Object.entries(product.specs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          </dl>
          <button className="button-primary detail-ask" onClick={onAsk}><MessageSquare size={16} /> Ask Cart Pilot about this</button>
          <div className="review-section">
            <div className="review-heading"><h3>Customer reviews</h3><span>Demo reviews</span></div>
            {product.reviews.map((review) => (
              <article className="review" key={review.id}>
                <div><strong>{review.title}</strong><span>{"★".repeat(review.rating)}</span></div>
                <p>{review.body}</p>
                <small>{review.author} {review.verified ? "· verified demo buyer" : ""}</small>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function OrdersList({ orders, onAsk }: { orders: StorePayload["orders"]; onAsk: (prompt: string) => void }) {
  return (
    <section className="orders-view">
      <span className="eyebrow">Order history</span>
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <div className="empty-orders"><PackageCheck size={30} /><h3>No orders yet</h3><p>Ask Cart Pilot to find something, then approve the checkout card.</p></div>
      ) : orders.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-head">
            <div><small>{order.id}</small><h3>{order.productBrand} {order.productName}</h3></div>
            <span className={`status status-${order.status}`}>{order.status}</span>
          </div>
          <div className="order-facts">
            <div><span>Order total</span><strong>{money.format(order.total)}</strong></div>
            <div><span>Expected</span><strong>{new Date(`${order.eta}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong></div>
            <div><span>Payment</span><strong>•••• 4242</strong></div>
          </div>
          <div className="order-timeline">
            {order.events.slice(0, 3).map((event, index) => <div key={event.id} className={index === 0 ? "active" : ""}><i /><span><strong>{event.label}</strong><small>{event.detail}</small></span></div>)}
          </div>
          <div className="order-actions">
            <button className="button-quiet" onClick={() => onAsk(`Track order ${order.id} and tell me if anything changed.`)}><Truck size={15} /> Ask for update</button>
            {order.cancellationEligible ? <button className="text-danger" onClick={() => onAsk(`Please cancel order ${order.id}.`)}>Cancel order</button> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

function useShoppingState() {
  const router = useRouter();
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const [store, setStore] = useState<StorePayload | null>(null);
  const [input, setInput] = useState("");

  const [category, setCategory] = useState<(typeof categoryFilters)[number]>("All");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshStore = useCallback(async () => {
    const response = await fetch("/api/store", { cache: "no-store" });
    if (response.ok) setStore(await response.json());
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      void refreshStore();
    }
  }, [pathname, refreshStore]);

  const { messages, sendMessage, status, addToolApprovalResponse, setMessages, clearError, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: refreshStore,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/store", { cache: "no-store" })
      .then((response) => response.json())
      .then((next: StorePayload) => {
        if (active) setStore(next);
      });
    const saved = window.localStorage.getItem(chatStorageKey);
    queueMicrotask(() => {
      if (!active) return;
      if (saved) {
        try {
          const restored = restoreChat(saved);
          setMessages(restored);
          if (restored.length) window.localStorage.setItem(chatStorageKey, JSON.stringify(restored));
          else window.localStorage.removeItem(chatStorageKey);
        } catch {
          window.localStorage.removeItem(chatStorageKey);
        }
      }
      setHydrated(true);
    });
    return () => { active = false; };
  }, [setMessages]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, hydrated]);

  useEffect(() => {
    const refreshOnFocus = () => refreshStore();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refreshStore]);

  const products = useMemo(() => {
    const query = catalogSearch.toLowerCase();
    const matches = (store?.products ?? []).filter((product) => {
      const inCategory = category === "All" || product.category === category;
      const searchable = `${product.brand} ${product.name} ${product.shortDescription} ${product.tags.join(" ")}`.toLowerCase();
      return inCategory && (!query || searchable.includes(query));
    });
    return category === "All" ? matches.sort((a, b) => Number(a.id.split("-")[1]) - Number(b.id.split("-")[1])) : matches;
  }, [store?.products, category, catalogSearch]);

  const submitPrompt = useCallback((prompt: string) => {
    router.push("/chat");
    if (!prompt.trim() || status !== "ready" || !store?.apiConfigured) { setInput(prompt); return; }
    sendMessage({ text: prompt.trim() });
    setInput("");
  }, [router, sendMessage, status, store?.apiConfigured]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitPrompt(input);
  };

  const onApproval = async (id: string, approved: boolean) => {
    await addToolApprovalResponse({ id, approved, reason: approved ? "Shopper approved in the confirmation card." : "Shopper declined in the confirmation card." });
  };

  const clearChat = useCallback(() => {
    setMessages([]);
    setInput("");
    clearError();
    window.localStorage.removeItem(chatStorageKey);
  }, [clearError, setMessages]);

  const navigate = (next: "shop" | "chat" | "orders") => router.push("/" + next);
  const askAbout = (product: Product) => submitPrompt("Help me decide if the " + product.brand + " " + product.name + " is right for me. Check its current details first.");
  const featured = store?.products.find((product) => product.id === "aud-001");

  return { store, input, setInput, category, setCategory, catalogSearch, setCatalogSearch, visibleCount, setVisibleCount, products, featured, selectedProduct, setSelectedProduct, messages, status, error, scrollRef, submitPrompt, onSubmit, onApproval, clearChat, navigate, askAbout };
}

const ShoppingContext = createContext<ReturnType<typeof useShoppingState> | null>(null);

function useShopping() {
  const state = useContext(ShoppingContext);
  if (!state) throw new Error("Shopping views require ShoppingProvider");
  return state;
}

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const state = useShoppingState();
  const { setSelectedProduct } = state;
  const closeProduct = useCallback(() => setSelectedProduct(null), [setSelectedProduct]);
  return <ShoppingContext.Provider value={state}>
    {children}
    {state.selectedProduct ? <ProductDetail product={state.selectedProduct} onClose={closeProduct} onAsk={() => {
      const product = state.selectedProduct!;
      state.setSelectedProduct(null);
      state.askAbout(product);
    }} /> : null}
  </ShoppingContext.Provider>;
}

export function ShopScreen() {
  const { store, category, setCategory, catalogSearch, setCatalogSearch, visibleCount, setVisibleCount, products, featured, setSelectedProduct, navigate, askAbout } = useShopping();
  return (
        <section className="storefront">
          <div className="store-hero">
            <div className="hero-copy">
              <span className="eyebrow">Electronics for every day</span>
              <h1>Your next<br />good find<span>.</span></h1>
              <p>Find the tech that fits your life.<br />Need a hand choosing? Ask Pilot.</p>
              <button className="button-primary" onClick={() => navigate("chat")}>Help me choose <ArrowRight size={18} /></button>
            </div>
            <div className="hero-feature">
              {featured ? <button onClick={() => setSelectedProduct(featured)} aria-label="Explore Hush X1 headphones"><ProductArt product={featured} preload sizes="(max-width: 480px) 92vw, (max-width: 1408px) 50vw, 700px" /><div className="feature-caption"><span>Velora Hush X1<strong>Turn down the world.</strong></span><span className="feature-price">{money.format(featured.price)} <ArrowRight size={20} /></span></div></button> : <div className="catalog-loading">Loading collection...</div>}
            </div>
          </div>
          <div className="catalog-toolbar">
            <h2>Shop the collection <span>{products.length} {products.length === 1 ? "product" : "products"}</span></h2>
            <label className="catalog-search"><Search size={18} /><input aria-label="Search products" value={catalogSearch} onChange={(event) => { setCatalogSearch(event.target.value); setVisibleCount(12); }} placeholder="Search products" /></label>
          </div>
          <div className="category-row" aria-label="Product categories">
            {categoryFilters.map((item) => <button aria-pressed={category === item} className={category === item ? "active" : ""} key={item} onClick={() => { setCategory(item); setVisibleCount(12); }}>{item === "All" ? "All products" : item}</button>)}
          </div>
          <div className="product-grid">
            {products.slice(0, visibleCount).map((product) => <ProductCard key={product.id} product={product} onOpen={() => setSelectedProduct(product)} onAsk={() => askAbout(product)} />)}
          </div>
          {store && !products.length ? <div className="empty-results"><Search size={24} /><h3>No products found</h3><p>Try another search or category.</p><button className="button-quiet" onClick={() => { setCatalogSearch(""); setCategory("All"); }}>Clear filters</button></div> : null}
          {!store ? <p role="status">Loading products...</p> : null}
          {products.length > visibleCount ? <div className="catalog-more"><span>Showing {visibleCount} of {products.length}</span><button className="button-quiet" onClick={() => setVisibleCount((count) => count + 12)}>Show more <ArrowRight size={16} /></button></div> : null}
          <footer className="store-footer"><strong>cart pilot.</strong><span>Demo products, reviews, and purchases.</span></footer>
        </section>

  );
}
export function OrdersScreen() {
  const { store, submitPrompt, navigate } = useShopping();
  return (
        <div className="orders-layout"><OrdersList orders={store?.orders ?? []} onAsk={submitPrompt} /><button className="button-primary" onClick={() => navigate("shop")}>Browse products <ArrowRight size={16} /></button></div>

  );
}
export function ChatScreen() {
  const { store, input, setInput, messages, status, error, scrollRef, submitPrompt, onSubmit, onApproval, clearChat } = useShopping();
  return (
        <section className="chat-layout">
          <div className="conversation-panel">
            <div className="conversation-head">
              <h1><MessageSquare size={18} /> Ask Pilot</h1>
              <div className="conversation-head-actions">
                {messages.length ? <button type="button" onClick={clearChat} disabled={status === "submitted" || status === "streaming"}><RefreshCw size={13} /> New chat</button> : null}
              </div>
            </div>
            {store && !store.apiConfigured ? <div className="setup-banner"><strong>Chat is unavailable.</strong><span>Please try again later. You can still browse products and view your orders.</span></div> : null}
            <div className={"message-stream " + (messages.length === 0 ? "message-stream-empty" : "")} ref={scrollRef}>
              {messages.length === 0 ? <div className="conversation-starter"><h2>What are you looking for?</h2><div className="prompt-stack">{suggestedPrompts.map((prompt) => <button key={prompt} onClick={() => submitPrompt(prompt)}>{prompt}<ArrowRight size={16} /></button>)}</div></div> : messages.map((message) => <ChatMessage key={message.id} message={message} products={store?.products ?? []} onApproval={onApproval} />)}
              {status === "submitted" ? <div className="thinking" role="status">Checking the store...</div> : null}
              {error ? <div className="chat-error" role="alert">The request failed. {error.message}</div> : null}
            </div>
            <form className="composer" onSubmit={onSubmit}><input aria-label="Message Pilot" value={input} onChange={(event) => setInput(event.target.value)} disabled={!store?.apiConfigured || status !== "ready"} placeholder="What do you have in mind?" /><button aria-label="Send message" type="submit" disabled={!input.trim() || status !== "ready" || !store?.apiConfigured}><Send size={18} /></button></form>

          </div>
        </section>

  );
}



