import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const LIST_PATH = "/dashboard/leave-requests";

export function DetailActions({ leaveId }: { leaveId: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild className="cursor-pointer">
        <Link href={LIST_PATH}>
          <ArrowLeft className="size-4" />
          Back to list
        </Link>
      </Button>
      <Button variant="outline" asChild className="cursor-pointer">
        <Link href={`${LIST_PATH}/${leaveId}/print`}>
          <Printer className="size-4" />
          Print
        </Link>
      </Button>
    </div>
  );
}