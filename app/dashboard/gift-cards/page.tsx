
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type GiftCardSubmission = {
  id: string;
  brand: string;
  card_region: string;
  card_currency: string;
  face_value: number | string;
  status: string;
  quoted_payout_amount: number | string | null;
  quoted_payout_currency: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
};

function getStatus(status: string) {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        description: "Your submission has been received and is waiting for review.",
        style: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
      };

    case "under_review":
      return {
        label: "Under Review",
        description: "NELVA is reviewing your gift card submission.",
        style: "border-blue-500/20 bg-blue-500/10 text-blue-400",
      };

    case "approved":
      return {
        label: "Approved",
        description: "Your submission has been approved. Check the payout offer below.",
        style: "border-green-500/20 bg-green-500/10 text-green-400",
      };

    case "paid":
      return {
        label: "Paid",
        description: "Your payment has been marked as completed.",
        style: "border-purple-500/20 bg-purple-500/10 text-purple-300",
      };

    case "rejected":
      return {
        label: "Rejected",
        description: "Your submission was not accepted. Contact NELVA if you need clarification.",
        style: "border-red-500/20 bg-red-500/10 text-red-400",
      };

    case "cancelled":
      return {
        label: "Cancelled",
        description: "This submission has been cancelled.",
        style: "border-white/20 bg-white/5 text-gray-300",
      };

    default:
      return {
        label: status.replaceAll("_", " "),
        description: "Your submission status has been updated.",
        style: "border-white/10 bg-white/5 text-gray-300",
      };
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatAmount(value: number | string, currency: string) {
  return `${currency} ${Number(value).toLocaleString()}`;
}

export default async function CustomerGiftCardsPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth");
  }

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .select(
      "id, brand, card_region, card_currency, face_value, status, quoted_payout_amount, quoted_payout_currency, created_at, updated_at, reviewed_at, paid_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const submissions = (data ?? []) as GiftCardSubmission[];

  return (
    <main className="min-h-screen bg-[#08070d] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <a href="/" className="text-2xl font-black tracking-widest">
            NELVA<span className="text-purple-500">.</span>
          </a>

          <div className="flex flex-wrap items-center gap-5">
            <a
              href="/dashboard"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Dashboard
            </a>

            <a
              href="/gift-cards"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              Submit Gift Card
            </a>
          </div>
        </header>

        <section className="mt-14">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-400">
            NELVA Exchange
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            My Gift Cards<span className="text-purple-500">.</span>
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-gray-400">
            Track your Apple Gift Card submissions and see their
            latest review and payment status.
          </p>
        </section>

        {error ? (
          <section className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <h2 className="font-bold text-red-400">
              Could not load your submissions
            </h2>

            <p className="mt-2 break-words text-sm text-gray-400">
              {error.message}
            </p>

            <p className="mt-3 text-xs text-gray-500">
              Please refresh the page. If this continues, contact NELVA support.
            </p>
          </section>
        ) : submissions.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.035] px-6 py-16 text-center">
            <div className="text-5xl text-purple-400">◇</div>

            <h2 className="mt-5 text-2xl font-black">
              No submissions yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-400">
              When you submit an Apple Gift Card through NELVA,
              its details and status will appear here.
            </p>

            <a
              href="/gift-cards"
              className="mt-7 inline-block rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold transition hover:bg-purple-500"
            >
              Submit a Gift Card
            </a>
          </section>
        ) : (
          <section className="mt-10 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Your Submissions
              </h2>

              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-300">
                {submissions.length} Total
              </span>
            </div>

            {submissions.map((submission) => {
              const status = getStatus(submission.status);

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

                      <h3 className="mt-2 text-2xl font-black">
                        {formatAmount(
                          submission.face_value,
                          submission.card_currency
                        )}
                      </h3>

                      <p className="mt-2 text-sm text-gray-400">
                        Region: {submission.card_region}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-4 py-2 text-xs font-bold uppercase ${status.style}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-5">
                    <p className="font-bold text-white">
                      {status.label}
                    </p>

                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      {status.description}
                    </p>
                  </div>

                  {submission.quoted_payout_amount !== null && (
                    <div className="mt-5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        NELVA Payout Quote
                      </p>

                      <p className="mt-2 text-2xl font-black text-purple-300">
                        {formatAmount(
                          submission.quoted_payout_amount,
                          submission.quoted_payout_currency || "Unspecified"
                        )}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        A quote is not proof of payment. Wait for the status to show Paid.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-500">
                        Submitted
                      </p>

                      <p className="mt-2 text-sm text-gray-300">
                        {formatDate(submission.created_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Last Updated
                      </p>

                      <p className="mt-2 text-sm text-gray-300">
                        {formatDate(submission.updated_at)}
                      </p>
                    </div>

                    {submission.reviewed_at && (
                      <div>
                        <p className="text-xs text-gray-500">
                          Reviewed
                        </p>

                        <p className="mt-2 text-sm text-gray-300">
                          {formatDate(submission.reviewed_at)}
                        </p>
                      </div>
                    )}

                    {submission.paid_at && (
                      <div>
                        <p className="text-xs text-gray-500">
                          Payment Recorded
                        </p>

                        <p className="mt-2 text-sm text-gray-300">
                          {formatDate(submission.paid_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-6">
          <h2 className="font-bold text-yellow-400">
            Important payment information
          </h2>

          <p className="mt-2 text-sm leading-7 text-gray-400">
            Gift cards are reviewed manually. A payout quote does
            not mean payment has been sent. Only treat a submission
            marked Paid as recorded as completed in NELVA. Contact
            NELVA through its official support channel if you have
            questions.
          </p>
        </section>
      </div>
    </main>
  );
}
