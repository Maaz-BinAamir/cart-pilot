import { NextResponse } from "next/server";
import { z } from "zod";
import { createStore } from "@/src/lib/store";

const actionSchema = z.union([
  z.object({ productId: z.string(), stock: z.number().int().min(0).max(100000).optional(), price: z.number().min(1).max(1000000).optional(), shippingDays: z.number().int().min(1).max(3650).optional() }),
  z.object({ orderId: z.string(), status: z.enum(["processing", "packed", "shipped", "delivered", "cancelled"]).optional(), delayDays: z.number().int().min(1).max(3650).optional() }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = createStore(body.session);
    const action = actionSchema.parse(body);
    const result = "orderId" in action ? store.updateOrder(action) : store.updateProduct(action);
    if ("error" in result) return NextResponse.json(result, { status: 404 });
    return NextResponse.json(store.getPublicStore(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid demo update." }, { status: 400 });
    }
    throw error;
  }
}
