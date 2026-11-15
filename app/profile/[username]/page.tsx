import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Props = {
  params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, bio, created_at, last_seen")
    .eq("username", username)
    .maybeSingle();

  if (error || !profile) {
    notFound();
  }

  const displayName =
    profile.display_name || profile.username || "Gamer";

  const lastSeen = profile.last_seen
    ? new Date(profile.last_seen).getTime()
    : 0;

  const isOnline =
    lastSeen > 0 && Date.now() - lastSeen < 2 * 60 * 1000;

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "NELVA member";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08070d] px-5 py-10 text-white md:py-16">
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full bg-purple-700/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-80 h-96 w-96 rounded-full bg-purple-500/10 blur-[120px]" />

      <div className="relative mx-auto max-w-4xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a href="/" className="text-2xl font-black tracking-[-0.08em]">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <a
            href="/"
            className="text-sm font-semibold text-gray-400 transition hover:text-purple-400"
          >
            ← Back to Home
          </a>
        </header>

        <div className="mb-8 mt-14">
          <p className="text-xs font-black tracking-[0.35em] text-purple-400">
            NELVA COMMUNITY
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
            PLAYER PROFILE<span className="text-purple-500">.</span>
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Meet a member of the NELVA gaming community.
          </p>
        </div>

        <section className="overflow-hidden rounded-3xl border border-purple-500/20 bg-[#11101a] shadow-2xl shadow-purple-950/20">
          <div className="relative h-36 overflow-hidden bg-gradient-to-r from-purple-950 via-[#251044] to-[#100d1b] md:h-48">
            <div className="absolute inset-0 opacity-30">
              <div className="absolute -right-10 -top-32 h-72 w-72 rounded-full border border-purple-300/30" />
              <div className="absolute -right-2 -top-24 h-56 w-56 rounded-full border border-purple-300/20" />
              <div className="absolute -right-20 -top-16 h-80 w-80 rounded-full border border-purple-300/10" />
            </div>

            <div className="absolute bottom-5 left-6 text-xs font-black tracking-[0.3em] text-purple-200/60 md:left-10">
              YOUR WORLD. YOUR GAMES.
            </div>
          </div>

          <div className="px-6 pb-10 md:px-10">
            <div className="-mt-16 flex flex-col items-center text-center md:-mt-20">
              <div className="relative h-32 w-32 rounded-full border-[5px] border-[#11101a] bg-purple-950 md:h-40 md:w-40">
                <div className="h-full w-full overflow-hidden rounded-full bg-purple-950">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`${displayName}'s profile picture`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-5xl font-black text-purple-300 md:text-6xl">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <span
                  aria-label={isOnline ? "Online" : "Offline"}
                  className={`absolute bottom-1 right-1 h-6 w-6 rounded-full border-[4px] border-[#11101a] ${
                    isOnline ? "bg-green-500" : "bg-gray-500"
                  }`}
                />
              </div>

              <h2 className="mt-6 text-3xl font-black tracking-tight md:text-4xl">
                {displayName}
              </h2>

              <p className="mt-2 text-sm font-semibold text-purple-400">
                @{profile.username}
              </p>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-gray-500"
                  }`}
                />

                <span
                  className={`text-xs font-bold ${
                    isOnline ? "text-green-400" : "text-gray-400"
                  }`}
                >
                  {isOnline ? "ONLINE NOW" : "OFFLINE"}
                </span>
              </div>

              <div className="mt-9 w-full max-w-xl rounded-2xl border border-white/10 bg-black/20 p-6 text-left">
                <p className="text-[10px] font-black tracking-[0.3em] text-purple-400">
                  ABOUT THIS GAMER
                </p>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-gray-300">
                  {profile.bio || "This gamer hasn't added a bio yet."}
                </p>
              </div>

              <div className="mt-8 flex w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-xl text-purple-400">
                  🎮
                </div>

                <div className="text-left">
                  <p className="text-[10px] font-bold tracking-widest text-gray-500">
                    COMMUNITY MEMBER
                  </p>

                  <p className="mt-1 text-sm font-bold text-white">
                    Joined {joinedDate}
                  </p>
                </div>
              </div>

              <a
                href="/"
                className="mt-9 inline-flex items-center justify-center rounded-xl bg-purple-600 px-8 py-4 text-sm font-black transition hover:-translate-y-1 hover:bg-purple-500"
              >
                EXPLORE NELVA →
              </a>
            </div>
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 py-8 text-center">
          <p className="text-xl font-black tracking-[-0.07em]">
            NELVA<span className="text-purple-500">.</span>
          </p>

          <p className="mt-2 text-xs text-gray-600">
            Your world. Your games.
          </p>
        </footer>
      </div>
    </main>
  );
}