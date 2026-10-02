// Lane 4. GET /api/menu → active treats with recipes. POST /api/menu → add a treat (NewMenuItemInput).
import { handle } from "@/lib/api";
import { addMenuItem, listMenu } from "@/lib/catalog";
import type { NewMenuItemInput } from "@/lib/catalog/types";

export async function GET() {
  return handle(() => listMenu());
}

export async function POST(req: Request) {
  const body = (await req.json()) as NewMenuItemInput;
  return handle(() => addMenuItem(body));
}
