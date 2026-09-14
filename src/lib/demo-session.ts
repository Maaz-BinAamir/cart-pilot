import { z } from "zod";

const text = z.string().max(1000);
const event = z.object({ id: text, label: text, detail: text, at: text });
export const demoSessionSchema = z.object({
  version: z.literal(1),
  products: z.array(z.object({
    id: z.string().max(100),
    stock: z.number().int().min(0).max(100000),
    price: z.number().min(1).max(1000000),
    shippingDays: z.number().int().min(1).max(3650),
  })).max(100),
  orders: z.array(z.object({
    id: text, checkoutId: text.optional(), productId: text, productName: text,
    productBrand: text, productAccent: text,
    quantity: z.number().int().min(1).max(5),
    unitPrice: z.number().nonnegative(), total: z.number().nonnegative(),
    status: z.enum(["processing", "packed", "shipped", "delivered", "cancelled"]),
    eta: text, address: text, paymentLabel: text, createdAt: text,
    events: z.array(event).max(20),
  })).max(100),
  events: z.array(z.object({
    id: text, kind: z.enum(["stock", "price", "shipping", "order", "reset"]),
    message: text, at: text,
  })).max(20),
});
export type DemoSession = z.infer<typeof demoSessionSchema>;
