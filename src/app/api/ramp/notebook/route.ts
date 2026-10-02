// Lane 1. GET /api/ramp/notebook → { summary: {weekTotalCents, cards[], tightest}, entries: NotebookEntry[], autopilot }
// Every supplier card charge in Nonna's words (facts exact, commentary rule-based).
import { handle } from "@/lib/api";
import { notebookEntries, notebookSummary } from "@/lib/ramp-mock/notebook";
import { autopilotStatus } from "@/lib/inventory";

export async function GET() {
  return handle(() => ({ summary: notebookSummary(), entries: notebookEntries(30), autopilot: autopilotStatus() }));
}
