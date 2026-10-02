// Lane 2
import { handle } from "@/lib/api";
import { handleUtterance } from "@/lib/voice/intents";
import type { VoiceRequest } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as VoiceRequest;
  return handle(() => handleUtterance(body));
}
