// Lane 4. Demo controls. GET → current demo time. POST { advanceHours } | { reset: true }
import { handle } from "@/lib/api";
import { advance, nowIso, reset, HOUR } from "@/lib/clock";

export async function GET() {
  return handle(() => ({ now: nowIso() }));
}

export async function POST(req: Request) {
  const body = (await req.json()) as { advanceHours?: number; reset?: boolean };
  return handle(() => {
    if (body.reset) reset();
    if (body.advanceHours) advance(body.advanceHours * HOUR);
    return { now: nowIso() };
  });
}
