"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RedirectToDefaultHome({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    try {
      const key = `clifsa_already_redirected_${userId}`;
      const alreadyRedirected = sessionStorage.getItem(key);
      if (!alreadyRedirected) {
        const saved = localStorage.getItem("clifsa_attendance_settings");
        if (saved) {
          const settings = JSON.parse(saved);
          if (settings.defaultHomePage && settings.defaultHomePage !== "dashboard") {
            sessionStorage.setItem(key, "true");
            if (settings.defaultHomePage === "logs") {
              router.replace("/dashboard/analytics");
            } else if (settings.defaultHomePage === "reports") {
              router.replace("/dashboard/reports");
            }
            return;
          }
        }
      }
      sessionStorage.setItem(key, "true");
    } catch (e) {
      console.error(e);
    }
  }, [router, userId]);

  return null;
}
