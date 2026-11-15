
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

function getEncryptionKey(): Buffer {
  const value = process.env.GIFT_CARD_ENCRYPTION_KEY;

  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("Gift card encryption is not configured.");
  }

  return Buffer.from(value, "hex");
}

export function encryptGiftCardCode(code: string) {
  const normalizedCode = code.trim();

  if (normalizedCode.length < 8 || normalizedCode.length > 128) {
    throw new Error("Please enter a valid gift card code.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(normalizedCode, "utf8"),
    cipher.final(),
  ]);

  return {
    encrypted_code: encrypted.toString("base64"),
    encryption_iv: iv.toString("base64"),
    encryption_auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptGiftCardCode(
  encryptedCode: string,
  encryptionIv: string,
  encryptionAuthTag: string
): string {
  const key = getEncryptionKey();

  const encrypted = Buffer.from(encryptedCode, "base64");
  const iv = Buffer.from(encryptionIv, "base64");
  const authTag = Buffer.from(encryptionAuthTag, "base64");

  if (
    encrypted.length === 0 ||
    iv.length !== 12 ||
    authTag.length !== 16
  ) {
    throw new Error("Invalid encrypted gift card data.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  const code = decrypted.toString("utf8");

  if (code.length < 8 || code.length > 128) {
    throw new Error("Invalid decrypted gift card code.");
  }

  return code;
}
