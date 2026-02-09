import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const q = req.nextUrl.searchParams.get("q");
  const query = typeof q === "string" ? q.trim() : "";
  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const pattern = `%${query}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .not("username", "is", null)
    .limit(10);

  if (error) {
    console.error("Players search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }

  return NextResponse.json(data ?? []);
}
