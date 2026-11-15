
"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Could not sign out. Please try again.");
      return;
    }

    router.replace("/auth");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="bg-red-600/10 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white px-5 py-3 rounded-xl text-sm font-semibold transition"
    >
      Sign Out
    </button>
  );
}
