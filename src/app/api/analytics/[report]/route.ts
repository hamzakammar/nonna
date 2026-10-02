// Lane 3. GET /api/analytics/:report?days=N
import { handle } from "@/lib/api";
import * as a from "@/lib/analytics";

export async function GET(req: Request, ctx: { params: Promise<{ report: string }> }) {
  const { report } = await ctx.params;
  const days = Number(new URL(req.url).searchParams.get("days")) || undefined;
  return handle(() => {
    switch (report) {
      case "products": return a.productPerformance(days);
      case "busyness": return a.busynessHeatmap(days);
      case "rush": return a.rushStatus();
      case "prep": return a.prepForecast();
      case "truths": return a.gentleTruths(days);
      case "waste": return a.wasteSummary(days);
      default: throw new Error(`Unknown report ${report}`);
    }
  });
}
