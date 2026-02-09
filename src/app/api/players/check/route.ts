import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  const username = req.nextUrl.searchParams.get("username");
  const trimmed = typeof username === "string" ? username.trim() : "";
  if (!trimmed) {
    return NextResponse.json({ available: false });
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return NextResponse.json({ available: false });
  }

  const { data, error } = await supabase.rpc("username_available", {
    check_username: trimmed,
  });

  if (error) {
    console.error("username_available error:", error);
    return NextResponse.json(
      { error: "Failed to check username" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    available: data === true,
  });
}
