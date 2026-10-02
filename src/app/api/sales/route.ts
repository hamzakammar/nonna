// Lane 3
import { handle } from "@/lib/api";
import { recordSale, listSales } from "@/lib/sales";
import { now, DAY } from "@/lib/clock";
import type { RecordSaleInput } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as RecordSaleInput;
  return handle(() => recordSale({ source: "pos", ...body }));
}

export async function GET() {
  return handle(() => listSales({ sinceIso: new Date(now().getTime() - DAY).toISOString() }));
}
