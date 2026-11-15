
import { Suspense } from "react";
import ArticleClient from "./ArticleClient";

export const instant = false;

export default function ArticlePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#07070b] text-white flex items-center justify-center">
          <p className="text-gray-400">Loading article...</p>
        </main>
      }
    >
      <ArticleClient />
    </Suspense>
  );
}
