"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function MarkSessionRedirected({ userId }: { userId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/dashboard") {
      try {
        sessionStorage.setItem(`clifsa_already_redirected_${userId}`, "true");
      } catch (e) {
        console.error(e);
      }
    }
  }, [pathname, userId]);
  return null;
}
