import { NextResponse } from "next/server";
import { updateOrder, updateProduct } from "@/src/lib/store";

export async function POST(request: Request) {
  const body = await request.json();
  const result = body.orderId ? updateOrder(body) : updateProduct(body);
  const hasError = "error" in result;
  return NextResponse.json(result, { status: hasError ? 404 : 200 });
}

