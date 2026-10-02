/** Shared route helper: boots the lanes, returns JSON, maps unbuilt functions to 501. */
import { NextResponse } from "next/server";
import { ensureBooted } from "./boot";

export async function handle(fn: () => unknown | Promise<unknown>): Promise<NextResponse> {
  ensureBooted();
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.startsWith("Not implemented yet") ? 501 : 500;
    if (status === 500) console.error(err);
    return NextResponse.json({ error: message }, { status });
  }
}
