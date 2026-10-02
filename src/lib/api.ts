/** Shared route helper: boots the lanes, returns JSON, maps unbuilt functions to 501. */
import { NextResponse } from "next/server";
import { ensureBooted } from "./boot";

export async function handle(fn: () => unknown | Promise<unknown>): Promise<NextResponse> {
  ensureBooted();
  try {
    const result = await fn();
    // A route can return its own Response (custom status codes); pass it through untouched.
    return result instanceof Response ? (result as NextResponse) : NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.startsWith("Not implemented yet") ? 501 : 500;
    if (status === 500) console.error(err);
    return NextResponse.json({ error: message }, { status });
  }
}
