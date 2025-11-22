// app/admin/layout.tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import Chatbot from "@/components/Chatbot";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || (!user && typeof window !== "undefined")) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Memuat...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card/90 backdrop-blur-md flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold tracking-tight">Toko</div>
            <div className="text-xs text-muted-foreground mt-1">
              {user?.full_name} ({user?.role})
            </div>
          </div>
          <ModeToggle />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 text-sm">
          <NavItem href="/admin" activePath={pathname}>
            Dashboard
          </NavItem>
          <NavItem href="/admin/purchases" activePath={pathname}>
            Pembelian
          </NavItem>
          {user?.role === "admin" && (
            <NavItem href="/admin/products" activePath={pathname}>
              Produk &amp; Stok
            </NavItem>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 bg-muted/20 px-4 py-6 md:px-6">
        <div className="max-w-6xl mx-auto space-y-6">{children}</div>
      </main>

      {/* Floating AI chatbot (support-style) */}
      <Chatbot />
    </div>
  );
}

function NavItem({
  href,
  activePath,
  children,
}: {
  href: string;
  activePath: string | null;
  children: React.ReactNode;
}) {
  const active = activePath === href;
  return (
    <Link href={href}>
      <Button
        variant={active ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "w-full justify-start font-normal rounded-xl",
          active
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
        )}
      >
        {children}
      </Button>
    </Link>
  );
}
