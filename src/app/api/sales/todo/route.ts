// Lane 3. The make-list.
//   GET  /api/sales/todo[?day=YYYY-MM-DD]  → PrepTask[] (to-do first)
//   GET  /api/sales/todo?next=1            → the one task the kiosk shows, or null
//   POST /api/sales/todo  AddOrderInput    → add an order by hand
import { handle } from "@/lib/api";
import { addOrder, listPrepTasks, nextPrepTask } from "@/lib/sales/prep";
import type { AddOrderInput } from "@/lib/types";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return handle(() => (params.get("next") ? nextPrepTask() : listPrepTasks(params.get("day") ?? undefined)));
}

export async function POST(req: Request) {
  const body = (await req.json()) as AddOrderInput;
  return handle(() => addOrder(body));
}
