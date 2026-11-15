
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Submission = {
  id: string;
  status: string;
  verified_usd_value: number | string | null;
  quoted_payout_amount: number | string | null;
  quoted_payout_currency: string | null;
};

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    redirect("/dashboard");
  }

  return { supabase, user };
}

async function getSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<Submission> {
  const validId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    );

  if (!validId) {
    redirect("/admin/gift-cards?result=invalid");
  }

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .select(
      "id, status, verified_usd_value, quoted_payout_amount, quoted_payout_currency"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    redirect("/admin/gift-cards?result=not-found");
  }

  return data as Submission;
}

function finish(result: string): never {
  revalidatePath("/admin/gift-cards");
  revalidatePath("/dashboard/gift-cards");

  redirect(`/admin/gift-cards?result=${result}`);
}

export async function markUnderReview(formData: FormData) {
  const { supabase, user } = await getAdminContext();
  const id = String(formData.get("submission_id") || "");

  const submission = await getSubmission(supabase, id);

  if (submission.status !== "pending") {
    finish("invalid-transition");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .update({
      status: "under_review",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    finish("update-failed");
  }

  finish("review-started");
}

export async function verifyGiftCard(formData: FormData) {
  const { supabase } = await getAdminContext();
  const id = String(formData.get("submission_id") || "");
  const valueInput = String(
    formData.get("verified_usd_value") || ""
  ).trim();

  const confirmed =
    formData.get("verification_confirmed") === "yes";

  const submission = await getSubmission(supabase, id);
  const verifiedValue = Number(valueInput);

  if (!["pending", "under_review"].includes(submission.status)) {
    finish("invalid-transition");
  }

  if (verifiedValue !== 100) {
    finish("verification-must-be-100");
  }

  if (!confirmed) {
    finish("verification-not-confirmed");
  }

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .update({
      verified_usd_value: 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "under_review"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    finish("update-failed");
  }

  finish("verified");
}

export async function approveGiftCard(formData: FormData) {
  const { supabase, user } = await getAdminContext();
  const id = String(formData.get("submission_id") || "");

  const submission = await getSubmission(supabase, id);

  if (submission.status !== "under_review") {
    finish("invalid-transition");
  }

  if (Number(submission.verified_usd_value) !== 100) {
    finish("verification-required");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "under_review")
    .eq("verified_usd_value", 100)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    finish("update-failed");
  }

  finish("approved");
}

export async function rejectGiftCard(formData: FormData) {
  const { supabase, user } = await getAdminContext();
  const id = String(formData.get("submission_id") || "");

  const submission = await getSubmission(supabase, id);

  if (!["pending", "under_review"].includes(submission.status)) {
    finish("invalid-transition");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", ["pending", "under_review"])
    .select("id")
    .maybeSingle();

  if (error || !data) {
    finish("update-failed");
  }

  finish("rejected");
}

export async function savePayoutQuote(formData: FormData) {
  const { supabase } = await getAdminContext();

  const id = String(formData.get("submission_id") || "");
  const amountInput = String(
    formData.get("quoted_payout_amount") || ""
  ).trim();

  const currency = String(
    formData.get("quoted_payout_currency") || ""
  )
    .trim()
    .toUpperCase();

  const submission = await getSubmission(supabase, id);
  const amount = Number(amountInput);

  if (!["under_review", "approved"].includes(submission.status)) {
    finish("invalid-transition");
  }

  if (Number(submission.verified_usd_value) !== 100) {
    finish("verification-required");
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000000000
  ) {
    finish("invalid-quote");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    finish("invalid-currency");
  }

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .update({
      quoted_payout_amount: amount,
      quoted_payout_currency: currency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["under_review", "approved"])
    .eq("verified_usd_value", 100)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    finish("update-failed");
  }

  finish("quote-saved");
}

export async function markGiftCardPaid(formData: FormData) {
  const { supabase } = await getAdminContext();

  const id = String(formData.get("submission_id") || "");
  const paymentConfirmed =
    formData.get("payment_confirmed") === "yes";

  const submission = await getSubmission(supabase, id);

  if (submission.status !== "approved") {
    finish("invalid-transition");
  }

  if (Number(submission.verified_usd_value) !== 100) {
    finish("verification-required");
  }

  if (
    !submission.quoted_payout_amount ||
    !submission.quoted_payout_currency
  ) {
    finish("quote-required");
  }

  if (!paymentConfirmed) {
    finish("payment-not-confirmed");
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("gift_card_submissions")
    .update({
      status: "paid",
      paid_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .eq("status", "approved")
    .eq("verified_usd_value", 100)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    finish("update-failed");
  }

  finish("paid");
}

export async function saveAdminNotes(formData: FormData) {
  const { supabase, user } = await getAdminContext();

  const id = String(formData.get("submission_id") || "");
  const notes = String(formData.get("admin_notes") || "");

  await getSubmission(supabase, id);

  if (notes.length > 10000) {
    finish("invalid-notes");
  }

  const { error } = await supabase
    .from("gift_card_submission_admin_notes")
    .upsert(
      {
        submission_id: id,
        admin_notes: notes.trim(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "submission_id",
      }
    );

  if (error) {
    finish("notes-failed");
  }

  finish("notes-saved");
}
