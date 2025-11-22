// app/page.tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  // default demo account
  const [email, setEmail] = useState("admin@toko.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // kalau sudah login, langsung masuk dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace("/admin");
    }
  }, [loading, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.replace("/admin");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Terjadi kesalahan saat login.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-linear-to-br from-zinc-50 via-zinc-100 to-zinc-200 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center px-4">
      {/* toggle theme di pojok kanan atas */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="w-full max-w-5xl grid gap-10 md:grid-cols-[1.1fr,1fr] items-center">
        {/* Card login */}
        <Card className="w-full max-w-md mx-auto border-border bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">
              Masuk ke Admin
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Gunakan akun demo&ensp;
              <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-emerald-500">
                Admin
              </span>
              &ensp;atau&ensp;
              <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-blue-500">
                Staff
              </span>
              &ensp; yang sudah disiapkan.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@toko.com"
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/60 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col items-stretch gap-3 mt-2">
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Masuk..." : "Masuk"}
              </Button>

              <div className="text-xs text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-900 border border-border rounded-md px-3 py-2 text-left">
                Demo user:
                <ul className="list-disc ml-4 mt-1 space-y-0.5">
                  <li>admin@toko.com / admin123 (role: admin)</li>
                  <li>staff@toko.com / staff123 (role: staff)</li>
                </ul>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
