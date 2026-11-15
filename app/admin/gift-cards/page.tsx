
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

import {
  markUnderReview,
  verifyGiftCard,
  approveGiftCard,
  rejectGiftCard,
  savePayoutQuote,
  markGiftCardPaid,
  saveAdminNotes,
} from "./actions";

import RevealGiftCardCode from "./reveal-code";

export const instant = false;

type GiftCardSubmission = {
  id: string;
  user_id: string;
  brand: string;
  card_region: string;
  card_currency: string;
  card_type: string;
  face_value: number | string;
  verified_usd_value: number | string | null;
  status: string;
  quoted_payout_amount: number | string | null;
  quoted_payout_currency: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
};

type AdminNote = {
  submission_id: string;
  admin_notes: string;
  updated_at: string;
};

const resultMessages: Record<string, string> = {
  invalid: "The submission ID is invalid.",
  "not-found": "The submission could not be found.",
  "invalid-transition":
    "That action is not allowed for the submission's current status.",
  "update-failed": "The update failed. Refresh the page and try again.",
  "review-started": "Submission moved to Under Review.",
  "verification-must-be-100":
    "The verified USD value must be exactly 100.",
  "verification-not-confirmed":
    "Confirm that you independently verified the card.",
  verified: "The $100 USD verification was recorded.",
  "verification-required":
    "Verify the card at exactly $100 USD before continuing.",
  approved: "Submission approved.",
  rejected: "Submission rejected.",
  "invalid-quote": "Enter a valid payout amount greater than zero.",
  "invalid-currency":
    "Enter a valid three-letter payout currency code.",
  "quote-saved": "Payout quote saved.",
  "quote-required":
    "Save a payout quote before marking this submission as paid.",
  "payment-not-confirmed":
    "Confirm that payment has actually been completed.",
  paid: "Payment marked as completed.",
  "invalid-notes": "Admin notes cannot exceed 10,000 characters.",
  "notes-failed": "Could not save the admin notes.",
  "notes-saved": "Admin notes saved.",
};

function statusStyle(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "under_review":
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "approved":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    case "paid":
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case "rejected":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    default:
      return "bg-white/5 text-gray-400 border-white/10";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatAmount(value: number | string, currency: string) {
  return `${currency} ${Number(value).toLocaleString()}`;
}

const inputStyle =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#08070d] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500";

const buttonStyle =
  "rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed";

export default async function GiftCardAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await connection();

  const { result } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth");
  }

  const { data: adminAccess, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !adminAccess) {
    redirect("/dashboard");
  }

  const [
    { data: submissionData, error: submissionError },
    { data: noteData, error: noteError },
  ] = await Promise.all([
    supabase
      .from("gift_card_submissions")
      .select(
        "id, user_id, brand, card_region, card_currency, card_type, face_value, verified_usd_value, status, quoted_payout_amount, quoted_payout_currency, created_at, updated_at, reviewed_at, paid_at"
      )
      .order("created_at", { ascending: false }),

    supabase
      .from("gift_card_submission_admin_notes")
      .select("submission_id, admin_notes, updated_at"),
  ]);

  const submissions = (submissionData ?? []) as GiftCardSubmission[];
  const notes = (noteData ?? []) as AdminNote[];

  const notesBySubmission = new Map(
    notes.map((note) => [note.submission_id, note])
  );

  const pendingCount = submissions.filter(
    (item) => item.status === "pending"
  ).length;

  const reviewCount = submissions.filter(
    (item) => item.status === "under_review"
  ).length;

  const approvedCount = submissions.filter(
    (item) => item.status === "approved"
  ).length;

  const paidCount = submissions.filter(
    (item) => item.status === "paid"
  ).length;

  return (
    <main className="min-h-screen bg-[#08070d] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <a href="/" className="text-2xl font-black tracking-widest">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <div className="flex items-center gap-5">
            <a
              href="/admin"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Admin Dashboard
            </a>

            <a
              href="/dashboard"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Dashboard
            </a>
          </div>
        </header>

        <section className="mt-14">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-400">
            NELVA Exchange
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Gift Card Review
            <span className="text-purple-500">.</span>
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-gray-400">
            Review Apple Gift Card submissions, independently verify
            their value, manage payout quotes, and record completed payments.
          </p>
        </section>

        {result && (
          <div
            className={`mt-8 rounded-xl border p-4 text-sm ${
              result === "update-failed" ||
              result === "notes-failed" ||
              result === "invalid-transition" ||
              result === "verification-required" ||
              result === "verification-not-confirmed" ||
              result === "payment-not-confirmed" ||
              result === "verification-must-be-100"
                ? "border-red-500/20 bg-red-500/5 text-red-300"
                : "border-purple-500/20 bg-purple-500/5 text-purple-300"
            }`}
          >
            {resultMessages[result] || "The requested action has finished."}
          </div>
        )}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Submissions",
              value: submissions.length,
              color: "text-white",
            },
            {
              label: "Pending Review",
              value: pendingCount,
              color: "text-yellow-400",
            },
            {
              label: "Under Review",
              value: reviewCount,
              color: "text-blue-400",
            },
            {
              label: "Paid",
              value: paidCount,
              color: "text-purple-400",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-6"
            >
              <p className="text-sm text-gray-400">{stat.label}</p>
              <p className={`mt-3 text-4xl font-black ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Submitted Gift Cards</h2>
              <p className="mt-2 text-sm text-gray-400">
                All customer submissions appear here.
              </p>
            </div>

            <span className="text-sm text-gray-500">
              {approvedCount} approved
            </span>
          </div>

          {submissionError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <p className="font-bold text-red-400">
                Could not load gift card submissions.
              </p>
              <p className="mt-2 break-words text-sm text-gray-400">
                {submissionError.message}
              </p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
                🎁
              </div>

              <h3 className="mt-6 text-xl font-bold">
                No submissions yet
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-500">
                When customers submit Apple Gift Cards through NELVA,
                their submissions will appear here for manual review.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {submissions.map((submission) => {
                const note = notesBySubmission.get(submission.id);
                const isVerified =
                  Number(submission.verified_usd_value) === 100;

                const canReview = submission.status === "pending";

                const canVerify = [
                  "pending",
                  "under_review",
                ].includes(submission.status);

                const canApprove =
                  submission.status === "under_review" && isVerified;

                const canReject = [
                  "pending",
                  "under_review",
                ].includes(submission.status);

                const canQuote =
                  ["under_review", "approved"].includes(submission.status) &&
                  isVerified;

                const canMarkPaid =
                  submission.status === "approved" &&
                  isVerified &&
                  submission.quoted_payout_amount !== null &&
                  !!submission.quoted_payout_currency;

                return (
                  <article
                    key={submission.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                          {submission.brand} Gift Card
                        </p>

                        <h3 className="mt-2 text-xl font-black">
                          {formatAmount(
                            submission.face_value,
                            submission.card_currency
                          )}
                        </h3>

                        <p className="mt-2 text-sm text-gray-400">
                          Region: {submission.card_region}
                        </p>

                        <p className="mt-2 text-sm text-gray-400">
                          Card type:{" "}
                          <span className="font-semibold capitalize text-white">
                            {submission.card_type || "Not specified"}
                          </span>
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${statusStyle(
                          submission.status
                        )}`}
                      >
                        {submission.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl bg-black/30 p-4">
                        <p className="text-xs text-gray-500">Customer ID</p>
                        <p className="mt-2 break-all text-xs font-medium text-gray-300">
                          {submission.user_id}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/30 p-4">
                        <p className="text-xs text-gray-500">
                          Verified USD Value
                        </p>
                        <p className="mt-2 text-lg font-black">
                          {isVerified ? "$100.00" : "Not verified"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-black/30 p-4">
                        <p className="text-xs text-gray-500">Submitted</p>
                        <p className="mt-2 text-sm font-semibold text-gray-300">
                          {formatDate(submission.created_at)}
                        </p>
                      </div>
                    </div>

                    <RevealGiftCardCode submissionId={submission.id} />

                    {submission.quoted_payout_amount !== null && (
                      <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                        <p className="text-xs text-gray-400">
                          Recorded Payout Quote
                        </p>
                        <p className="mt-2 text-lg font-black text-purple-300">
                          {formatAmount(
                            submission.quoted_payout_amount,
                            submission.quoted_payout_currency || "Unspecified"
                          )}
                        </p>
                      </div>
                    )}

                    <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Internal Admin Notes
                      </p>

                      {noteError ? (
                        <p className="mt-3 text-sm text-yellow-400">
                          Admin notes could not be loaded.
                        </p>
                      ) : note?.admin_notes ? (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">
                          {note.admin_notes}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-gray-500">
                          No internal notes recorded.
                        </p>
                      )}

                      {note?.updated_at && (
                        <p className="mt-3 text-xs text-gray-500">
                          Last updated: {formatDate(note.updated_at)}
                        </p>
                      )}

                      <form action={saveAdminNotes} className="mt-5">
                        <input
                          type="hidden"
                          name="submission_id"
                          value={submission.id}
                        />

                        <label className="text-xs font-semibold text-gray-400">
                          Add or update internal notes
                        </label>

                        <textarea
                          name="admin_notes"
                          defaultValue={note?.admin_notes || ""}
                          maxLength={10000}
                          rows={4}
                          placeholder="Record verification findings, communication, or payment details..."
                          className={inputStyle}
                        />

                        <button
                          type="submit"
                          className={`${buttonStyle} mt-3 bg-white/10 text-white hover:bg-white/15`}
                        >
                          Save Admin Notes
                        </button>
                      </form>
                    </div>

                    <div className="mt-6 rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-5">
                      <h4 className="font-bold text-purple-300">
                        Admin Actions
                      </h4>

                      <p className="mt-2 text-xs leading-6 text-gray-400">
                        Only record verification after independently checking
                        the actual card. Never treat a submitted face value
                        as proof of its balance.
                      </p>

                      {canReview && (
                        <form action={markUnderReview} className="mt-5">
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />
                          <button
                            type="submit"
                            className={`${buttonStyle} bg-blue-500/15 text-blue-300 hover:bg-blue-500/25`}
                          >
                            Move to Under Review
                          </button>
                        </form>
                      )}

                      {canVerify && (
                        <form
                          action={verifyGiftCard}
                          className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />

                          <label className="block text-sm font-semibold text-gray-300">
                            Independently verified USD value
                          </label>

                          <input
                            type="number"
                            name="verified_usd_value"
                            min="100"
                            max="100"
                            step="1"
                            defaultValue="100"
                            required
                            className={inputStyle}
                          />

                          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-gray-300">
                            <input
                              type="checkbox"
                              name="verification_confirmed"
                              value="yes"
                              required
                              className="mt-1 h-4 w-4 accent-purple-500"
                            />
                            I independently checked this Apple Gift Card
                            and confirm its verified value is exactly
                            $100 USD.
                          </label>

                          <button
                            type="submit"
                            className={`${buttonStyle} mt-4 bg-purple-600 text-white hover:bg-purple-500`}
                          >
                            {isVerified
                              ? "Confirm Verification Again"
                              : "Verify $100 USD"}
                          </button>
                        </form>
                      )}

                      {canApprove && (
                        <form action={approveGiftCard} className="mt-5">
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />
                          <button
                            type="submit"
                            className={`${buttonStyle} bg-green-500/15 text-green-300 hover:bg-green-500/25`}
                          >
                            Approve Submission
                          </button>
                        </form>
                      )}

                      {canQuote && (
                        <form
                          action={savePayoutQuote}
                          className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />

                          <h5 className="text-sm font-bold text-gray-300">
                            Set Payout Quote
                          </h5>

                          <label className="mt-4 block text-xs text-gray-400">
                            Payout amount
                          </label>
                          <input
                            type="number"
                            name="quoted_payout_amount"
                            min="0.01"
                            max="1000000000"
                            step="0.01"
                            defaultValue={
                              submission.quoted_payout_amount ?? ""
                            }
                            placeholder="Enter payout amount"
                            required
                            className={inputStyle}
                          />

                          <label className="mt-4 block text-xs text-gray-400">
                            Payout currency (3-letter code)
                          </label>
                          <input
                            type="text"
                            name="quoted_payout_currency"
                            minLength={3}
                            maxLength={3}
                            pattern="[A-Za-z]{3}"
                            defaultValue={
                              submission.quoted_payout_currency || "NGN"
                            }
                            placeholder="NGN"
                            required
                            className={inputStyle}
                          />

                          <button
                            type="submit"
                            className={`${buttonStyle} mt-4 bg-purple-600 text-white hover:bg-purple-500`}
                          >
                            Save Payout Quote
                          </button>
                        </form>
                      )}

                      {canMarkPaid && (
                        <form
                          action={markGiftCardPaid}
                          className="mt-5 rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4"
                        >
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />

                          <label className="flex items-start gap-3 text-sm leading-6 text-gray-300">
                            <input
                              type="checkbox"
                              name="payment_confirmed"
                              value="yes"
                              required
                              className="mt-1 h-4 w-4 accent-green-500"
                            />
                            I confirm that the quoted payout has actually
                            been sent to the customer.
                          </label>

                          <button
                            type="submit"
                            className={`${buttonStyle} mt-4 bg-green-600 text-white hover:bg-green-500`}
                          >
                            Mark as Paid
                          </button>
                        </form>
                      )}

                      {canReject && (
                        <form action={rejectGiftCard} className="mt-5">
                          <input
                            type="hidden"
                            name="submission_id"
                            value={submission.id}
                          />
                          <button
                            type="submit"
                            className={`${buttonStyle} border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
                          >
                            Reject Submission
                          </button>
                        </form>
                      )}

                      {!canReview &&
                        !canVerify &&
                        !canApprove &&
                        !canReject &&
                        !canQuote &&
                        !canMarkPaid && (
                          <p className="mt-4 text-sm text-gray-500">
                            No further actions are available for this status.
                          </p>
                        )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-5 text-xs text-gray-500">
                      <span>Submission ID: {submission.id}</span>

                      {submission.reviewed_at && (
                        <span>
                          Reviewed: {formatDate(submission.reviewed_at)}
                        </span>
                      )}

                      {submission.paid_at && (
                        <span>Paid: {formatDate(submission.paid_at)}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-6">
          <h3 className="font-bold text-yellow-400">
            Manual verification and payment responsibility
          </h3>

          <p className="mt-2 text-sm leading-7 text-gray-400">
            NELVA does not automatically redeem cards or send payments.
            Admin verification is a recorded decision, not an automated
            balance check. Only approve a card after independently confirming
            its validity and exact $100 USD value. Only mark it paid after
            the payout has actually been sent.
          </p>
        </section>
      </div>
    </main>
  );
}
