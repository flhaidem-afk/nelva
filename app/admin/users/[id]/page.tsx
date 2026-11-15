
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type AdminUserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserPage({
  params,
}: AdminUserPageProps) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user: admin },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !admin) {
    redirect("/auth");
  }

  const { data: adminAccess, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", admin.id)
    .maybeSingle();

  if (adminError || !adminAccess) {
    redirect("/dashboard");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at, last_seen")
    .eq("id", id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Unable to load this user profile.");
  }

  if (!profile) {
    notFound();
  }

  const isOnline =
    profile.last_seen &&
    Date.now() - new Date(profile.last_seen).getTime() < 2 * 60 * 1000;

  const { count: bookmarkCount, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id);

  return (
    <main className="min-h-screen bg-[#08070d] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a href="/" className="text-2xl font-black tracking-widest">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <a
            href="/admin"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            Back to Admin
          </a>
        </header>

        <section className="mt-14">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-400">
            Community Management
          </p>

          <h1 className="mt-3 text-4xl font-black">
            User Details<span className="text-purple-500">.</span>
          </h1>
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-24 w-24 rounded-full border-2 border-purple-500/40 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-600/20 text-3xl font-bold text-purple-300">
                {(profile.display_name || profile.username || "G")[0].toUpperCase()}
              </div>
            )}

            <div>
              <h2 className="text-3xl font-bold">
                {profile.display_name || profile.username || "Gamer"}
              </h2>

              <p className="mt-2 text-gray-400">
                @{profile.username || "gamer"}
              </p>

              <span
                className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                  isOnline
                    ? "bg-green-500/10 text-green-400"
                    : "bg-gray-500/10 text-gray-400"
                }`}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Account ID
              </p>
              <p className="mt-2 break-all text-sm text-gray-300">
                {profile.id}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Date Joined
              </p>
              <p className="mt-2 text-sm text-gray-300">
                {new Date(profile.created_at).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Last Seen
              </p>
              <p className="mt-2 text-sm text-gray-300">
                {profile.last_seen
                  ? new Date(profile.last_seen).toLocaleString()
                  : "No activity recorded"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Saved Articles
              </p>
              <p className="mt-2 text-sm font-bold text-purple-400">
                {bookmarkError ? "Unavailable" : bookmarkCount ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-8">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              About
            </p>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-300">
              {profile.bio || "This user hasn't added a bio yet."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
