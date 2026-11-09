"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button className="cursor-pointer" onClick={() => window.print()}>
    Print (2 copies)
    </Button>
  )
}