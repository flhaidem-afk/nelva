
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("NELVA AUTH ERROR:", exchangeError);
    return NextResponse.redirect(
      `${origin}/auth?error=authentication_failed`
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("NELVA USER ERROR:", userError);
    return NextResponse.redirect(
      `${origin}/auth?error=user_not_found`
    );
  }

  const metadata = user.user_metadata || {};
  const claims = metadata.custom_claims || {};

  const rawUsername =
    metadata.username ||
    metadata.user_name ||
    metadata.preferred_username ||
    claims.username ||
    user.email?.split("@")[0] ||
    `gamer${user.id.slice(0, 8)}`;

  const username =
    String(rawUsername)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24) || `gamer${user.id.slice(0, 8)}`;

  const displayName =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    claims.global_name ||
    username;

  const { data: existingProfile, error: readError } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("NELVA PROFILE READ ERROR:", readError);
    return NextResponse.redirect(
      `${origin}/auth?error=profile_read_failed`
    );
  }

  const { error: saveError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        username: existingProfile?.username || username,
        display_name: existingProfile?.display_name || displayName,
        avatar_url:
          existingProfile?.avatar_url || metadata.avatar_url || null,
        bio: existingProfile?.bio || null,
      },
      { onConflict: "id" }
    );

  if (saveError) {
    console.error("NELVA PROFILE SAVE ERROR:", saveError);
    return NextResponse.redirect(
      `${origin}/auth?error=profile_save_failed`
    );
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
