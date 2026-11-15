
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  initialDisplayName: string;
  initialBio: string;
  username: string;
};

export default function EditProfile({
  userId,
  initialDisplayName,
  initialBio,
  username,
}: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
      })
      .eq("id", userId);

    if (error) {
      setMessage("Couldn't save your profile. Please try again.");
      setSaving(false);
      return;
    }

    setMessage("Profile updated successfully!");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-300">
          Username
        </label>
        <input
          value={`@${username}`}
          disabled
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-gray-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-300">
          Display Name
        </label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={40}
          placeholder="Your display name"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-300">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={160}
          rows={4}
          placeholder="Tell the NELVA community about yourself..."
          className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
        />
        <p className="mt-1 text-right text-xs text-gray-500">
          {bio.length}/160
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      {message && (
        <p className="text-center text-sm text-purple-300">{message}</p>
      )}
    </form>
  );
}
