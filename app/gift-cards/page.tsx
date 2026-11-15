
"use client";

import { useState } from "react";
import Link from "next/link";
import { submitGiftCard } from "./actions";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#100e17] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-purple-500";

export default function GiftCardsPage() {
  const [region, setRegion] = useState("");
  const [currency, setCurrency] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [cardType, setCardType] = useState<"digital" | "physical">("digital");
  const [redemptionCode, setRedemptionCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!region.trim() || !currency.trim() || !redemptionCode.trim()) {
      setMessageType("error");
      setMessage("Please complete all required fields.");
      return;
    }

    const amount = Number(faceValue);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessageType("error");
      setMessage("Enter a valid card face value greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const result = await submitGiftCard({
        cardRegion: region.trim(),
        cardCurrency: currency.trim().toUpperCase(),
        faceValue: amount,
        cardType,
        redemptionCode,
      });

      setMessageType(result.success ? "success" : "error");
      setMessage(result.message);

      if (result.success) {
        setRegion("");
        setCurrency("");
        setFaceValue("");
        setCardType("digital");
        setRedemptionCode("");
      }
    } catch {
      setMessageType("error");
      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08070d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link href="/" className="text-2xl font-black tracking-widest">
            NELVA<span className="text-purple-500">.</span>
          </Link>

          <Link
            href="/dashboard"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            Dashboard
          </Link>
        </header>

        <section className="grid gap-12 py-14 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-purple-400">
              NELVA Exchange
            </p>

            <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">
              Exchange your
              <span className="block text-purple-500">
                Apple Gift Card.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-gray-400">
              Submit your Apple Gift Card for review by the NELVA team.
              Every submission is reviewed manually before any purchase
              or payment decision.
            </p>

            <div className="mt-9 space-y-4">
              {[
                "No submission fee",
                "Digital and physical cards accepted for review",
                "Manual review by the NELVA team",
                "Encrypted redemption-code storage",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-xs text-purple-400">
                    ✓
                  </span>
                  <span className="text-sm text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-purple-950/20 sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                Submission form
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Apple Gift Card
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Enter your card information. Your redemption code is
                encrypted on our server before it is stored.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-300">
                  Gift Card Brand
                </label>
                <div className="mt-2 rounded-xl border border-purple-500/30 bg-purple-500/5 px-4 py-3.5 text-sm font-bold">
                  Apple Gift Card
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-300">
                  Card Type
                </label>

                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["digital", "physical"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCardType(type)}
                      className={`rounded-xl border px-3 py-3.5 text-sm font-bold capitalize transition ${
                        cardType === type
                          ? "border-purple-500 bg-purple-500/15 text-white"
                          : "border-white/10 bg-[#100e17] text-gray-400 hover:border-purple-500/50"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="region" className="text-sm font-semibold text-gray-300">
                  Card Region
                </label>
                <input
                  id="region"
                  className={inputClass}
                  placeholder="e.g. United States"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>

              <div>
                <label htmlFor="currency" className="text-sm font-semibold text-gray-300">
                  Card Currency
                </label>
                <input
                  id="currency"
                  className={inputClass}
                  placeholder="e.g. USD, GBP, CAD"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  maxLength={10}
                  required
                />
              </div>

              <div>
                <label htmlFor="faceValue" className="text-sm font-semibold text-gray-300">
                  Card Face Value
                </label>
                <input
                  id="faceValue"
                  type="number"
                  min="0.01"
                  max="10000"
                  step="0.01"
                  className={inputClass}
                  placeholder="e.g. 100"
                  value={faceValue}
                  onChange={(e) => setFaceValue(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="redemptionCode" className="text-sm font-semibold text-gray-300">
                  Redemption Code
                </label>
                <input
                  id="redemptionCode"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  className={inputClass}
                  placeholder="Enter your Apple Gift Card code"
                  value={redemptionCode}
                  onChange={(e) => setRedemptionCode(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                />
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Your code is encrypted before storage. Never enter your
                  Apple ID password or payment details.
                </p>
              </div>

              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <p className="text-xs leading-6 text-yellow-200/80">
                  Only submit a gift card you legally own and are authorized
                  to transfer. Submission does not guarantee acceptance or
                  payment. Do not submit a code that has already been redeemed.
                </p>
              </div>

              {message && (
                <div
                  role="alert"
                  className={`rounded-xl border p-4 text-sm leading-6 ${
                    messageType === "success"
                      ? "border-green-500/20 bg-green-500/5 text-green-300"
                      : "border-red-500/20 bg-red-500/5 text-red-300"
                  }`}
                >
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-purple-600 px-5 py-4 text-sm font-black tracking-wide transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "SUBMITTING..." : "SUBMIT GIFT CARD"}
              </button>

              <p className="text-center text-xs leading-6 text-gray-500">
                No automatic approval or payment. Your submission will be
                reviewed manually by the NELVA team.
              </p>
            </form>
          </div>
        </section>

        <footer className="border-t border-white/10 py-6 text-center text-xs text-gray-600">
          © 2026 NELVA. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
