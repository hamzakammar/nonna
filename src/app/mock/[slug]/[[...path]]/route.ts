// Lane 1. Serves the mock competitor websites (src/lib/pricewatch/fixtures/<slug>/) so they can be opened
// in a browser, e.g. /mock/the-bakery/menu. Price Watch itself reads them via mock:// URLs.
import { readFileSync } from "node:fs";
import { mockFile } from "@/lib/pricewatch/fetch";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path = [] } = await ctx.params;
  const file = mockFile(slug, path.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  const type = file.endsWith(".html") ? "text/html" : file.endsWith(".json") ? "application/json" : "text/plain";
  return new Response(readFileSync(file, "utf8"), { headers: { "Content-Type": `${type}; charset=utf-8` } });
}
