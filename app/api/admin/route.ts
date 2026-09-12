import { NextResponse } from "next/server";
import { getPublicStore, updateOrder, updateProduct } from "@/src/lib/store";

export async function POST(request: Request) {
  const body = await request.json();
  const result = body.orderId ? updateOrder(body) : updateProduct(body);
  if ("error" in result) return NextResponse.json(result, { status: 404 });
  return NextResponse.json(getPublicStore());
}
