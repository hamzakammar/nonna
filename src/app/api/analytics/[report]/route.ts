// Lane 3. GET /api/analytics/:report?days=N  (prep: ?date=YYYY-MM-DD)
import { handle } from "@/lib/api";
import * as a from "@/lib/analytics";

export async function GET(req: Request, ctx: { params: Promise<{ report: string }> }) {
  const { report } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const days = Number(params.get("days")) || undefined;
  return handle(() => {
    switch (report) {
      case "products": return a.productPerformance(days);
      case "busyness": return a.busynessHeatmap(days);
      case "rush": return a.rushStatus();
      case "prep": return a.prepForecast(params.get("date") ?? undefined);
      case "truths": return a.gentleTruths(days);
      case "waste": return a.wasteSummary(days);
      default: throw new Error(`Unknown report ${report}`);
    }
  });
}
