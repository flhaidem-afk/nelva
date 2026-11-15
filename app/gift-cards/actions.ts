
"use server";

import { createClient } from "@/lib/supabase/server";
import { encryptGiftCardCode } from "@/lib/gift-card-crypto";

type GiftCardSubmission = {
  cardRegion: string;
  cardCurrency: string;
  faceValue: number;
  cardType: "digital" | "physical";
  redemptionCode: string;
};

export async function submitGiftCard(input: GiftCardSubmission) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "Please sign in before submitting a gift card.",
      };
    }

    if (!input || typeof input !== "object") {
      return {
        success: false,
        message: "Invalid submission details.",
      };
    }

    const cardRegion = input.cardRegion?.trim();
    const cardCurrency = input.cardCurrency?.trim().toUpperCase();
    const faceValue = Number(input.faceValue);
    const cardType = input.cardType;

    if (
      !cardRegion ||
      cardRegion.length > 80 ||
      !/^[A-Z]{3}$/.test(cardCurrency) ||
      !Number.isFinite(faceValue) ||
      faceValue <= 0 ||
      faceValue > 10000 ||
      !["digital", "physical"].includes(cardType) ||
      typeof input.redemptionCode !== "string"
    ) {
      return {
        success: false,
        message: "Please check your gift card details and try again.",
      };
    }

    const encrypted = encryptGiftCardCode(input.redemptionCode);

    const { data, error } = await supabase.rpc(
      "submit_apple_gift_card",
      {
        p_card_region: cardRegion,
        p_card_currency: cardCurrency,
        p_face_value: faceValue,
        p_card_type: cardType,
        p_encrypted_code: encrypted.encrypted_code,
        p_encryption_iv: encrypted.encryption_iv,
        p_encryption_auth_tag: encrypted.encryption_auth_tag,
      }
    );

    if (error) {
      console.error("NELVA gift card database error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return {
        success: false,
        message:
          process.env.NODE_ENV === "development"
            ? `Database error (${error.code}): ${error.message}`
            : "Your submission could not be completed. Please try again.",
      };
    }

    if (!data) {
      console.error("NELVA gift card submission returned no ID.");

      return {
        success: false,
        message: "The submission could not be confirmed. Please try again.",
      };
    }

    return {
      success: true,
      message: "Your gift card submission was received for review.",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown server error";

    console.error("NELVA gift card server error:", errorMessage);

    return {
      success: false,
      message:
        process.env.NODE_ENV === "development"
          ? `Server error: ${errorMessage}`
          : "Something went wrong. Please try again.",
    };
  }
}
