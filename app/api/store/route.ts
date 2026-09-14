import { NextResponse } from "next/server";
import { z } from "zod";
import { createStore } from "@/src/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(createStore().getPublicStore(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const { session } = await request.json();
    return NextResponse.json(createStore(session).getPublicStore(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid demo session." }, { status: 400 });
    }
    throw error;
  }
}
