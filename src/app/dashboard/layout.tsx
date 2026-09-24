import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/site-header";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarkSessionRedirected } from "@/components/mark-session-redirected";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const sidebarUser = {
    name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    avatar: user.user_metadata?.avatar_url || "",
    role: profile?.role || "member",
  };

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <MarkSessionRedirected userId={user.id} />
      <AppSidebar user={sidebarUser} />
      <SidebarInset>
        <Suspense fallback={
          <header className="flex h-17.25 shrink-0 items-center gap-2 border-b w-full bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-14.25" />
        }>
          <SiteHeader isAdmin={sidebarUser.role === "admin"} />
        </Suspense>

        <div className="h-full overflow-y-auto [scrollbar-gutter:stable]">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
