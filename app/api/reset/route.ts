import { NextResponse } from "next/server";
import { createStore } from "@/src/lib/store";

export async function POST() {
  return NextResponse.json(createStore().getPublicStore(), { headers: { "Cache-Control": "no-store" } });
}
