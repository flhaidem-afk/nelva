
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import AvatarUpload from "./avatar-upload";
import EditProfile from "./edit-profile";
import OnlineStatus from "./online-status";

export const instant = false;

function createArticleSlug(article: {
  title: string;
  link: string;
}) {
  const titleSlug = article.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 65);

  let hash = 2166136261;

  for (let i = 0; i < article.link.length; i++) {
    hash ^= article.link.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `${titleSlug}-${(hash >>> 0).toString(36)}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth");
  }

  const metadata = user.user_metadata || {};
  const customClaims = metadata.custom_claims || {};

  const discordUsername =
    metadata.user_name ||
    metadata.preferred_username ||
    metadata.username ||
    customClaims.username ||
    "";

  const discordDisplayName =
    metadata.display_name ||
    metadata.full_name ||
    metadata.name ||
    customClaims.global_name ||
    customClaims.username ||
    discordUsername ||
    "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const storedUsername =
    profile?.username &&
    profile.username.toLowerCase() !== "gamer"
      ? profile.username
      : "";

  const discordProfileUsername =
    discordUsername || discordDisplayName;

  const username =
    storedUsername || discordProfileUsername || "Gamer";

  if (
    profile &&
    profile.username?.toLowerCase() === "gamer" &&
    discordProfileUsername
  ) {
    await supabase
      .from("profiles")
      .update({ username: discordProfileUsername })
      .eq("id", user.id);
  }

  const storedDisplayName =
    profile?.display_name &&
    profile.display_name.toLowerCase() !== "gamer"
      ? profile.display_name
      : "";

  const displayName =
    storedDisplayName || discordDisplayName || username;

  const avatarUrl =
    profile?.avatar_url || metadata.avatar_url || null;

  const { data: bookmarks, error: bookmarksError } = await supabase
    .from("bookmarks")
    .select("id, article_url, article_title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#08070d] px-6 py-10 text-white">
      <OnlineStatus userId={user.id} />

      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a href="/" className="text-2xl font-black tracking-widest">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Back to Home
            </a>

            <SignOutButton />
          </div>
        </header>

        <section className="mt-12">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-400">
            Your Account
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Welcome, {displayName}
          </h1>

          <p className="mt-3 text-gray-400">
            Your NELVA gaming community dashboard.
          </p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <h2 className="text-xl font-semibold">Your Profile</h2>

            <div className="mt-7">
              <AvatarUpload
                userId={user.id}
                initialAvatarUrl={avatarUrl}
                username={username}
              />
            </div>

            <EditProfile
              userId={user.id}
              initialDisplayName={storedDisplayName || discordDisplayName}
              initialBio={profile?.bio || ""}
              username={username}
            />

            <p className="mt-5 text-sm text-gray-400">
              Email: <span className="text-white">{user.email}</span>
            </p>

            <a
              href={`/profile/${encodeURIComponent(username)}`}
              className="mt-6 inline-block text-sm font-semibold text-purple-400 transition hover:text-purple-300"
            >
              View Public Profile ΓåÆ
            </a>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <h2 className="text-xl font-semibold">Your Activity</h2>

            <p className="mt-4 text-sm text-gray-400">
              You have saved{" "}
              <span className="font-bold text-purple-400">
                {bookmarks?.length ?? 0}
              </span>{" "}
              gaming news articles.
            </p>

            <a
              href="/#news"
              className="mt-6 inline-block rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold transition hover:bg-purple-500"
            >
              Explore NELVA
            </a>
          </div>
        </section>

        {/* NELVA GIFT CARD EXCHANGE */}
        <section className="mt-8 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.10] to-white/[0.02] p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-400">
                NELVA Exchange
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Gift Card Exchange
                <span className="text-purple-500">.</span>
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-gray-400">
                Submit your Apple Gift Card for manual review and
                keep track of your submission status from your account.
              </p>
            </div>

            <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 px-5 py-4 text-3xl">
              ◇
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/gift-cards"
              className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-500"
            >
              Submit a Gift Card
            </a>

            <a
              href="/dashboard/gift-cards"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-bold text-gray-200 transition hover:border-purple-500/40 hover:text-white"
            >
              Track My Submissions
            </a>
          </div>

          <p className="mt-5 text-xs leading-6 text-gray-500">
            All submissions require manual review. Submission does
            not guarantee acceptance or payment.
          </p>
        </section>

        <section className="mt-14">
          <div className="mb-7 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] text-purple-400">
                YOUR COLLECTION
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Saved Articles<span className="text-purple-500">.</span>
              </h2>
            </div>

            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-300">
              {bookmarks?.length ?? 0} Saved
            </span>
          </div>

          {bookmarksError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-7 text-sm text-red-300">
              Couldn't load your saved articles. Please refresh the page.
            </div>
          ) : !bookmarks || bookmarks.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
              <div className="text-5xl text-purple-400">ΓÖí</div>

              <h3 className="mt-5 text-xl font-bold">
                No saved articles yet
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-400">
                When you find an interesting gaming story, save it from the
                Latest News section and it will appear here.
              </p>

              <a
                href="/#news"
                className="mt-7 inline-block rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold transition hover:bg-purple-500"
              >
                Browse Gaming News
              </a>
            </div>
          ) : (
            <div className="grid gap-4">
              {bookmarks.map((bookmark) => {
                const articleSlug = createArticleSlug({
                  title: bookmark.article_title,
                  link: bookmark.article_url,
                });

                return (
                  <article
                    key={bookmark.id}
                    className="flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-purple-500/40 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-xs font-bold tracking-wider text-purple-400">
                        SAVED GAMING NEWS
                      </p>

                      <h3 className="mt-3 text-lg font-bold leading-snug">
                        {bookmark.article_title}
                      </h3>

                      <p className="mt-3 text-xs text-gray-500">
                        Saved{" "}
                        {new Date(bookmark.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <a
                      href={`/news/${articleSlug}`}
                      className="shrink-0 rounded-lg border border-purple-500/30 bg-purple-600/10 px-5 py-3 text-center text-sm font-bold text-purple-300 transition hover:bg-purple-600 hover:text-white"
                    >
                      Read Article ΓåÆ
                    </a>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
