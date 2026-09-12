import { NextResponse } from "next/server";
import { getPublicStore, resetStore } from "@/src/lib/store";

export async function POST() {
  resetStore();
  return NextResponse.json(getPublicStore());
}

