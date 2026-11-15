
"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  initialAvatarUrl: string | null;
  username: string;
};

export default function AvatarUpload({
  userId,
  initialAvatarUrl,
  username,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Image must be smaller than 5MB.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const newAvatarUrl = data.publicUrl;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      setMessage("Profile picture updated successfully.");
    } catch (error) {
      console.error("Avatar upload error:", error);
      setMessage("Upload failed. Please try again.");
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative h-28 w-28 overflow-hidden rounded-full border-4 border-purple-500/40 bg-[#171323] transition hover:border-purple-400 disabled:opacity-60"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Your profile picture"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-4xl font-black text-purple-400">
            {username.charAt(0).toUpperCase() || "G"}
          </span>
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
          {uploading ? "Uploading..." : "Change"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="mt-3 text-sm font-semibold text-purple-400 transition hover:text-purple-300 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Change Profile Picture"}
      </button>

      <p className="mt-2 text-center text-xs text-gray-500">
        JPG, PNG or GIF · Maximum 5MB
      </p>

      {message && (
        <p className="mt-3 text-center text-xs text-purple-300">
          {message}
        </p>
      )}
    </div>
  );
}
