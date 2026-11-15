
import { NextResponse, connection } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import Parser from "rss-parser";

export const instant = false;

const REQUEST_TIMEOUT = 10000;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: fetchWithTimeout,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

const parser = new Parser({
  customFields: {
    item: ["media:content", "media:thumbnail", "content:encoded"],
  },
});

const feeds = [
  {
    name: "PC Gamer",
    url: "https://www.pcgamer.com/rss/",
  },
  {
    name: "GameSpot",
    url: "https://www.gamespot.com/feeds/mashup/",
  },
  {
    name: "Eurogamer",
    url: "https://www.eurogamer.net/feed",
  },
];

type NewsControl = {
  article_url: string;
  is_hidden: boolean;
  is_featured: boolean;
};

let cachedControls: NewsControl[] | null = null;

function findImage(item: Parser.Item): string {
  const data = item as unknown as Record<string, unknown>;

  function findUrl(value: unknown): string {
    if (!value || typeof value !== "object") return "";

    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = findUrl(entry);
        if (found) return found;
      }

      return "";
    }

    const object = value as Record<string, unknown>;
    const attributes = object.$ as
      | Record<string, unknown>
      | undefined;

    const directUrl =
      object.url ||
      object.href ||
      attributes?.url ||
      attributes?.href;

    if (typeof directUrl === "string") {
      return directUrl;
    }

    for (const entry of Object.values(object)) {
      const found = findUrl(entry);
      if (found) return found;
    }

    return "";
  }

  const mediaImage =
    findUrl(data["media:content"]) ||
    findUrl(data["media:thumbnail"]) ||
    findUrl(data.enclosure);

  if (mediaImage) {
    return mediaImage.startsWith("//")
      ? `https:${mediaImage}`
      : mediaImage;
  }

  const html = [
    data["content:encoded"],
    item.content,
    data.description,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);

  if (match?.[1]) {
    return match[1].startsWith("//")
      ? `https:${match[1]}`
      : match[1];
  }

  return "";
}

async function loadFeed(feed: (typeof feeds)[number]) {
  try {
    const response = await fetchWithTimeout(feed.url, {
      headers: {
        "User-Agent": "NELVA Gaming News Reader/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const result = await parser.parseString(xml);

    return result.items.map((item) => ({
      title: item.title?.trim() || "Untitled story",
      link: item.link || "",
      publishedAt: item.isoDate || item.pubDate || "",
      description: item.contentSnippet || "",
      source: feed.name,
      image: findImage(item),
    }));
  } catch (error) {
    console.error(
      `NELVA ${feed.name} feed failed:`,
      error instanceof Error ? error.message : error
    );

    return [];
  }
}

async function loadNewsControls(): Promise<NewsControl[]> {
  try {
    const { data, error } = await supabase
      .from("news_controls")
      .select("article_url, is_hidden, is_featured");

    if (error) {
      throw error;
    }

    cachedControls = (data || []) as NewsControl[];

    return cachedControls;
  } catch (error) {
    console.error(
      "NELVA news controls request failed:",
      error instanceof Error ? error.message : error
    );

    return cachedControls || [];
  }
}

export async function GET() {
  await connection();

  try {
    const [feedResults, controls] = await Promise.all([
      Promise.all(feeds.map(loadFeed)),
      loadNewsControls(),
    ]);

    const rawArticles = feedResults
      .flat()
      .filter((article) => article.title && article.link)
      .sort((a, b) => {
        const dateA = new Date(a.publishedAt).getTime() || 0;
        const dateB = new Date(b.publishedAt).getTime() || 0;

        return dateB - dateA;
      });

    if (rawArticles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Gaming news providers are temporarily unavailable.",
          total: 0,
          articles: [],
        },
        { status: 503 }
      );
    }

    const controlMap = new Map(
      controls.map((control) => [
        control.article_url,
        control,
      ])
    );

    const articles = rawArticles
      .filter((article) => {
        const control = controlMap.get(article.link);
        return !control?.is_hidden;
      })
      .map((article) => ({
        ...article,
        featured:
          controlMap.get(article.link)?.is_featured ?? false,
      }))
      .slice(0, 30);

    return NextResponse.json(
      {
        success: true,
        total: articles.length,
        articles,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("NELVA news API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch gaming news.",
        total: 0,
        articles: [],
      },
      { status: 500 }
    );
  }
}
