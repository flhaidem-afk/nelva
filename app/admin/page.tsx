
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { randomInt } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type ReportStatus = "reviewed" | "dismissed" | "resolved";

type GiveawayEntryCount = {
  giveaway_id: string;
  entry_count: number | string;
};

const GIVEAWAY_DURATION_DAYS = 5;

export default async function AdminPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/auth");

  const { data: adminAccess, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminAccess) redirect("/dashboard");

  async function verifyAdmin() {
    "use server";

    const serverSupabase = await createClient();

    const {
      data: { user: currentUser },
    } = await serverSupabase.auth.getUser();

    if (!currentUser) redirect("/auth");

    const { data: access } = await serverSupabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (!access) redirect("/dashboard");

    return { serverSupabase, currentUser };
  }

  async function createGiveaway(formData: FormData) {
    "use server";

    const { serverSupabase, currentUser } = await verifyAdmin();

    const title = String(formData.get("title") ?? "").trim();
    const prize = String(formData.get("prize") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const rawImageUrl = String(formData.get("image_url") ?? "").trim();

    if (!title || !prize) {
      throw new Error("Giveaway title and prize are required.");
    }

    if (title.length > 100 || prize.length > 150 || description.length > 2000) {
      throw new Error("One or more giveaway fields are too long.");
    }

    let imageUrl: string | null = null;

    if (rawImageUrl) {
      try {
        const parsedUrl = new URL(rawImageUrl);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error("Invalid image URL.");
        }

        imageUrl = parsedUrl.toString();
      } catch {
        throw new Error("Please enter a valid image URL.");
      }
    }

    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() +
        GIVEAWAY_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    const { error } = await serverSupabase
      .from("giveaways")
      .insert({
        title,
        prize,
        description,
        image_url: imageUrl,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "active",
        created_by: currentUser.id,
      });

    if (error) {
      throw new Error(`Could not create giveaway: ${error.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/giveaway");
    revalidatePath("/");
  }

  async function selectGiveawayWinner(giveawayId: string) {
    "use server";

    const { serverSupabase } = await verifyAdmin();

    if (!giveawayId || !/^[0-9a-f-]{36}$/i.test(giveawayId)) {
      throw new Error("Invalid giveaway.");
    }

    const { data: giveaway, error: giveawayError } =
      await serverSupabase
        .from("giveaways")
        .select("id, ends_at, status, winner_user_id")
        .eq("id", giveawayId)
        .maybeSingle();

    if (giveawayError || !giveaway) {
      throw new Error("Could not find this giveaway.");
    }

    if (giveaway.status !== "active" && giveaway.status !== "ended") {
      throw new Error(
        "Winners cannot be selected for draft or cancelled giveaways."
      );
    }

    if (giveaway.winner_user_id) {
      throw new Error("A winner has already been selected.");
    }

    const now = new Date();
    const nowIso = now.toISOString();

    if (new Date(giveaway.ends_at).getTime() > now.getTime()) {
      throw new Error("This giveaway has not ended yet.");
    }

    const { data: entries, error: entriesError } =
      await serverSupabase
        .from("giveaway_entries")
        .select("user_id")
        .eq("giveaway_id", giveawayId);

    if (entriesError) {
      throw new Error("Could not load giveaway participants.");
    }

    if (!entries || entries.length === 0) {
      throw new Error("There are no participants in this giveaway.");
    }

    const winningEntry = entries[randomInt(entries.length)];

    // Only active or ended giveaways can receive a winner.
    // The conditional update also prevents simultaneous winner selections.
    const { data: updatedGiveaway, error: updateError } =
      await serverSupabase
        .from("giveaways")
        .update({
          winner_user_id: winningEntry.user_id,
          status: "ended",
          updated_at: nowIso,
        })
        .eq("id", giveawayId)
        .is("winner_user_id", null)
        .in("status", ["active", "ended"])
        .lte("ends_at", nowIso)
        .select("id")
        .maybeSingle();

    if (updateError) {
      throw new Error("Could not save the giveaway winner.");
    }

    if (!updatedGiveaway) {
      throw new Error(
        "This giveaway may have been cancelled or a winner may already have been selected. Refresh the page."
      );
    }

    revalidatePath("/admin");
    revalidatePath("/giveaway");
    revalidatePath("/");
  }

  async function updateReportStatus(
    reportId: string,
    status: ReportStatus
  ) {
    "use server";

    const { serverSupabase, currentUser } = await verifyAdmin();

    const { error } = await serverSupabase
      .from("comment_reports")
      .update({
        status,
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (error) {
      throw new Error("Could not update the report.");
    }

    revalidatePath("/admin");
  }

  async function deleteReportedComment(
    commentId: string,
    reportId: string
  ) {
    "use server";

    const { serverSupabase, currentUser } = await verifyAdmin();

    const { error } = await serverSupabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      throw new Error("Could not delete the comment.");
    }

    const { error: reportUpdateError } = await serverSupabase
      .from("comment_reports")
      .update({
        status: "resolved",
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (reportUpdateError) {
      throw new Error("Comment deleted, but the report could not be updated.");
    }

    revalidatePath("/admin");
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at, last_seen")
    .order("created_at", { ascending: false });

  const totalUsers = profiles?.length ?? 0;

  const onlineUsers =
    profiles?.filter((profile) => {
      if (!profile.last_seen) return false;

      return (
        Date.now() - new Date(profile.last_seen).getTime() <
        2 * 60 * 1000
      );
    }).length ?? 0;

  const { data: reports, error: reportsError } = await supabase
    .from("comment_reports")
    .select("*")
    .order("created_at", { ascending: false });

  const commentIds = [
    ...new Set((reports ?? []).map((report) => report.comment_id)),
  ];

  const { data: comments } =
    commentIds.length > 0
      ? await supabase
          .from("comments")
          .select("id, user_id, article_title, article_url, content, created_at")
          .in("id", commentIds)
      : { data: [] };

  const profileIds = [
    ...new Set([
      ...(reports ?? []).map((report) => report.reporter_id),
      ...(comments ?? []).map((comment) => comment.user_id),
    ]),
  ];

  const { data: reportProfiles } =
    profileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", profileIds)
      : { data: [] };

  const pendingReports =
    reports?.filter((report) => report.status === "pending").length ?? 0;

  // GIVEAWAY MANAGEMENT DATA

  const { data: giveaways, error: giveawaysError } = await supabase
    .from("giveaways")
    .select("id, title, prize, status, starts_at, ends_at, created_at, winner_user_id")
    .order("created_at", { ascending: false });

  const { data: giveawayCountsData } = await supabase.rpc(
    "get_giveaway_entry_counts"
  );

  const giveawayCounts =
    (giveawayCountsData ?? []) as unknown as GiveawayEntryCount[];

  function getEntryCount(giveawayId: string): number {
    const item = giveawayCounts.find(
      (count) => count.giveaway_id === giveawayId
    );

    return Number(item?.entry_count ?? 0);
  }

  function getProfileName(id: string) {
    const profile = reportProfiles?.find((item) => item.id === id);

    return (
      profile?.display_name ||
      profile?.username ||
      "Unknown user"
    );
  }

  function getWinnerName(id: string) {
    const profile = profiles?.find((item) => item.id === id);

    return (
      profile?.display_name ||
      profile?.username ||
      "NELVA member"
    );
  }

  function getComment(id: string) {
    return comments?.find((comment) => comment.id === id);
  }

  function statusStyle(status: string) {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-400";
      case "reviewed":
        return "bg-blue-500/10 text-blue-400";
      case "dismissed":
        return "bg-gray-500/10 text-gray-400";
      case "resolved":
        return "bg-green-500/10 text-green-400";
      case "active":
        return "bg-green-500/10 text-green-400";
      case "ended":
        return "bg-gray-500/10 text-gray-400";
      case "cancelled":
        return "bg-red-500/10 text-red-400";
      case "draft":
        return "bg-yellow-500/10 text-yellow-400";
      default:
        return "bg-white/10 text-gray-400";
    }
  }

  return (
    <main className="min-h-screen bg-[#08070d] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <a href="/" className="text-2xl font-black tracking-widest">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <a
            href="/dashboard"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            Back to Dashboard
          </a>
        </header>

        <section className="mt-14">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-400">
            NELVA Management
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Admin Dashboard<span className="text-purple-500">.</span>
          </h1>

          <p className="mt-4 text-gray-400">
            Manage and monitor your NELVA gaming community.
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-sm text-gray-400">Registered Users</p>
            <h2 className="mt-4 text-4xl font-black">{totalUsers}</h2>
            <p className="mt-2 text-xs text-gray-500">
              Accounts with NELVA profiles
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-sm text-gray-400">Currently Online</p>
            <h2 className="mt-4 text-4xl font-black text-green-400">
              {onlineUsers}
            </h2>
            <p className="mt-2 text-xs text-gray-500">
              Active within the last two minutes
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-sm text-gray-400">Administrator</p>
            <h2 className="mt-4 break-all text-lg font-bold">
              {user.email}
            </h2>
            <p className="mt-2 text-xs text-purple-400">
              Admin access verified
            </p>
          </div>
        </section>

        {/* GIVEAWAY MANAGEMENT */}

        <section className="mt-16">
          <div className="mb-7">
            <p className="text-xs font-bold tracking-[0.25em] text-purple-400">
              COMMUNITY REWARDS
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Giveaway Management<span className="text-purple-500">.</span>
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Create, manage and select winners for community giveaways.
            </p>
          </div>

          <div className="grid gap-7 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
              <h3 className="text-xl font-bold">Create a Giveaway</h3>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                New giveaways start immediately and run for exactly five
                days. There is no participant limit.
              </p>

              <form action={createGiveaway} className="mt-7 space-y-5">
                <div>
                  <label
                    htmlFor="giveaway-title"
                    className="mb-2 block text-sm font-semibold text-gray-300"
                  >
                    Giveaway title
                  </label>
                  <input
                    id="giveaway-title"
                    name="title"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="e.g. NELVA Community Giveaway"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="giveaway-prize"
                    className="mb-2 block text-sm font-semibold text-gray-300"
                  >
                    Prize
                  </label>
                  <input
                    id="giveaway-prize"
                    name="prize"
                    type="text"
                    required
                    maxLength={150}
                    placeholder="What will the winner receive?"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="giveaway-description"
                    className="mb-2 block text-sm font-semibold text-gray-300"
                  >
                    Description
                  </label>
                  <textarea
                    id="giveaway-description"
                    name="description"
                    rows={4}
                    maxLength={2000}
                    placeholder="Explain the giveaway and how it works..."
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="giveaway-image"
                    className="mb-2 block text-sm font-semibold text-gray-300"
                  >
                    Image URL <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    id="giveaway-image"
                    name="image_url"
                    type="url"
                    placeholder="https://example.com/prize-image.jpg"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-500"
                  />
                </div>

                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                  <p className="text-sm font-bold text-purple-300">
                    Giveaway schedule
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    Starts immediately after publishing.
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    Ends exactly five days after starting.
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    Unlimited participants. One entry per account.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-purple-600 px-6 py-4 text-sm font-black text-white transition hover:bg-purple-500"
                >
                  Publish Giveaway
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
              <h3 className="text-xl font-bold">Before Publishing</h3>

              <div className="mt-6 space-y-5 text-sm leading-6 text-gray-400">
                <div>
                  <p className="font-bold text-white">Confirm the prize</p>
                  <p className="mt-1">
                    Make sure the prize is real and that you can deliver it
                    to the eventual winner.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-white">Explain the rules</p>
                  <p className="mt-1">
                    Use the description to explain eligibility and any
                    conditions participants should know.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-white">Be transparent</p>
                  <p className="mt-1">
                    Do not announce a winner until the selection has been
                    completed fairly and the result can be verified.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-white">Protect participants</p>
                  <p className="mt-1">
                    Never ask participants for passwords, verification
                    codes, banking details or an entry fee.
                  </p>
                </div>
              </div>

              <a
                href="/giveaway"
                className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-purple-400 transition hover:text-purple-300"
              >
                View Public Giveaway Page →
              </a>
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Existing Giveaways</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Monitor published giveaways and manage their winners.
                </p>
              </div>

              <span className="text-sm text-gray-500">
                {giveaways?.length ?? 0} total
              </span>
            </div>

            {giveawaysError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">
                Could not load giveaways. Check the giveaways table
                permissions.
              </div>
            ) : !giveaways || giveaways.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <p className="font-bold">No giveaways have been created.</p>
                <p className="mt-2 text-sm text-gray-500">
                  Your published giveaways will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {giveaways.map((giveaway) => {
                  const entryCount = getEntryCount(giveaway.id);
                  const hasWinner = Boolean(giveaway.winner_user_id);
                  const hasEnded =
                    giveaway.status === "ended" ||
                    new Date(giveaway.ends_at).getTime() <= Date.now();

                  return (
                    <article
                      key={giveaway.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-bold">
                            {giveaway.title}
                          </h4>
                          <p className="mt-1 text-sm text-purple-300">
                            Prize: {giveaway.prize}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusStyle(
                            hasEnded ? "ended" : giveaway.status
                          )}`}
                        >
                          {hasEnded ? "Ended" : giveaway.status}
                        </span>
                      </div>

                      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                        <div className="rounded-xl bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Participants</p>
                          <p className="mt-2 text-xl font-black">
                            {entryCount}
                          </p>
                        </div>

                        <div className="rounded-xl bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Starts</p>
                          <p className="mt-2 text-sm font-semibold">
                            {new Date(giveaway.starts_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="rounded-xl bg-black/30 p-4">
                          <p className="text-xs text-gray-500">Ends</p>
                          <p className="mt-2 text-sm font-semibold">
                            {new Date(giveaway.ends_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {hasWinner ? (
                        <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                          <p className="text-xs font-bold uppercase tracking-wider text-green-400">
                            Winner selected
                          </p>
                          <p className="mt-2 text-lg font-black text-white">
                            {getWinnerName(giveaway.winner_user_id)}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            Winner selection has been saved.
                          </p>
                        </div>
                      ) : hasEnded ? (
                        <div className="mt-5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
                          <p className="font-bold text-white">
                            Giveaway has ended
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            {entryCount} eligible participant
                            {entryCount === 1 ? "" : "s"}.
                          </p>

                          {entryCount > 0 ? (
                            <form
                              action={selectGiveawayWinner.bind(
                                null,
                                giveaway.id
                              )}
                              className="mt-4"
                            >
                              <button
                                type="submit"
                                className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white transition hover:bg-purple-500"
                              >
                                Randomly Select Winner
                              </button>
                            </form>
                          ) : (
                            <p className="mt-3 text-sm text-yellow-400">
                              No entries were submitted. No winner can be
                              selected.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                          <p className="text-sm font-semibold text-gray-300">
                            Winner selection is locked.
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            You can select a winner after the giveaway ends.
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* COMMENT MODERATION */}

        <section className="mt-16">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] text-purple-400">
                COMMUNITY SAFETY
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Comment Reports<span className="text-purple-500">.</span>
              </h2>

              <p className="mt-2 text-sm text-gray-400">
                Review reports and take action against inappropriate comments.
              </p>
            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-3">
              <p className="text-xs text-gray-400">Pending Reports</p>
              <p className="mt-1 text-2xl font-black text-yellow-400">
                {pendingReports}
              </p>
            </div>
          </div>

          {reportsError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-300">
              Could not load reports. Check comment_reports permissions.
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <p className="text-lg font-bold">No reports yet.</p>
              <p className="mt-2 text-sm text-gray-500">
                Submitted comment reports will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {reports.map((report) => {
                const comment = getComment(report.comment_id);

                return (
                  <article
                    key={report.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-400">
                          {report.reason}
                        </p>

                        <p className="mt-2 text-xs text-gray-500">
                          Reported{" "}
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${statusStyle(report.status)}`}
                      >
                        {report.status}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-black/30 p-4">
                        <p className="text-xs text-gray-500">
                          Reported by
                        </p>
                        <p className="mt-2 font-semibold">
                          {getProfileName(report.reporter_id)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/30 p-4">
                        <p className="text-xs text-gray-500">
                          Comment author
                        </p>
                        <p className="mt-2 font-semibold">
                          {comment
                            ? getProfileName(comment.user_id)
                            : "Comment unavailable"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Reported Comment
                      </p>

                      {comment ? (
                        <>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-200">
                            {comment.content}
                          </p>

                          <p className="mt-4 text-xs text-gray-500">
                            Article: {comment.article_title}
                          </p>

                          <a
                            href={`/news/${encodeURIComponent(comment.article_url)}`}
                            className="mt-2 inline-block text-xs text-purple-400 hover:text-purple-300"
                          >
                            Original article URL
                          </a>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-gray-500">
                          This comment may have already been deleted.
                        </p>
                      )}
                    </div>

                    {report.details && (
                      <div className="mt-4 rounded-xl border border-white/10 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Additional Details
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                          {report.details}
                        </p>
                      </div>
                    )}

                    {report.status === "pending" && (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <form
                          action={updateReportStatus.bind(
                            null,
                            report.id,
                            "reviewed"
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-400 transition hover:bg-blue-500/20"
                          >
                            Mark Reviewed
                          </button>
                        </form>

                        <form
                          action={updateReportStatus.bind(
                            null,
                            report.id,
                            "dismissed"
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-lg bg-gray-500/10 px-4 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-gray-500/20"
                          >
                            Dismiss Report
                          </button>
                        </form>

                        {comment && (
                          <form
                            action={deleteReportedComment.bind(
                              null,
                              comment.id,
                              report.id
                            )}
                          >
                            <button
                              type="submit"
                              className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
                            >
                              Delete Comment
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    {report.status === "reviewed" && (
                      <div className="mt-6 flex flex-wrap gap-3">
                        <form
                          action={updateReportStatus.bind(
                            null,
                            report.id,
                            "resolved"
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-lg bg-green-500/10 px-4 py-2.5 text-sm font-bold text-green-400 transition hover:bg-green-500/20"
                          >
                            Mark Resolved
                          </button>
                        </form>

                        <form
                          action={updateReportStatus.bind(
                            null,
                            report.id,
                            "dismissed"
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-lg bg-gray-500/10 px-4 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-gray-500/20"
                          >
                            Dismiss Report
                          </button>
                        </form>

                        {comment && (
                          <form
                            action={deleteReportedComment.bind(
                              null,
                              comment.id,
                              report.id
                            )}
                          >
                            <button
                              type="submit"
                              className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
                            >
                              Delete Comment
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* REGISTERED USERS */}

        <section className="mt-16">
          <div className="mb-7">
            <p className="text-xs font-bold tracking-[0.25em] text-purple-400">
              COMMUNITY MANAGEMENT
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Registered Users<span className="text-purple-500">.</span>
            </h2>
          </div>

          {profilesError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-red-300">
              Couldn't load users. Check the profiles table permissions.
            </div>
          ) : !profiles || profiles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-gray-400">
              No user profiles found.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left">
                  <thead className="bg-white/[0.05] text-xs uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-6 py-5">User</th>
                      <th className="px-6 py-5">Username</th>
                      <th className="px-6 py-5">Joined</th>
                      <th className="px-6 py-5">Status</th>
                      <th className="px-6 py-5">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {profiles.map((profile) => {
                      const isOnline =
                        profile.last_seen &&
                        Date.now() -
                          new Date(profile.last_seen).getTime() <
                          2 * 60 * 1000;

                      return (
                        <tr
                          key={profile.id}
                          className="border-t border-white/10 transition hover:bg-white/[0.03]"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              {profile.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt=""
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600/20 font-bold text-purple-300">
                                  {(profile.display_name ||
                                    profile.username ||
                                    "G")[0].toUpperCase()}
                                </div>
                              )}

                              <span className="font-semibold">
                                {profile.display_name ||
                                  profile.username ||
                                  "Gamer"}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-400">
                            @{profile.username || "gamer"}
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-400">
                            {new Date(
                              profile.created_at
                            ).toLocaleDateString()}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                isOnline
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-gray-500/10 text-gray-400"
                              }`}
                            >
                              {isOnline ? "Online" : "Offline"}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <a
                              href={`/admin/users/${encodeURIComponent(
                                profile.id
                              )}`}
                              className="text-sm font-semibold text-purple-400 transition hover:text-purple-300"
                            >
                              View Details →
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
