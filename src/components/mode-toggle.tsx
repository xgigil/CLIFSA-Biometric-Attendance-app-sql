"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { IconSun, IconMoon } from "@tabler/icons-react";

const emptySubscribe = () => () => {};

export function ModeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="shrink-0" aria-label="Toggle theme">
        <div className="size-5 md:size-6" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="shrink-0"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <IconSun className="size-5 md:size-6 text-gray-700 dark:text-foreground" />
      ) : (
        <IconMoon className="size-5 md:size-6 text-gray-700 dark:text-foreground" />
      )}
    </Button>
  );
}

export default ModeToggle;
