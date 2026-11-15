
"use client";

import { useState } from "react";
import { revealGiftCardCode } from "./reveal-action";

export default function RevealGiftCardCode({
  submissionId,
}: {
  submissionId: string;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReveal() {
    setLoading(true);
    setMessage("");

    try {
      const result = await revealGiftCardCode(submissionId);

      if (!result.success) {
        setCode("");
        setMessage(result.message);
        return;
      }

      setCode(result.code);
    } catch {
      setCode("");
      setMessage("Unable to retrieve this card code.");
    } finally {
      setLoading(false);
    }
  }

  function handleHide() {
    setCode("");
    setMessage("");
  }

  return (
    <div className="mt-4 rounded-xl border border-purple-500/20 bg-black/30 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-300">
        Secure redemption code
      </p>

      {code ? (
        <div className="space-y-3">
          <div className="break-all rounded-lg border border-purple-500/30 bg-black p-3 font-mono text-sm text-white">
            {code}
          </div>

          <button
            type="button"
            onClick={handleHide}
            className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/10"
          >
            Hide code
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleReveal}
          disabled={loading}
          className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Retrieving..." : "Reveal code"}
        </button>
      )}

      {message && (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {message}
        </p>
      )}

      <p className="mt-3 text-[11px] text-gray-500">
        Keep redemption codes confidential. Only use them for authorized
        gift-card verification and processing.
      </p>
    </div>
  );
}
