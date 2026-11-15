
"use server";

import { createClient } from "@/lib/supabase/server";
import { decryptGiftCardCode } from "@/lib/gift-card-crypto";

type RevealResult =
  | { success: true; code: string }
  | { success: false; message: string };

export async function revealGiftCardCode(
  submissionId: string
): Promise<RevealResult> {
  try {
    const validId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        submissionId
      );

    if (!validId) {
      return {
        success: false,
        message: "Invalid submission.",
      };
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Please sign in again.",
      };
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return {
        success: false,
        message: "Administrator access required.",
      };
    }

    const { data: submission, error: submissionError } = await supabase
      .from("gift_card_submissions")
      .select("id, status")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError || !submission) {
      return {
        success: false,
        message: "Submission not found.",
      };
    }

    if (submission.status === "rejected") {
      return {
        success: false,
        message: "Rejected submissions cannot be revealed.",
      };
    }

    const { data: secret, error: secretError } = await supabase
      .from("gift_card_submission_secrets")
      .select(
        "encrypted_code, encryption_iv, encryption_auth_tag"
      )
      .eq("submission_id", submissionId)
      .maybeSingle();

    if (secretError || !secret) {
      return {
        success: false,
        message: "Encrypted card code could not be retrieved.",
      };
    }

    const code = decryptGiftCardCode(
      secret.encrypted_code,
      secret.encryption_iv,
      secret.encryption_auth_tag
    );

    return {
      success: true,
      code,
    };
  } catch {
    return {
      success: false,
      message: "Unable to reveal this card code.",
    };
  }
}
