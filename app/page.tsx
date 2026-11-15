"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DISCORD_INVITE = "https://discord.gg/wGVuF3FaH";

const games = [
  {
    name: "Grand Theft Auto VI",
    genre: "ACTION · OPEN WORLD",
    status: "COMING SOON",
    image: "/images/gta.jpg",
    description: "The next chapter of an iconic open-world universe.",
  },
  {
    name: "Minecraft",
    genre: "SANDBOX · SURVIVAL",
    status: "POPULAR",
    image: "/images/minecraft.png",
    description: "Build, explore and create your own adventures.",
  },
  {
    name: "Valorant",
    genre: "TACTICAL · FPS",
    status: "POPULAR",
    image: "/images/valorant.webp",
    description: "A tactical shooter where precision matters.",
  },
];

type NewsArticle = {
  title: string;
  link: string;
  publishedAt: string;
  description: string;
  source: string;
  image?: string;
  featured?: boolean;
};

type Giveaway = {
  id: string;
  title: string;
  description: string;
  prize: string;
  image_url: string | null;
  starts_at: string;
  ends_at: string;
};

// GENERATE A CONSISTENT INTERNAL ARTICLE URL
function createArticleSlug(article: NewsArticle) {
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

const communityCharacters = [
  {
    name: "Naruto",
    image: "https://pnggallery.com/wp-content/uploads/naruto-01.png",
    message: "Believe it! Your next adventure starts here!",
  },
  {
    name: "Luffy",
    image:
      "https://www.pngkey.com/png/detail/304-3047949_monkey-d-luffy-one-piece.png",
    message: "Come join the crew! There's room for everyone!",
  },
];

const newsCategories = [
  "All News",
  "PC",
  "PlayStation",
  "Xbox",
  "Nintendo",
  "Mobile",
] as const;

type NewsCategory = (typeof newsCategories)[number];

function matchesNewsCategory(
  item: NewsArticle,
  category: NewsCategory
) {
  if (category === "All News") return true;

  const text = `${item.title} ${item.description || ""}`.toLowerCase();

  const patterns: Record<Exclude<NewsCategory, "All News">, RegExp> = {
    PC: /\b(pc gaming|pc game|steam|windows pc|nvidia|amd|graphics card|gpu|epic games store)\b/i,
    PlayStation: /\b(playstation|ps5|ps4|ps vr|playstation plus)\b/i,
    Xbox: /\b(xbox|game pass|xbox series)\b/i,
    Nintendo: /\b(nintendo|switch 2|nintendo switch)\b/i,
    Mobile: /\b(mobile gaming|mobile game|android game|ios game|iphone game|ipad game|google play|app store)\b/i,
  };

  return patterns[category].test(text);
}

export default function Home() {
  const [activeHero, setActiveHero] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [communitySlide, setCommunitySlide] = useState(0);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [activeNewsCategory, setActiveNewsCategory] =
    useState<NewsCategory>("All News");
  const [newsSearch, setNewsSearch] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedArticles, setSavedArticles] = useState<string[]>([]);
  const [savingArticle, setSavingArticle] = useState<string | null>(null);

  // GIVEAWAY SPOTLIGHT
  const [featuredGiveaway, setFeaturedGiveaway] = useState<Giveaway | null>(null);
  const [giveawayEntryCount, setGiveawayEntryCount] = useState(0);
  const [giveawayLoading, setGiveawayLoading] = useState(true);
  const [clockNow, setClockNow] = useState(0);

  // LOAD THE CURRENT LIVE GIVEAWAY AND ITS PUBLIC ENTRY COUNT
  useEffect(() => {
    let mounted = true;

    async function loadFeaturedGiveaway() {
      try {
        const now = new Date().toISOString();

        const { data, error } = await supabase
          .from("giveaways")
          .select("id, title, description, prize, image_url, starts_at, ends_at")
          .eq("status", "active")
          .lte("starts_at", now)
          .gt("ends_at", now)
          .order("ends_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (mounted) {
          setFeaturedGiveaway((data as Giveaway | null) ?? null);
        }

        if (data) {
          const { data: counts, error: countError } = await supabase.rpc(
            "get_giveaway_entry_counts"
          );

          if (countError) throw countError;

          const matchingCount = (counts || []).find(
            (item: { giveaway_id: string; entry_count: number | string }) =>
              item.giveaway_id === data.id
          );

          if (mounted) {
            setGiveawayEntryCount(Number(matchingCount?.entry_count || 0));
          }
        } else if (mounted) {
          setGiveawayEntryCount(0);
        }
      } catch (error) {
        console.error("Featured giveaway loading failed:", error);

        if (mounted) {
          setFeaturedGiveaway(null);
          setGiveawayEntryCount(0);
        }
      } finally {
        if (mounted) {
          setGiveawayLoading(false);
        }
      }
    }

    loadFeaturedGiveaway();

    return () => {
      mounted = false;
    };
  }, []);

  // KEEP THE GIVEAWAY COUNTDOWN MOVING
  useEffect(() => {
  setClockNow(Date.now());

  const timer = setInterval(() => {
    setClockNow(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);
  // AUTHENTICATION
  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const { data } = await supabase.auth.getUser();

      if (mounted) {
        setIsLoggedIn(!!data.user);
        setAuthLoading(false);
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsLoggedIn(!!session?.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // LOAD NEWS
  useEffect(() => {
    let mounted = true;

    async function loadNews() {
      try {
        setNewsLoading(true);
        setNewsError(false);

        const response = await fetch("/api/news");

        if (!response.ok) {
          throw new Error("Failed to load news");
        }

        const data = await response.json();

        if (mounted) {
          setNews(Array.isArray(data) ? data : data.articles || []);
        }
      } catch (error) {
        console.error("News loading failed:", error);

        if (mounted) {
          setNewsError(true);
        }
      } finally {
        if (mounted) {
          setNewsLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      mounted = false;
    };
  }, []);

  // LOAD USER BOOKMARKS
  useEffect(() => {
    let mounted = true;

    async function loadBookmarks() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) setSavedArticles([]);
        return;
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .select("article_url")
        .eq("user_id", user.id);

      if (!error && mounted) {
        setSavedArticles(data.map((item) => item.article_url));
      }
    }

    loadBookmarks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadBookmarks();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // SAVE / REMOVE BOOKMARK
  async function handleBookmark(item: NewsArticle) {
    if (savingArticle) return;

    setSavingArticle(item.link);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      const isSaved = savedArticles.includes(item.link);

      if (isSaved) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", user.id)
          .eq("article_url", item.link);

        if (error) throw error;

        setSavedArticles((current) =>
          current.filter((link) => link !== item.link)
        );
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user.id,
          article_url: item.link,
          article_title: item.title,
        });

        if (error) throw error;

        setSavedArticles((current) => [...current, item.link]);
      }
    } catch (error) {
      console.error("Bookmark action failed:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setSavingArticle(null);
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHero((current) => (current + 1) % games.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCommunitySlide(
        (current) => (current + 1) % communityCharacters.length
      );
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const activeCharacter = communityCharacters[communitySlide];

  // SEARCH + CATEGORY FILTER; FEATURED ARTICLES APPEAR FIRST
  const filteredNews = news
    .filter((item) => {
      const matchesCategory = matchesNewsCategory(
        item,
        activeNewsCategory
      );

      const searchText = newsSearch.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        `${item.title} ${item.description || ""} ${item.source || ""}`
          .toLowerCase()
          .includes(searchText);

      return matchesCategory && matchesSearch;
    })
    .sort(
      (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    );

  return (
    <main className="min-h-screen overflow-hidden bg-[#07070b] text-white">
      {/* NAVIGATION */}
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/[0.08] bg-[#07070b]/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <a
            href="#home"
            className="text-3xl font-black tracking-[-0.08em]"
          >
            NELVA<span className="text-purple-500">.</span>
          </a>

          <div className="hidden items-center gap-7 text-sm font-medium text-gray-400 md:flex">
            <a href="#home" className="text-white transition hover:text-purple-400">
              Home
            </a>

            <a href="#games" className="transition hover:text-purple-400">
              Games
            </a>

            <a href="#news" className="transition hover:text-purple-400">
              News
            </a>

            <a href="/giveaway" className="transition hover:text-purple-400">
              Giveaways
            </a>

            <a href="#community" className="transition hover:text-purple-400">
              Community
            </a>
          </div>

          <div className="hidden md:block">
            <a
              href="#community"
              className="rounded-lg bg-purple-600 px-5 py-3 text-sm font-bold transition hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-600/20"
            >
              Join Community
            </a>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            className="rounded-lg border border-white/10 px-4 py-2 text-xl md:hidden"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </nav>

        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0b0b12] px-6 py-5 md:hidden">
            <div className="flex flex-col gap-5 text-sm text-gray-300">
              <a href="#home" onClick={closeMenu}>Home</a>
              <a href="#games" onClick={closeMenu}>Games</a>
              <a href="#news" onClick={closeMenu}>News</a>

              <a
                href="/giveaway"
                onClick={closeMenu}
                className="font-bold text-purple-400"
              >
                Giveaways ↗
              </a>

              <a href="#community" onClick={closeMenu}>Community</a>

              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className="font-bold text-purple-400"
              >
                Join Discord ↗
              </a>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section
        id="home"
        className="relative flex min-h-screen items-center overflow-hidden"
      >
        {games.map((game, index) => (
          <div
            key={game.name}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              activeHero === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={game.image}
              alt={game.name}
              className="h-full w-full object-cover"
            />
          </div>
        ))}

        <div className="absolute inset-0 bg-gradient-to-r from-[#07070b] via-[#07070b]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07070b] via-transparent to-black/20" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 pt-32 md:px-8">
          <p className="text-xs font-bold tracking-[0.35em] text-purple-400">
            WELCOME TO NELVA
          </p>

          <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.05] tracking-tight md:text-7xl">
            YOUR WORLD.
            <br />
            YOUR <span className="text-purple-400">GAMES.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-gray-300 md:text-lg">
            Discover the latest gaming news, explore your favourite games
            and connect with a community built for gamers.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href="#news"
              className="rounded-lg bg-purple-600 px-8 py-4 text-sm font-bold transition hover:-translate-y-1 hover:bg-purple-500 hover:shadow-xl hover:shadow-purple-600/20"
            >
              Explore News →
            </a>

            <a
              href="#games"
              className="rounded-lg border border-white/20 bg-white/5 px-8 py-4 text-sm font-bold backdrop-blur-md transition hover:border-purple-400 hover:bg-purple-500/10"
            >
              Discover Games
            </a>
          </div>

          <div className="mt-12 flex items-center gap-3">
            {games.map((game, index) => (
              <button
                key={game.name}
                onClick={() => setActiveHero(index)}
                aria-label={`Show ${game.name}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  activeHero === index
                    ? "w-12 bg-purple-400"
                    : "w-5 bg-white/30 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          <div className="mt-7">
            <p className="text-xs font-bold tracking-widest text-gray-400">
              {games[activeHero].genre}
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {games[activeHero].name}
            </h2>

            <p className="mt-2 max-w-md text-sm text-gray-400">
              {games[activeHero].description}
            </p>
          </div>
        </div>
      </section>

      {/* INTRO STRIP */}
      <section className="border-y border-white/[0.08] bg-[#0d0c14]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-3 md:px-8">
          <div>
            <p className="text-xs font-bold tracking-widest text-purple-400">
              DISCOVER
            </p>
            <h3 className="mt-3 text-xl font-black">Explore the gaming world</h3>
            <p className="mt-2 text-sm leading-7 text-gray-400">
              Discover games, updates and stories from across the industry.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest text-purple-400">
              STAY UPDATED
            </p>
            <h3 className="mt-3 text-xl font-black">Never miss an update</h3>
            <p className="mt-2 text-sm leading-7 text-gray-400">
              Follow gaming news and keep up with the latest developments.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold tracking-widest text-purple-400">
              CONNECT
            </p>
            <h3 className="mt-3 text-xl font-black">Find your people</h3>
            <p className="mt-2 text-sm leading-7 text-gray-400">
              Meet other gamers and share your passion for gaming.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURED GAMES */}
      <section id="games" className="bg-[#09090e] py-24">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-12">
            <p className="text-xs font-bold tracking-[0.3em] text-purple-400">
              EXPLORE YOUR NEXT ADVENTURE
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Featured Games<span className="text-purple-500">.</span>
            </h2>

            <p className="mt-4 text-sm text-gray-400">
              Discover some of the games everyone is talking about.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {games.map((game) => (
              <article
                key={game.name}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-[#09090e] transition duration-500 hover:-translate-y-2 hover:border-purple-400/40"
              >
                <div className="relative">
                  <span className="absolute left-4 top-4 z-10 rounded-md border border-purple-400/30 bg-black/70 px-3 py-2 text-[10px] font-black tracking-wider text-purple-300 backdrop-blur-md">
                    {game.status}
                  </span>

                  <div className="aspect-video overflow-hidden bg-[#11101a]">
                    <img
                      src={game.image}
                      alt={game.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-[10px] font-bold tracking-widest text-purple-300">
                    {game.genre}
                  </p>

                  <h3 className="mt-3 text-2xl font-black">
                    {game.name}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-300">
                    {game.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* NELVA GIVEAWAY SPOTLIGHT */}
      <section className="relative overflow-hidden border-y border-purple-400/20 bg-[#08080d] py-20 md:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-purple-700/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-[110px]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 md:px-8">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-black tracking-[0.32em] text-purple-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.9)]" />
                THE NELVA DROP ZONE
              </p>

              <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                PLAY. ENTER. <span className="text-purple-400">WIN.</span>
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-gray-400">
                Real gaming rewards. One account, one entry per giveaway. No participant cap.
              </p>
            </div>

            <a
              href="/giveaway"
              className="group inline-flex items-center gap-3 text-sm font-bold text-purple-300 transition hover:text-white"
            >
              VIEW GIVEAWAYS
              <span className="transition group-hover:translate-x-1">↗</span>
            </a>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-purple-400/25 bg-[#101018] shadow-[0_25px_100px_rgba(91,33,182,0.16)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_50%,rgba(126,34,206,0.22),transparent_48%)]" />
            <div className="absolute right-0 top-0 h-full w-1/3 border-l border-white/[0.04] bg-white/[0.015]" />

            {giveawayLoading ? (
              <div className="relative grid min-h-[340px] place-items-center p-8 text-center">
                <div>
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-purple-400/20 border-t-purple-400" />
                  <p className="mt-5 text-sm text-gray-400">
                    Checking the NELVA drop zone...
                  </p>
                </div>
              </div>
            ) : featuredGiveaway ? (
              <div className="relative grid gap-8 p-7 md:grid-cols-[1.15fr_0.85fr] md:items-center md:p-12">
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-purple-300/30 bg-purple-500/15 px-3 py-1.5 text-[10px] font-black tracking-[0.2em] text-purple-200">
                      LIVE GIVEAWAY
                    </span>

                    <span className="text-[10px] font-bold tracking-[0.2em] text-gray-500">
                      NELVA COMMUNITY DROP
                    </span>
                  </div>

                  <p className="mt-8 text-xs font-black tracking-[0.3em] text-gray-500">
                    THIS DROP COULD BE YOURS
                  </p>

                  <h3 className="mt-3 max-w-2xl text-3xl font-black leading-tight md:text-5xl">
                    {featuredGiveaway.title}
                  </h3>

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-purple-300">
                    THE PRIZE
                  </p>

                  <p className="mt-2 text-2xl font-black text-white md:text-3xl">
                    {featuredGiveaway.prize}
                  </p>

                  {featuredGiveaway.description && (
                    <p className="mt-4 max-w-xl text-sm leading-7 text-gray-400">
                      {featuredGiveaway.description}
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <a
                      href="/giveaway"
                      className="inline-flex items-center gap-3 rounded-xl bg-purple-600 px-7 py-4 text-sm font-black tracking-wide text-white shadow-lg shadow-purple-900/30 transition hover:-translate-y-1 hover:bg-purple-500 hover:shadow-purple-600/30"
                    >
                      ENTER THIS GIVEAWAY <span>→</span>
                    </a>

                    <span className="text-xs text-gray-500">
                      Free to enter · Discord account required
                    </span>
                  </div>
                </div>

                <div className="relative z-10">
                  <div className="relative mx-auto flex min-h-[270px] max-w-md flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#09090f]/80 p-6 md:min-h-[310px] md:p-8">
                    {featuredGiveaway.image_url ? (
                      <img
                        src={featuredGiveaway.image_url}
                        alt={featuredGiveaway.prize}
                        className="absolute inset-0 h-full w-full object-contain p-8 opacity-20"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full border-[24px] border-purple-500/10" />
                    )}

                    <div className="relative">
                      <p className="text-[10px] font-black tracking-[0.25em] text-gray-500">
                        ENTRIES CLOSE IN
                      </p>

                      <div className="mt-5 grid grid-cols-4 gap-2">
                        {(() => {
                          const remaining = Math.max(
                            0,
                            new Date(featuredGiveaway.ends_at).getTime() - clockNow
                          );

                          const units = [
                            {
                              label: "DAYS",
                              value: Math.floor(remaining / 86400000),
                            },
                            {
                              label: "HRS",
                              value: Math.floor(
                                (remaining % 86400000) / 3600000
                              ),
                            },
                            {
                              label: "MIN",
                              value: Math.floor(
                                (remaining % 3600000) / 60000
                              ),
                            },
                            {
                              label: "SEC",
                              value: Math.floor(
                                (remaining % 60000) / 1000
                              ),
                            },
                          ];

                          return units.map((unit) => (
                            <div
                              key={unit.label}
                              className="rounded-xl border border-purple-300/15 bg-purple-500/[0.07] px-2 py-4 text-center"
                            >
                              <p className="text-2xl font-black tabular-nums text-white md:text-3xl">
                                {String(unit.value).padStart(2, "0")}
                              </p>

                              <p className="mt-1 text-[9px] font-black tracking-widest text-purple-300">
                                {unit.label}
                              </p>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    <div className="relative mt-8 flex items-end justify-between border-t border-white/10 pt-5">
                      <div>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-gray-500">
                          TOTAL ENTRIES
                        </p>

                        <p className="mt-1 text-3xl font-black tabular-nums text-white">
                          {giveawayEntryCount.toLocaleString()}
                        </p>
                      </div>

                      <p className="text-right text-[10px] font-bold leading-5 text-gray-500">
                        UNLIMITED
                        <br />
                        PARTICIPANTS
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-12">
                <div>
                  <p className="text-xs font-black tracking-[0.28em] text-purple-300">
                    THE NEXT DROP IS LOADING
                  </p>

                  <h3 className="mt-4 max-w-2xl text-3xl font-black leading-tight md:text-5xl">
                    YOUR NEXT GAMING WIN STARTS HERE.
                  </h3>

                  <p className="mt-4 max-w-xl text-sm leading-7 text-gray-400">
                    No live giveaway at this exact moment. Check the giveaway page for announcements and previous winners.
                  </p>
                </div>

                <a
                  href="/giveaway"
                  className="inline-flex items-center justify-center gap-3 rounded-xl border border-purple-400/40 bg-purple-500/10 px-7 py-4 text-sm font-black text-purple-200 transition hover:-translate-y-1 hover:bg-purple-500/20 hover:text-white"
                >
                  EXPLORE GIVEAWAYS <span>→</span>
                </a>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold tracking-[0.16em] text-gray-600">
            <span>NO ENTRY FEE. NO PARTICIPANT LIMIT.</span>
            <span>ONE ENTRY PER ACCOUNT · FAIR PLAY ONLY</span>
          </div>
        </div>
      </section>

      {/* LATEST NEWS */}
      <section
        id="news"
        className="relative overflow-hidden border-y border-white/[0.08]"
      >
        <div className="absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="h-full w-full object-cover"
          >
            <source src="/videos/clouds.mp4" type="video/mp4" />
          </video>
        </div>

        <div className="absolute inset-0 bg-[#080a0f]/35" />

        <div className="relative z-[2] mx-auto max-w-7xl px-6 py-24 md:px-8">
          <div className="mb-12">
            <p className="text-xs font-bold tracking-[0.3em] text-purple-400">
              THE LATEST FROM THE GAMING WORLD
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Latest News<span className="text-purple-500">.</span>
            </h2>

            <p className="mt-4 text-sm text-gray-200">
              Stories, updates and conversations worth following.
            </p>
          </div>

          {/* NEWS SEARCH */}
          <div className="mb-6">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#10131a]/80 px-5 py-4 backdrop-blur-md transition focus-within:border-purple-400/60">
              <span className="text-xl text-purple-400">⌕</span>

              <input
                type="search"
                value={newsSearch}
                onChange={(event) => setNewsSearch(event.target.value)}
                placeholder="Search gaming news, games or topics..."
                aria-label="Search gaming news"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
              />

              {newsSearch && (
                <button
                  type="button"
                  onClick={() => setNewsSearch("")}
                  aria-label="Clear search"
                  className="shrink-0 text-xs font-bold text-purple-400 transition hover:text-white"
                >
                  CLEAR ✕
                </button>
              )}
            </div>
          </div>

          {/* NEWS CATEGORY FILTERS */}
          <div className="mb-8 flex flex-wrap gap-2">
            {newsCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveNewsCategory(category)}
                aria-pressed={activeNewsCategory === category}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                  activeNewsCategory === category
                    ? "border-purple-400 bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                    : "border-white/10 bg-black/40 text-gray-300 hover:border-purple-400/50 hover:text-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {newsLoading ? (
            <p className="rounded-xl border border-white/10 bg-[#11141b]/75 p-7 text-sm text-gray-300 backdrop-blur-md">
              Loading the latest gaming news...
            </p>
          ) : newsError ? (
            <p className="rounded-xl border border-white/10 bg-[#11141b]/75 p-7 text-sm text-gray-300 backdrop-blur-md">
              We couldn't load the news right now. Please refresh the page to try again.
            </p>
          ) : news.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-[#11141b]/75 p-7 text-sm text-gray-300 backdrop-blur-md">
              No news articles are available right now. Please check back soon.
            </p>
          ) : filteredNews.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-[#11141b]/75 p-7 text-sm text-gray-300 backdrop-blur-md">
              {newsSearch.trim()
                ? `No articles found for "${newsSearch}". Try another search.`
                : "No articles matched this category. Try another filter."}
            </p>
          ) : (
            <>
              <p className="mb-5 text-xs text-gray-400">
                Showing {Math.min(filteredNews.length, 6)} of {filteredNews.length} matching articles
              </p>

              <div className="grid gap-5 md:grid-cols-3">
                {filteredNews.slice(0, 6).map((item, index) => {
                  const isSaved = savedArticles.includes(item.link);
                  const isSaving = savingArticle === item.link;

                  return (
                    <article
                      key={`${item.link}-${index}`}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#10131a]/75 shadow-xl backdrop-blur-md transition duration-500 hover:-translate-y-1.5 hover:border-purple-400/40"
                    >
                      <a
                        href={`/news/${createArticleSlug(item)}`}
                        className="block"
                      >
                        <div className="relative aspect-[16/9] overflow-hidden bg-[#11141b]">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-5xl font-black tracking-[-0.12em] text-white/10">
                              NELVA
                            </span>
                          </div>

                          {item.featured && (
                            <span className="absolute right-3 top-3 z-10 rounded-md border border-purple-400/40 bg-purple-600 px-3 py-2 text-[10px] font-black tracking-widest text-white shadow-lg">
                              ★ FEATURED
                            </span>
                          )}

                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                              className="relative z-[1] h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            />
                          )}

                          <div className="absolute inset-0 z-[2] bg-gradient-to-t from-[#10131a] via-transparent to-black/10" />

                          <span className="absolute bottom-3 left-4 z-[3] rounded-md border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-black tracking-wider text-purple-200 backdrop-blur-md">
                            {item.source || "GAMING NEWS"}
                          </span>
                        </div>

                        <div className="p-6">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-black tracking-wider text-purple-400">
                              {item.source || "GAMING NEWS"}
                            </span>

                            <span className="text-2xl font-black text-white/10">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>

                          <h3 className="mt-5 min-h-[90px] text-xl font-bold leading-snug transition group-hover:text-purple-300">
                            {item.title}
                          </h3>

                          {item.description && (
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-300">
                              {item.description}
                            </p>
                          )}

                          <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5">
                            <span className="text-[10px] font-bold tracking-wider text-gray-400">
                              {item.publishedAt &&
                              !Number.isNaN(new Date(item.publishedAt).getTime())
                                ? new Date(item.publishedAt).toLocaleDateString()
                                : "LATEST"}
                            </span>

                            <span className="text-purple-400 transition group-hover:translate-x-1">
                              READ STORY →
                            </span>
                          </div>
                        </div>
                      </a>

                      <div className="px-6 pb-6">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleBookmark(item)}
                          className={`w-full rounded-lg border px-4 py-3 text-sm font-bold transition ${
                            isSaved
                              ? "border-purple-500/40 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30"
                              : "border-white/10 bg-white/[0.04] text-gray-300 hover:border-purple-500/40 hover:text-white"
                          } disabled:cursor-wait disabled:opacity-50`}
                        >
                          {isSaving
                            ? "Please wait..."
                            : isSaved
                              ? "✓ Saved to Bookmarks"
                              : "♡ Save Article"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ANIMATED COMMUNITY */}
      <section
        id="community"
        className="relative overflow-hidden border-b border-white/[0.08]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.18),transparent_65%)]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2 md:px-8">
          {/* COMMUNITY CHARACTER */}
          <div className="relative flex min-h-[400px] items-center justify-center">
            <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded-2xl border border-purple-400/30 bg-[#171323] px-6 py-4 text-center shadow-xl shadow-purple-900/20">
              <p className="text-sm font-semibold text-gray-200">
                {activeCharacter.message}
              </p>

              <span className="mt-2 block text-[10px] font-black tracking-[0.2em] text-purple-400">
                — {activeCharacter.name.toUpperCase()}
              </span>

              <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-purple-400/30 bg-[#171323]" />
            </div>

            <img
              key={`character-${communitySlide}`}
              src={activeCharacter.image}
              alt={`${activeCharacter.name} anime character`}
              className="relative z-10 mt-24 h-[300px] max-w-full object-contain drop-shadow-[0_15px_35px_rgba(124,58,237,0.3)] animate-[fadeIn_1.2s_ease-in-out] md:h-[420px]"
            />

            <div className="absolute bottom-0 left-1/2 h-10 w-48 -translate-x-1/2 rounded-full bg-purple-500/20 blur-2xl" />
          </div>

          {/* COMMUNITY TEXT */}
          <div className="relative text-center md:text-left">
            <p className="text-xs font-bold tracking-[0.3em] text-purple-400">
              BE PART OF SOMETHING BIGGER
            </p>

            <h2 className="mt-6 text-4xl font-black leading-tight tracking-tight md:text-6xl">
              YOUR PEOPLE.
              <br />
              YOUR <span className="text-purple-400">COMMUNITY.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-gray-400 md:mx-0">
              Meet gamers, share experiences, discover new adventures and stay
              connected with people who love gaming as much as you do.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <a
                href={isLoggedIn ? "/dashboard" : "/auth"}
                className="inline-block rounded-lg bg-purple-600 px-9 py-4 text-sm font-bold transition hover:-translate-y-1 hover:bg-purple-500 hover:shadow-xl hover:shadow-purple-600/20"
              >
                {isLoggedIn ? "Go to Dashboard" : "Join NELVA"}{" "}
                <span className="ml-2">→</span>
              </a>

              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-purple-400/40 bg-purple-500/10 px-9 py-4 text-sm font-bold text-purple-200 transition hover:-translate-y-1 hover:border-purple-300 hover:bg-purple-500/20"
              >
                <span>🎮</span>
                Join Our Discord
                <span>↗</span>
              </a>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 md:justify-start">
              {communityCharacters.map((character, index) => (
                <button
                  key={character.name}
                  onClick={() => setCommunitySlide(index)}
                  aria-label={`Show ${character.name}`}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    communitySlide === index
                      ? "w-10 bg-purple-400"
                      : "w-5 bg-white/20 hover:bg-white/50"
                  }`}
                />
              ))}

              <span className="ml-2 text-[10px] font-bold tracking-widest text-gray-500">
                MEET THE COMMUNITY
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#09090e]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <a href="#home" className="text-2xl font-black tracking-[-0.07em]">
              NELVA<span className="text-purple-500">.</span>
            </a>

            <p className="mt-2 text-xs text-gray-600">
              Your world. Your games.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 text-xs text-gray-500">
            <a href="#home" className="transition hover:text-purple-400">Home</a>
            <a href="#games" className="transition hover:text-purple-400">Games</a>
            <a href="#news" className="transition hover:text-purple-400">News</a>
            <a href="/giveaway" className="transition hover:text-purple-400">Giveaways</a>
            <a href="#community" className="transition hover:text-purple-400">Community</a>

            <a
              href={DISCORD_INVITE}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-purple-400"
            >
              Discord ↗
            </a>
          </div>

          <p className="text-xs text-gray-600">
            © 2026 NELVA. Built for gamers, by gamers.
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}