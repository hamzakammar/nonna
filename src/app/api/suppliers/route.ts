// Lane 1. GET /api/suppliers → every supplier with their offers (price per ingredient, which one we currently buy).
import { handle } from "@/lib/api";
import { listSuppliers } from "@/lib/inventory";

export async function GET() {
  return handle(() => listSuppliers());
}
