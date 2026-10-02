// Lane 1. POST /api/pricewatch/roast/post: the "Post to Google" button. It never posts.
// Always 418 I'm a Teapot, with Nonna's veto as the punchline.
import { NextResponse } from "next/server";
import { postRoast } from "@/lib/pricewatch/roast";

export async function POST(req: Request) {
  const { seed } = (await req.json().catch(() => ({}))) as { seed?: number };
  return NextResponse.json(postRoast(seed), { status: 418 });
}
