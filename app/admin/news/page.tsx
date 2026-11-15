
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Article = {
  title: string;
  link: string;
  publishedAt: string;
  description: string;
  source: string;
  image?: string;
  featured: boolean;
};

type NewsControl = {
  article_url: string;
  is_hidden: boolean;
  is_featured: boolean;
};

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [controls, setControls] = useState<Record<string, NewsControl>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadNews();
  }, []);

  async function loadNews() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/news");
      const data = await response.json();

      if (!data.success) {
        throw new Error("Could not load news.");
      }

      setArticles(data.articles || []);

      const { data: controlData, error } = await supabase
        .from("news_controls")
        .select("article_url, is_hidden, is_featured");

      if (error) {
        throw error;
      }

      const controlMap: Record<string, NewsControl> = {};

      (controlData || []).forEach((control: NewsControl) => {
        controlMap[control.article_url] = control;
      });

      setControls(controlMap);
    } catch (error) {
      console.error(error);
      setMessage("Failed to load news management data.");
    } finally {
      setLoading(false);
    }
  }

  async function updateControl(
    article: Article,
    field: "is_hidden" | "is_featured",
    value: boolean
  ) {
    setSaving(article.link);
    setMessage("");

    const existing = controls[article.link];

    const updatedControl = {
      article_url: article.link,
      is_hidden: existing?.is_hidden ?? false,
      is_featured: existing?.is_featured ?? false,
      updated_at: new Date().toISOString(),
      [field]: value,
    };

    const { error } = await supabase
      .from("news_controls")
      .upsert(updatedControl, {
        onConflict: "article_url",
      });

    if (error) {
      console.error(error);
      setMessage("Could not save changes. Check your admin permissions.");
      setSaving(null);
      return;
    }

    setControls((previous) => ({
      ...previous,
      [article.link]: {
        article_url: article.link,
        is_hidden: updatedControl.is_hidden,
        is_featured: updatedControl.is_featured,
      },
    }));

    setMessage("Changes saved successfully.");
    setSaving(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-20 text-white">
        <p className="text-center text-purple-400">
          Loading news management...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-purple-500">
              NELVA ADMIN
            </p>

            <h1 className="text-3xl font-black sm:text-4xl">
              News Management
            </h1>

            <p className="mt-2 text-gray-400">
              Feature articles or hide them from the public news feed.
            </p>
          </div>

          <button
            onClick={loadNews}
            className="rounded-xl border border-purple-500/40 px-5 py-3 text-sm font-bold text-purple-300 transition hover:bg-purple-500/10"
          >
            Refresh News
          </button>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-sm text-purple-200">
            {message}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm text-gray-400">Articles loaded</span>
            <p className="text-2xl font-black">{articles.length}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm text-gray-400">Featured</span>
            <p className="text-2xl font-black text-purple-400">
              {
                articles.filter(
                  (article) =>
                    controls[article.link]?.is_featured ??
                    article.featured
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <span className="text-sm text-gray-400">Hidden</span>
            <p className="text-2xl font-black text-red-400">
              {
                articles.filter(
                  (article) => controls[article.link]?.is_hidden
                ).length
              }
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {articles.map((article) => {
            const control = controls[article.link];

            const isFeatured =
              control?.is_featured ?? article.featured;

            const isHidden = control?.is_hidden ?? false;

            const isSaving = saving === article.link;

            return (
              <article
                key={article.link}
                className={`rounded-2xl border p-5 transition ${
                  isHidden
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <div className="flex flex-col gap-5 md:flex-row">
                  {article.image && (
                    <img
                      src={article.image}
                      alt=""
                      className="h-40 w-full rounded-xl object-cover md:w-56"
                    />
                  )}

                  <div className="flex-1">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                        {article.source}
                      </span>

                      {isFeatured && (
                        <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                          FEATURED
                        </span>
                      )}

                      {isHidden && (
                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                          HIDDEN
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold leading-relaxed">
                      {article.title}
                    </h2>

                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-400">
                      {article.description}
                    </p>

                    <p className="mt-3 text-xs text-gray-500">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleString()
                        : "Publication date unavailable"}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        disabled={isSaving}
                        onClick={() =>
                          updateControl(
                            article,
                            "is_featured",
                            !isFeatured
                          )
                        }
                        className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm font-bold text-purple-300 transition hover:bg-purple-500/10 disabled:opacity-50"
                      >
                        {isSaving
                          ? "Saving..."
                          : isFeatured
                          ? "Unfeature"
                          : "Feature Article"}
                      </button>

                      <button
                        disabled={isSaving}
                        onClick={() =>
                          updateControl(
                            article,
                            "is_hidden",
                            !isHidden
                          )
                        }
                        className={`rounded-lg border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
                          isHidden
                            ? "border-green-500/40 text-green-300 hover:bg-green-500/10"
                            : "border-red-500/40 text-red-300 hover:bg-red-500/10"
                        }`}
                      >
                        {isHidden ? "Show Article" : "Hide Article"}
                      </button>

                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-gray-300 transition hover:bg-white/5"
                      >
                        Read Article ↗
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {articles.length === 0 && (
          <p className="py-20 text-center text-gray-500">
            No gaming news is available right now.
          </p>
        )}
      </div>
    </main>
  );
}
