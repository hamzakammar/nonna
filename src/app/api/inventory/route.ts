// Lane 1
import { handle } from "@/lib/api";
import { listInventory } from "@/lib/inventory";

export async function GET() {
  return handle(() => listInventory());
}
