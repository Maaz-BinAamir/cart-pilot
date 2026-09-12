import { NextResponse } from "next/server";
import { getPublicStore } from "@/src/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPublicStore());
}

