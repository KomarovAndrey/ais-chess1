import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

async function resolveLoginEmail(
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>,
  identifier: string
): Promise<string | null> {
  if (identifier.includes("@")) return identifier;

  if (supabase) {
    const { data, error } = await supabase.rpc("resolve_login_email", {
      identifier,
    });
    if (!error && typeof data === "string" && data.includes("@")) {
      return data;
    }
  }

  const admin = createAdminClient();
  if (!admin) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", identifier)
    .maybeSingle();

  if (!profile?.id) return null;

  const { data: userData, error } = await admin.auth.admin.getUserById(profile.id);
  if (error || !userData.user?.email) return null;

  return userData.user.email;
}

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  let identifier: string;
  let password: string;
  try {
    const body = await request.json();
    identifier = String(body.email ?? body.login ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const email = await resolveLoginEmail(supabase, identifier);
  if (!email) {
    return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
