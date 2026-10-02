// Lane 1. POST /api/pricewatch/photo (multipart): photo=<image file>, competitorName=<optional, default "The Bakery">
// Claude reads the menu → prices recorded → { prices, advice }. 503 if no Anthropic credentials are set up.
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { addCompetitor, recordPrices } from "@/lib/pricewatch";
import { MenuReaderUnavailableError, readMenuPhoto, SUPPORTED_MEDIA_TYPES, type MenuMediaType } from "@/lib/pricewatch/vision";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const photo = form.get("photo");
  const competitorName = String(form.get("competitorName") ?? "The Bakery");
  return handle(async () => {
    if (!(photo instanceof File)) return NextResponse.json({ error: "Send the menu image as a 'photo' field" }, { status: 400 });
    if (!SUPPORTED_MEDIA_TYPES.includes(photo.type as MenuMediaType)) {
      return NextResponse.json({ error: `Unsupported image type ${photo.type || "(none)"}` }, { status: 415 });
    }
    if (photo.size > MAX_BYTES) return NextResponse.json({ error: "Photo is over 5MB" }, { status: 413 });
    try {
      const items = await readMenuPhoto({ base64: Buffer.from(await photo.arrayBuffer()).toString("base64"), mediaType: photo.type as MenuMediaType });
      return recordPrices(addCompetitor(competitorName).id, items, "photo");
    } catch (err) {
      if (err instanceof MenuReaderUnavailableError) return NextResponse.json({ error: err.message }, { status: 503 });
      throw err;
    }
  });
}
