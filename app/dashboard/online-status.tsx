
"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  userId?: string;
};

export default function OnlineStatus({ userId }: Props) {
  useEffect(() => {
    let updating = false;

    async function updateLastSeen() {
      if (
        document.visibilityState !== "visible" ||
        updating
      ) {
        return;
      }

      updating = true;

      try {
        let activeUserId = userId;

        if (!activeUserId) {
          const { data: { user }, error } = await supabase.auth.getUser();

          if (error || !user) return;

          activeUserId = user.id;
        }

        const { error } = await supabase
          .from("profiles")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", activeUserId);

        if (error) {
          console.error("Online status update failed:", error.message);
        } else {
          console.log("NELVA online status updated");
        }
      } finally {
        updating = false;
      }
    }

    updateLastSeen();

    const interval = setInterval(updateLastSeen, 30_000);

    document.addEventListener("visibilitychange", updateLastSeen);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", updateLastSeen);
    };
  }, [userId]);

  return null;
}
