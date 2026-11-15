
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DISCORD_INVITE = "https://discord.gg/wGVuF3FaH";

type Giveaway = {
  id: string;
  title: string;
  description: string;
  prize: string;
  image_url: string | null;
  starts_at: string;
  ends_at: string;
  status: "active" | "ended";
  winner_user_id: string | null;
};

type EntryCount = {
  giveaway_id: string;
  entry_count: number | string;
};

type WinnerProfile = {
  id: string;
  username: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRemaining(endDate: string, now: number) {
  const difference = Math.max(0, new Date(endDate).getTime() - now);

  return {
    days: Math.floor(difference / 86400000),
    hours: Math.floor((difference % 86400000) / 3600000),
    minutes: Math.floor((difference % 3600000) / 60000),
    seconds: Math.floor((difference % 60000) / 1000),
  };
}

export default function GiveawayPage() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [winnerProfiles, setWinnerProfiles] = useState<Record<string, string>>({});
  const [enteredGiveaways, setEnteredGiveaways] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const [clock, setClock] = useState(0);

  const loadGiveaways = useCallback(async () => {
    setError("");

    try {
      const { data, error: giveawayError } = await supabase
        .from("giveaways")
        .select(
          "id, title, description, prize, image_url, starts_at, ends_at, status, winner_user_id"
        )
        .in("status", ["active", "ended"])
        .order("ends_at", { ascending: false });

      if (giveawayError) throw giveawayError;

      const items = (data || []) as Giveaway[];
      setGiveaways(items);

      const { data: counts, error: countError } = await supabase.rpc(
        "get_giveaway_entry_counts"
      );

      if (countError) throw countError;

      const countMap: Record<string, number> = {};

      (counts as EntryCount[] | null)?.forEach((item) => {
        countMap[item.giveaway_id] = Number(item.entry_count || 0);
      });

      setEntryCounts(countMap);

      // Retrieve only public usernames for selected winners.
      const winnerIds = [
        ...new Set(
          items
            .map((item) => item.winner_user_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (winnerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", winnerIds);

        if (!profilesError && profiles) {
          const names: Record<string, string> = {};

          (profiles as WinnerProfile[]).forEach((profile) => {
            if (profile.username) {
              names[profile.id] = profile.username;
            }
          });

          setWinnerProfiles(names);
        }
      } else {
        setWinnerProfiles({});
      }
    } catch (err) {
      console.error("Giveaway loading failed:", err);
      setError("We couldn't load the giveaways. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserEntries = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserId(user?.id || null);

    if (!user) {
      setEnteredGiveaways([]);
      return;
    }

    const { data, error: entryError } = await supabase
      .from("giveaway_entries")
      .select("giveaway_id")
      .eq("user_id", user.id);

    if (entryError) {
      console.error("Entry loading failed:", entryError);
      return;
    }

    setEnteredGiveaways(
      (data || []).map((entry) => entry.giveaway_id)
    );
  }, []);

  useEffect(() => {
    loadGiveaways();
    loadUserEntries();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUserEntries();
    });

    return () => subscription.unsubscribe();
  }, [loadGiveaways, loadUserEntries]);

  useEffect(() => {
    setClock(Date.now());

    const timer = setInterval(() => {
      setClock(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function enterGiveaway(giveaway: Giveaway) {
    if (busyId) return;

    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    if (enteredGiveaways.includes(giveaway.id)) return;

    const now = Date.now();
    const starts = new Date(giveaway.starts_at).getTime();
    const ends = new Date(giveaway.ends_at).getTime();

    if (
      giveaway.status !== "active" ||
      now < starts ||
      now >= ends
    ) {
      setNotice("This giveaway is not currently accepting entries.");
      return;
    }

    setBusyId(giveaway.id);
    setNotice("");

    try {
      const { error: insertError } = await supabase
        .from("giveaway_entries")
        .insert({
          giveaway_id: giveaway.id,
          user_id: userId,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          setEnteredGiveaways((current) =>
            current.includes(giveaway.id)
              ? current
              : [...current, giveaway.id]
          );

          setNotice("You've already entered this giveaway.");
          return;
        }

        throw insertError;
      }

      setEnteredGiveaways((current) => [...current, giveaway.id]);

      setEntryCounts((current) => ({
        ...current,
        [giveaway.id]: (current[giveaway.id] || 0) + 1,
      }));

      setNotice("Your entry has been recorded successfully.");
    } catch (err) {
      console.error("Giveaway entry failed:", err);
      setNotice("We couldn't record your entry. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const now = clock;

  const liveGiveaways = giveaways.filter(
    (item) =>
      item.status === "active" &&
      new Date(item.starts_at).getTime() <= now &&
      new Date(item.ends_at).getTime() > now
  );

  const upcomingGiveaways = giveaways.filter(
    (item) =>
      item.status === "active" &&
      new Date(item.starts_at).getTime() > now
  );

  const endedGiveaways = giveaways.filter(
    (item) =>
      item.status === "ended" ||
      new Date(item.ends_at).getTime() <= now
  );

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07070b]/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-3xl font-black tracking-[-0.08em]">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <div className="flex items-center gap-5 text-sm font-medium text-gray-400">
            <a href="/" className="transition hover:text-white">
              Home
            </a>
            <a href="/#community" className="transition hover:text-white">
              Community
            </a>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg bg-purple-600 px-4 py-2 font-bold text-white transition hover:bg-purple-500 sm:inline-block"
            >
              Discord ↗
            </a>
          </div>
        </nav>
      </header>

      {/* INTRODUCTION */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-48 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-purple-700/15 blur-[130px]" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:55px_55px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 md:pb-28 md:pt-32">
          <p className="text-xs font-black tracking-[0.35em] text-purple-400">
            NELVA COMMUNITY
          </p>

          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
            COMMUNITY
            <br />
            <span className="text-purple-400">GIVEAWAYS.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-base leading-8 text-gray-400 md:text-lg">
            Occasionally, we give something back to the people who
            make this gaming community what it is. Explore current
            events, read the details and enter when you're eligible.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#active"
              className="rounded-lg bg-purple-600 px-7 py-4 text-sm font-black transition hover:-translate-y-1 hover:bg-purple-500"
            >
              VIEW CURRENT EVENTS →
            </a>

            <a
              href="#rules"
              className="rounded-lg border border-white/15 bg-white/[0.03] px-7 py-4 text-sm font-bold text-gray-300 transition hover:border-purple-400/50 hover:text-white"
            >
              HOW IT WORKS
            </a>
          </div>
        </div>
      </section>

      {/* IMPORTANT INFORMATION */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#0d0d14] p-6">
            <p className="text-xs font-black tracking-widest text-purple-400">
              NO ENTRY FEES
            </p>
            <h2 className="mt-3 text-lg font-bold">
              Free to participate
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              NELVA will never ask you to pay a fee to enter or claim
              a giveaway prize.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0d0d14] p-6">
            <p className="text-xs font-black tracking-widest text-purple-400">
              FAIR PARTICIPATION
            </p>
            <h2 className="mt-3 text-lg font-bold">
              One entry per account
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Each account can enter an eligible giveaway once.
              There is no participant cap.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0d0d14] p-6">
            <p className="text-xs font-black tracking-widest text-purple-400">
              YOUR SECURITY
            </p>
            <h2 className="mt-3 text-lg font-bold">
              Protect your account
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Never share your password, OTP or banking credentials
              with anyone claiming to represent NELVA.
            </p>
          </div>
        </div>
      </section>

      {/* NOTICE */}
      {notice && (
        <div role="status" className="mx-auto mb-8 max-w-7xl px-6">
          <div className="rounded-xl border border-purple-400/30 bg-purple-500/10 px-5 py-4 text-sm text-purple-200">
            {notice}
          </div>
        </div>
      )}

      {/* ACTIVE GIVEAWAYS */}
      <section id="active" className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-black tracking-[0.3em] text-purple-400">
            WHAT'S HAPPENING
          </p>
          <h2 className="mt-4 text-3xl font-black md:text-4xl">
            Current Giveaways<span className="text-purple-500">.</span>
          </h2>
          <p className="mt-3 text-sm text-gray-500">
            Check the prize, dates and participation details before entering.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] p-12 text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-purple-400/20 border-t-purple-400" />
            <p className="mt-5 text-sm text-gray-400">
              Loading community events...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/5 p-10 text-center">
            <p className="text-sm text-gray-300">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                loadGiveaways();
              }}
              className="mt-5 rounded-lg bg-purple-600 px-6 py-3 text-sm font-bold hover:bg-purple-500"
            >
              Try again
            </button>
          </div>
        ) : liveGiveaways.length === 0 && upcomingGiveaways.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d0d14] px-7 py-16 text-center">
            <div className="text-4xl">🎮</div>
            <h3 className="mt-5 text-2xl font-black">
              No active giveaways right now
            </h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-gray-500">
              We don't want to advertise events that aren't available.
              Check back here when the next community giveaway is published.
            </p>
            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-block text-sm font-bold text-purple-300 hover:text-white"
            >
              Follow the NELVA community ↗
            </a>
          </div>
        ) : (
          <div className="grid gap-7 lg:grid-cols-2">
            {[...liveGiveaways, ...upcomingGiveaways].map((item) => {
              const isLive =
                new Date(item.starts_at).getTime() <= now &&
                new Date(item.ends_at).getTime() > now;

              const entered = enteredGiveaways.includes(item.id);
              const busy = busyId === item.id;
              const remaining = getRemaining(item.ends_at, now);

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d14] transition hover:border-purple-400/30"
                >
                  <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden bg-[#11101a] p-8">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.prize}
                        className="h-48 w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="text-center">
                        <span className="text-6xl">🎁</span>
                        <p className="mt-4 text-xs font-black tracking-widest text-gray-600">
                          NELVA COMMUNITY EVENT
                        </p>
                      </div>
                    )}

                    <span
                      className={`absolute left-5 top-5 rounded-full border px-3 py-2 text-[10px] font-black tracking-widest ${
                        isLive
                          ? "border-green-400/30 bg-green-500/10 text-green-300"
                          : "border-purple-400/30 bg-purple-500/10 text-purple-300"
                      }`}
                    >
                      {isLive ? "OPEN FOR ENTRIES" : "UPCOMING"}
                    </span>
                  </div>

                  <div className="p-7">
                    <p className="text-[10px] font-black tracking-[0.25em] text-purple-400">
                      THE PRIZE
                    </p>

                    <p className="mt-2 text-2xl font-black">
                      {item.prize}
                    </p>

                    <h3 className="mt-5 text-xl font-bold">
                      {item.title}
                    </h3>

                    <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-400">
                      {item.description || "Additional giveaway details have not been published yet."}
                    </p>

                    <div className="mt-7 grid grid-cols-2 gap-4 border-y border-white/10 py-5">
                      <div>
                        <p className="text-[10px] font-bold tracking-widest text-gray-600">
                          STARTS
                        </p>
                        <p className="mt-2 text-xs font-semibold text-gray-300">
                          {formatDate(item.starts_at)}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold tracking-widest text-gray-600">
                          ENTRIES CLOSE
                        </p>
                        <p className="mt-2 text-xs font-semibold text-gray-300">
                          {formatDate(item.ends_at)}
                        </p>
                      </div>
                    </div>

                    {isLive && (
                      <div className="mt-5 rounded-xl border border-purple-400/15 bg-purple-500/[0.06] p-5">
                        <p className="text-[10px] font-black tracking-widest text-purple-300">
                          TIME REMAINING
                        </p>

                        <div className="mt-3 grid grid-cols-4 gap-2">
                          {[
                            ["DAYS", remaining.days],
                            ["HOURS", remaining.hours],
                            ["MINS", remaining.minutes],
                            ["SECS", remaining.seconds],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-lg bg-black/30 p-3 text-center"
                            >
                              <p className="text-xl font-black tabular-nums">
                                {String(value).padStart(2, "0")}
                              </p>
                              <p className="mt-1 text-[9px] font-bold text-gray-500">
                                {label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold tracking-widest text-gray-600">
                          PARTICIPANTS
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums">
                          {(entryCounts[item.id] || 0).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-600">
                          No participant limit
                        </p>
                      </div>

                      {entered ? (
                        <button
                          disabled
                          className="rounded-lg border border-green-400/30 bg-green-500/10 px-5 py-3 text-sm font-bold text-green-300"
                        >
                          ✓ ENTRY RECORDED
                        </button>
                      ) : isLive ? (
                        <button
                          onClick={() => enterGiveaway(item)}
                          disabled={busy}
                          className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-black transition hover:bg-purple-500 disabled:cursor-wait disabled:opacity-50"
                        >
                          {busy
                            ? "PLEASE WAIT..."
                            : userId
                              ? "ENTER GIVEAWAY →"
                              : "SIGN IN TO ENTER →"}
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-purple-300">
                          OPENS SOON
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* HOW IT WORKS */}
      <section
        id="rules"
        className="border-y border-white/10 bg-[#0b0b12] py-20"
      >
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs font-black tracking-[0.3em] text-purple-400">
            KNOW BEFORE YOU ENTER
          </p>

          <h2 className="mt-4 text-3xl font-black md:text-4xl">
            How participation works<span className="text-purple-500">.</span>
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Read the details",
                text: "Check the prize, eligibility requirements, dates and winner-selection method in the published giveaway information.",
              },
              {
                number: "02",
                title: "Sign in and enter",
                text: "Sign in using your NELVA account and submit one entry while the giveaway is open.",
              },
              {
                number: "03",
                title: "Check the results",
                text: "After entries close, check the giveaway history for the published outcome and winner information.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-white/10 bg-[#101018] p-7"
              >
                <p className="text-sm font-black text-purple-400">
                  {step.number}
                </p>
                <h3 className="mt-5 text-xl font-black">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-gray-500">
                  {step.text}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-yellow-400/20 bg-yellow-500/[0.04] p-6">
            <p className="text-sm font-bold text-yellow-200">
              Before entering
            </p>
            <p className="mt-2 text-sm leading-7 text-gray-400">
              Read the full giveaway description. Eligibility, prize
              delivery arrangements and the winner-selection method
              should be clear before you participate. If important
              information is missing, wait until NELVA publishes it.
            </p>
          </div>
        </div>
      </section>

      {/* GIVEAWAY HISTORY */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-xs font-black tracking-[0.3em] text-purple-400">
          PAST COMMUNITY EVENTS
        </p>

        <h2 className="mt-4 text-3xl font-black md:text-4xl">
          Giveaway History<span className="text-purple-500">.</span>
        </h2>

        <p className="mt-3 text-sm text-gray-500">
          Previous events and their published results.
        </p>

        <div className="mt-9">
          {loading ? (
            <p className="text-sm text-gray-500">
              Loading giveaway history...
            </p>
          ) : endedGiveaways.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0d0d14] p-9">
              <p className="font-bold">No previous giveaways yet.</p>
              <p className="mt-2 text-sm text-gray-500">
                Completed community events will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {endedGiveaways.map((item) => {
                const winnerUsername = item.winner_user_id
                  ? winnerProfiles[item.winner_user_id]
                  : null;

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-[#0d0d14] p-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black tracking-widest text-gray-600">
                          COMPLETED EVENT
                        </p>
                        <h3 className="mt-3 text-lg font-bold">
                          {item.title}
                        </h3>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-gray-400">
                        ENDED
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-purple-300">
                      Prize: {item.prize}
                    </p>

                    <p className="mt-3 text-xs text-gray-600">
                      Closed: {formatDate(item.ends_at)}
                    </p>

                    <div className="mt-5 border-t border-white/10 pt-4">
                      {winnerUsername ? (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-widest text-green-400">
                            Official winner
                          </p>
                          <a
                            href={`/profile/${encodeURIComponent(winnerUsername)}`}
                            className="mt-2 inline-block text-lg font-black text-white transition hover:text-purple-300"
                          >
                            @{winnerUsername}
                          </a>
                          <p className="mt-1 text-xs text-gray-500">
                            Selected from eligible giveaway entries.
                          </p>
                        </div>
                      ) : item.winner_user_id ? (
                        <p className="text-sm font-semibold text-green-300">
                          Winner selected. Public profile information is
                          currently unavailable.
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Winner announcement pending.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* TRUST FOOTER */}
      <section className="border-t border-white/10 bg-[#0b0b12]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-black">
                Your trust matters.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-gray-500">
                NELVA will not ask you for payment to enter or claim a
                prize. Never share passwords, verification codes or
                sensitive financial information with someone claiming
                to be a giveaway organizer.
              </p>
            </div>

            <div className="md:text-right">
              <p className="text-sm font-bold text-gray-300">
                Need help or have a concern?
              </p>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-bold text-purple-300 hover:text-white"
              >
                Visit the NELVA Discord community ↗
              </a>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-7 text-xs text-gray-600">
            <a
              href="/"
              className="text-xl font-black tracking-[-0.07em] text-white"
            >
              NELVA<span className="text-purple-500">.</span>
            </a>
            <p>© 2026 NELVA. Built for gamers, by gamers.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
