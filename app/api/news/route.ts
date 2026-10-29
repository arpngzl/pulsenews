import { NextRequest, NextResponse } from "next/server";
import { fetchNews, NewsError } from "@/lib/currents";

export const runtime = "nodejs";
const ok = /^[a-z]{2}$/i;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const language = sp.get("language") ?? "", country = sp.get("country") ?? "";
  const category = (sp.get("category") ?? "").toLowerCase();
  try {
    const data = await fetchNews({
      q: (sp.get("q") ?? "").slice(0, 100),
      language: ok.test(language) ? language.toLowerCase() : undefined,
      country: ok.test(country) ? country.toUpperCase() : undefined,
      category: /^[a-z]{2,20}$/.test(category) ? category : undefined,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch (e) {
    const err = e instanceof NewsError ? e : new NewsError("Unexpected error.", 500);
    return NextResponse.json({ error: err.message }, {
      status: err.status, headers: err.retryAfter ? { "Retry-After": String(err.retryAfter) } : undefined,
    });
  }
}
