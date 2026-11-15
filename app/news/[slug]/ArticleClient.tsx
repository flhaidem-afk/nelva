"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type NewsArticle = {
  title: string;
  link: string;
  publishedAt: string;
  description: string;
  source: string;
  image?: string;
  featured?: boolean;
};

type Comment = {
  id: string;
  user_id: string;
  article_url: string;
  article_title: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type CommentLike = {
  comment_id: string;
  user_id: string;
};

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

function formatCommentDate(date: string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkMessage, setBookmarkMessage] = useState("");

  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");

  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedCommentIds, setLikedCommentIds] = useState<string[]>([]);
  const [likeLoadingIds, setLikeLoadingIds] = useState<string[]>([]);

  const [reportingCommentId, setReportingCommentId] = useState<string | null>(
    null
  );
  const [reportReason, setReportReason] = useState("Spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (mounted) {
        setUserId(user?.id ?? null);
        setAuthChecked(true);
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUserId(session?.user?.id ?? null);
        setAuthChecked(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadArticle() {
      try {
        setLoading(true);
        setNotFound(false);

        const response = await fetch("/api/news");

        if (!response.ok) {
          throw new Error("Unable to load news");
        }

        const data = await response.json();

        const articles: NewsArticle[] = Array.isArray(data)
          ? data
          : data.articles || [];

        const found = articles.find(
          (item) => createArticleSlug(item) === slug
        );

        if (mounted) {
          if (found) {
            setArticle(found);
          } else {
            setNotFound(true);
          }
        }
      } catch (error) {
        console.error("Article loading failed:", error);

        if (mounted) {
          setNotFound(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (slug) {
      loadArticle();
    }

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    let mounted = true;

    async function checkBookmark() {
      if (!article || !authChecked) return;

      if (!userId) {
        setIsBookmarked(false);
        return;
      }

      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", userId)
        .eq("article_url", article.link)
        .maybeSingle();

      if (error) {
        console.error("Bookmark check failed:", error);
        return;
      }

      if (mounted) {
        setIsBookmarked(!!data);
      }
    }

    checkBookmark();

    return () => {
      mounted = false;
    };
  }, [article, userId, authChecked]);

  async function loadComments(articleUrl: string) {
    setCommentsLoading(true);
    setCommentMessage("");

    try {
      const { data, error } = await supabase
        .from("comments")
        .select(
          "id, user_id, article_url, article_title, content, parent_id, created_at, updated_at"
        )
        .eq("article_url", articleUrl)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedComments = (data || []) as Comment[];
      setComments(loadedComments);

      const commentIds = loadedComments.map((item) => item.id);
      const userIds = [...new Set(loadedComments.map((item) => item.user_id))];

      if (userIds.length === 0) {
        setProfiles({});
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (profileError) {
          console.error("Comment profile loading failed:", profileError);
        } else {
          const profileMap: Record<string, Profile> = {};

          (profileData || []).forEach((profile) => {
            profileMap[profile.id] = profile as Profile;
          });

          setProfiles(profileMap);
        }
      }

      if (commentIds.length === 0) {
        setLikeCounts({});
        setLikedCommentIds([]);
        return;
      }

      const { data: likesData, error: likesError } = await supabase
        .from("comment_likes")
        .select("comment_id, user_id")
        .in("comment_id", commentIds);

      if (likesError) {
        console.error("Comment likes loading failed:", likesError);
        setLikeCounts({});
        setLikedCommentIds([]);
        return;
      }

      const counts: Record<string, number> = {};
      const likedIds: string[] = [];

      ((likesData || []) as CommentLike[]).forEach((like) => {
        counts[like.comment_id] = (counts[like.comment_id] || 0) + 1;

        if (userId && like.user_id === userId) {
          likedIds.push(like.comment_id);
        }
      });

      setLikeCounts(counts);
      setLikedCommentIds(likedIds);
    } catch (error) {
      console.error("Comments loading failed:", error);
      setCommentMessage("Unable to load comments. Please refresh the page.");
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    if (article) {
      loadComments(article.link);
    }
  }, [article, userId]);

  async function toggleBookmark() {
    if (!article || bookmarkLoading) return;

    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    setBookmarkLoading(true);
    setBookmarkMessage("");

    try {
      if (isBookmarked) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", userId)
          .eq("article_url", article.link);

        if (error) throw error;

        setIsBookmarked(false);
        setBookmarkMessage("Article removed from your bookmarks.");
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: userId,
          article_url: article.link,
          article_title: article.title,
        });

        if (error) throw error;

        setIsBookmarked(true);
        setBookmarkMessage("Article saved to your bookmarks.");
      }
    } catch (error) {
      console.error("Bookmark update failed:", error);
      setBookmarkMessage("Unable to update bookmark. Please try again.");
    } finally {
      setBookmarkLoading(false);
    }
  }

    async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!article || !userId || commentSubmitting) return;

    const content = commentDraft.trim();

    if (!content) return;

    setCommentSubmitting(true);
    setCommentMessage("");

    try {
      const { error } = await supabase.from("comments").insert({
        user_id: userId,
        article_url: article.link,
        article_title: article.title,
        content,
        parent_id: null,
      });

      if (error) throw error;

      setCommentDraft("");
      setCommentMessage("Your comment has been posted.");
      await loadComments(article.link);
    } catch (error) {
      console.error("Comment submission failed:", error);
      setCommentMessage("Unable to post your comment. Please try again.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function submitReply(
    event: FormEvent<HTMLFormElement>,
    parentId: string
  ) {
    event.preventDefault();

    if (!article || !userId || commentSubmitting) return;

    const content = replyDraft.trim();

    if (!content) return;

    setCommentSubmitting(true);
    setCommentMessage("");

    try {
      const { error } = await supabase.from("comments").insert({
        user_id: userId,
        article_url: article.link,
        article_title: article.title,
        content,
        parent_id: parentId,
      });

      if (error) throw error;

      setReplyDraft("");
      setReplyingTo(null);
      setCommentMessage("Your reply has been posted.");
      await loadComments(article.link);
    } catch (error) {
      console.error("Reply submission failed:", error);
      setCommentMessage("Unable to post your reply. Please try again.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function saveEditedComment(commentId: string) {
    if (!userId || commentSubmitting) return;

    const content = editDraft.trim();

    if (!content) {
      setCommentMessage("A comment cannot be empty.");
      return;
    }

    setCommentSubmitting(true);
    setCommentMessage("");

    try {
      const { error } = await supabase
        .from("comments")
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId)
        .eq("user_id", userId);

      if (error) throw error;

      setEditingComment(null);
      setEditDraft("");
      setCommentMessage("Comment updated.");
      if (article) await loadComments(article.link);
    } catch (error) {
      console.error("Comment update failed:", error);
      setCommentMessage("Unable to update comment. Please try again.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!userId || commentSubmitting) return;

    const confirmed = window.confirm(
      "Delete this comment? Any replies to it will also be deleted."
    );

    if (!confirmed) return;

    setCommentSubmitting(true);
    setCommentMessage("");

    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", userId);

      if (error) throw error;

      setCommentMessage("Comment deleted.");
      if (article) await loadComments(article.link);
    } catch (error) {
      console.error("Comment deletion failed:", error);
      setCommentMessage("Unable to delete comment. Please try again.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function toggleCommentLike(commentId: string) {
    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    if (likeLoadingIds.includes(commentId)) return;

    setLikeLoadingIds((current) => [...current, commentId]);

    const alreadyLiked = likedCommentIds.includes(commentId);

    try {
      if (alreadyLiked) {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", userId);

        if (error) throw error;

        setLikedCommentIds((current) =>
          current.filter((id) => id !== commentId)
        );

        setLikeCounts((current) => ({
          ...current,
          [commentId]: Math.max(0, (current[commentId] || 0) - 1),
        }));
      } else {
        const { error } = await supabase.from("comment_likes").insert({
          comment_id: commentId,
          user_id: userId,
        });

        if (error) throw error;

        setLikedCommentIds((current) => [...current, commentId]);

        setLikeCounts((current) => ({
          ...current,
          [commentId]: (current[commentId] || 0) + 1,
        }));
      }
    } catch (error) {
      console.error("Comment like update failed:", error);
      setCommentMessage("Unable to update like. Please try again.");
    } finally {
      setLikeLoadingIds((current) =>
        current.filter((id) => id !== commentId)
      );
    }
  }

  async function submitCommentReport(
    event: FormEvent<HTMLFormElement>,
    commentId: string
  ) {
    event.preventDefault();

    if (!userId || reportSubmitting) return;

    setReportSubmitting(true);
    setReportMessage("");

    try {
      const { error } = await supabase.from("comment_reports").insert({
        comment_id: commentId,
        reporter_id: userId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          setReportMessage("You have already reported this comment.");
        } else {
          throw error;
        }
      } else {
        setReportMessage(
          "Report submitted. Thank you for helping keep NELVA safe."
        );
        setReportingCommentId(null);
        setReportDetails("");
        setReportReason("Spam");
      }
    } catch (error) {
      console.error("Comment report submission failed:", error);
      setReportMessage("Unable to submit your report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  function getAuthorName(authorId: string) {
    const profile = profiles[authorId];

    return profile?.display_name || profile?.username || "NELVA Gamer";
  }

  function renderComment(comment: Comment, isReply = false) {
    const isOwner = userId === comment.user_id;
    const author = profiles[comment.user_id];
    const authorName = getAuthorName(comment.user_id);
    const isLiked = likedCommentIds.includes(comment.id);
    const likeCount = likeCounts[comment.id] || 0;
    const likeLoading = likeLoadingIds.includes(comment.id);

    return (
      <div
        key={comment.id}
        className={`rounded-2xl border border-white/10 bg-[#11101a] p-5 ${
          isReply ? "ml-5 mt-3 border-purple-500/10 md:ml-10" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-500/30 bg-purple-950 text-sm font-black text-purple-300">
            {author?.avatar_url ? (
              <img
                src={author.avatar_url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              authorName.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-white">{authorName}</p>

              {author?.username && (
                <a
                  href={`/profile/${encodeURIComponent(author.username)}`}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  @{author.username}
                </a>
              )}

              <span className="text-xs text-gray-600">
                {formatCommentDate(comment.created_at)}
              </span>

              {comment.updated_at !== comment.created_at && (
                <span className="text-xs text-gray-600">(edited)</span>
              )}
            </div>

            {editingComment === comment.id ? (
              <div className="mt-4">
                <textarea
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-purple-500/30 bg-black/30 p-3 text-sm text-white outline-none focus:border-purple-500"
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={commentSubmitting}
                    onClick={() => saveEditedComment(comment.id)}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-50"
                  >
                    {commentSubmitting ? "Saving..." : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingComment(null);
                      setEditDraft("");
                    }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">
                {comment.content}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => toggleCommentLike(comment.id)}
                disabled={likeLoading}
                className={`text-xs font-bold transition disabled:opacity-50 ${
                  isLiked ? "text-purple-300" : "text-gray-500 hover:text-purple-300"
                }`}
              >
                {isLiked ? "♥ Liked" : "♡ Like"} ({likeCount})
              </button>

              {!isReply && userId && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(
                      replyingTo === comment.id ? null : comment.id
                    );
                    setReplyDraft("");
                  }}
                  className="text-xs font-bold text-gray-500 transition hover:text-purple-300"
                >
                  Reply
                </button>
              )}

              {isOwner && !editingComment && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingComment(comment.id);
                      setEditDraft(comment.content);
                    }}
                    className="text-xs font-bold text-gray-500 transition hover:text-white"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteComment(comment.id)}
                    disabled={commentSubmitting}
                    className="text-xs font-bold text-gray-500 transition hover:text-red-400 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}

              {userId && !isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setReportingCommentId(
                      reportingCommentId === comment.id ? null : comment.id
                    );
                    setReportMessage("");
                    setReportDetails("");
                  }}
                  className="text-xs font-bold text-gray-500 transition hover:text-red-400"
                >
                  Report
                </button>
              )}
            </div>

            {replyingTo === comment.id && !isReply && (
              <form
                onSubmit={(event) => submitReply(event, comment.id)}
                className="mt-5"
              >
                <textarea
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder="Write a reply..."
                  maxLength={2000}
                  rows={3}
                  required
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-purple-500"
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={commentSubmitting || !replyDraft.trim()}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold hover:bg-purple-500 disabled:opacity-50"
                  >
                    {commentSubmitting ? "Posting..." : "Post Reply"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyDraft("");
                    }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {reportingCommentId === comment.id && (
              <form
                onSubmit={(event) => submitCommentReport(event, comment.id)}
                className="mt-5 rounded-xl border border-red-500/20 bg-red-950/10 p-4"
              >
                <label className="text-xs font-bold text-gray-300">
                  Reason for report
                </label>

                <select
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#09090e] p-3 text-sm text-white outline-none focus:border-red-500"
                >
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment or bullying</option>
                  <option value="Hate speech">Hate speech</option>
                  <option value="Inappropriate content">Inappropriate content</option>
                  <option value="Misinformation">Misinformation</option>
                  <option value="Other">Other</option>
                </select>

                <label className="mt-4 block text-xs font-bold text-gray-300">
                  Additional details (optional)
                </label>

                <textarea
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Tell us more..."
                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#09090e] p-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500"
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold hover:bg-red-500 disabled:opacity-50"
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportingCommentId(null)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

    const formattedDate = article?.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Latest";

  const topLevelComments = comments.filter(
    (comment) => comment.parent_id === null
  );

  return (
    <main className="min-h-screen bg-[#07070b] text-white">
      <header className="border-b border-white/10 bg-[#07070b]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a href="/" className="text-3xl font-black tracking-[-0.08em]">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <a
            href="/#news"
            className="text-sm font-semibold text-gray-400 transition hover:text-purple-400"
          >
            ← Back to News
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#10131a] p-10 text-center">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500" />
            <p className="text-sm text-gray-400">Loading article...</p>
          </div>
        ) : notFound || !article ? (
          <div className="rounded-2xl border border-white/10 bg-[#10131a] px-6 py-16 text-center">
            <p className="text-sm font-bold tracking-widest text-purple-400">
              ARTICLE NOT FOUND
            </p>

            <h1 className="mt-4 text-3xl font-black">
              We couldn't find this story.
            </h1>

            <p className="mt-4 text-sm text-gray-400">
              This article may have been removed or is no longer available in
              our latest news feed.
            </p>

            <a
              href="/#news"
              className="mt-8 inline-block rounded-lg bg-purple-600 px-7 py-3 text-sm font-bold transition hover:bg-purple-500"
            >
              Return to Latest News
            </a>
          </div>
        ) : (
          <article>
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <span className="rounded-md border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-[10px] font-black tracking-widest text-purple-300">
                {article.source || "GAMING NEWS"}
              </span>

              {article.featured && (
                <span className="rounded-md bg-purple-600 px-3 py-2 text-[10px] font-black tracking-widest">
                  ★ FEATURED
                </span>
              )}

              <span className="text-xs text-gray-500">{formattedDate}</span>
            </div>

            <h1 className="text-3xl font-black leading-tight tracking-tight md:text-5xl md:leading-[1.15]">
              {article.title}
            </h1>

            <div className="mt-7">
              <button
                type="button"
                onClick={toggleBookmark}
                disabled={bookmarkLoading || !authChecked}
                className={`inline-flex items-center gap-3 rounded-lg border px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isBookmarked
                    ? "border-purple-400 bg-purple-600/20 text-purple-300"
                    : "border-white/15 bg-white/5 text-gray-300 hover:border-purple-400 hover:text-white"
                }`}
              >
                <span className="text-lg">{isBookmarked ? "★" : "☆"}</span>

                {bookmarkLoading
                  ? "Updating..."
                  : isBookmarked
                    ? "Saved to Bookmarks"
                    : "Save Article"}
              </button>

              {!userId && authChecked && (
                <p className="mt-2 text-xs text-gray-500">
                  Log in to save this article to your bookmarks.
                </p>
              )}

              {bookmarkMessage && (
                <p role="status" className="mt-3 text-sm text-purple-300">
                  {bookmarkMessage}
                </p>
              )}
            </div>

            {article.image && (
              <div className="mt-9 overflow-hidden rounded-2xl border border-white/10 bg-[#11141b]">
                <img
                  src={article.image}
                  alt={article.title}
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  className="max-h-[520px] w-full object-contain"
                />
              </div>
            )}

            <div className="mt-10 border-y border-white/10 py-8">
              <p className="text-xs font-bold tracking-[0.25em] text-purple-400">
                STORY SUMMARY
              </p>

              <p className="mt-5 text-lg leading-9 text-gray-300">
                {article.description ||
                  "Read the original report for the full story and latest details."}
              </p>
            </div>

            <div className="mt-10 rounded-2xl border border-purple-400/20 bg-[#11101a] p-7 md:p-9">
              <p className="text-xs font-bold tracking-widest text-purple-400">
                ORIGINAL REPORT
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Continue reading with {article.source || "the publisher"}
              </h2>

              <p className="mt-3 text-sm leading-7 text-gray-400">
                This story is provided by {article.source || "the original publisher"}.
                Visit the original source for the complete article and additional
                reporting.
              </p>

              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-flex items-center gap-3 rounded-lg bg-purple-600 px-7 py-4 text-sm font-bold transition hover:-translate-y-1 hover:bg-purple-500"
              >
                Read Original Article
                <span>↗</span>
              </a>
            </div>

            <section
              id="comments"
              className="mt-16 border-t border-white/10 pt-12"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[0.25em] text-purple-400">
                    NELVA COMMUNITY
                  </p>

                  <h2 className="mt-3 text-3xl font-black">Discussion</h2>

                  <p className="mt-2 text-sm text-gray-500">
                    Share your thoughts about this story.
                  </p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-gray-300">
                  {comments.length}{" "}
                  {comments.length === 1 ? "COMMENT" : "COMMENTS"}
                </span>
              </div>

              <div className="mt-8 rounded-2xl border border-purple-500/20 bg-[#11101a] p-5 md:p-7">
                {userId ? (
                  <form onSubmit={submitComment}>
                    <label
                      htmlFor="new-comment"
                      className="text-sm font-bold text-white"
                    >
                      Write a comment
                    </label>

                    <textarea
                      id="new-comment"
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="What do you think about this story?"
                      maxLength={2000}
                      rows={4}
                      required
                      className="mt-4 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-white outline-none placeholder:text-gray-600 focus:border-purple-500"
                    />

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-gray-600">
                        {commentDraft.length}/2000 characters
                      </span>

                      <button
                        type="submit"
                        disabled={commentSubmitting || !commentDraft.trim()}
                        className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-bold transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {commentSubmitting ? "Posting..." : "Post Comment"}
                      </button>
                    </div>
                  </form>
                ) : authChecked ? (
                  <div className="text-center">
                    <p className="text-sm text-gray-400">
                      Log in to join the discussion.
                    </p>

                    <a
                      href="/auth"
                      className="mt-4 inline-block rounded-lg bg-purple-600 px-6 py-3 text-sm font-bold hover:bg-purple-500"
                    >
                      Log In to Comment
                    </a>
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-500">
                    Checking your account...
                  </p>
                )}
              </div>

              {commentMessage && (
                <p role="status" className="mt-4 text-sm text-purple-300">
                  {commentMessage}
                </p>
              )}

              {reportMessage && (
                <p role="status" className="mt-4 text-sm text-red-300">
                  {reportMessage}
                </p>
              )}

              <div className="mt-8 space-y-5">
                {commentsLoading ? (
                  <p className="py-8 text-center text-sm text-gray-500">
                    Loading discussion...
                  </p>
                ) : topLevelComments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
                    <p className="text-3xl">💬</p>

                    <h3 className="mt-4 text-lg font-bold">No comments yet</h3>

                    <p className="mt-2 text-sm text-gray-500">
                      Be the first to start the conversation.
                    </p>
                  </div>
                ) : (
                  topLevelComments.map((comment) => (
                    <div key={comment.id}>
                      {renderComment(comment)}

                      {comments
                        .filter((reply) => reply.parent_id === comment.id)
                        .map((reply) => renderComment(reply, true))}
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="mt-12 text-center">
              <a
                href="/#news"
                className="text-sm font-bold text-gray-400 transition hover:text-purple-400"
              >
                ← Explore more gaming news
              </a>
            </div>
          </article>
        )}
      </div>

      <footer className="border-t border-white/10 py-8 text-center">
        <a href="/" className="text-xl font-black tracking-[-0.07em]">
          NELVA<span className="text-purple-500">.</span>
        </a>

        <p className="mt-2 text-xs text-gray-600">Your world. Your games.</p>
      </footer>
    </main>
  );
}