// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart as ReBarChart,
  Bar,
} from "recharts";
import { useAuth } from "@/components/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  ShoppingBag,
  Wallet2,
  BarChart3,
  ArrowRight,
  MessageCircle,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type ProductAggRow = {
  id: number;
  category: string;
  product_stock: { quantity: number }[] | null;
};

type PurchaseAggRow = {
  id: number;
  total_price: number;
  status: string;
  created_at: string;
};

type PurchaseChartPoint = {
  date: string;
  total: number;
};

type StockChartPoint = {
  category: string;
  stock: number;
};

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);

  const [productCount, setProductCount] = useState<number>(0);
  const [stockTotal, setStockTotal] = useState<number>(0);
  const [purchaseTotal30d, setPurchaseTotal30d] = useState<number>(0);
  const [purchase7Days, setPurchase7Days] = useState<PurchaseChartPoint[]>([]);
  const [stockByCategory, setStockByCategory] = useState<StockChartPoint[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);

      // -------- Produk & Stok --------
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id, category, product_stock(quantity)");

      if (!productError && productData) {
        const rows = productData as ProductAggRow[];
        setProductCount(rows.length);

        let totalStock = 0;
        const categoryMap = new Map<string, number>();

        rows.forEach((p) => {
          const qty = p.product_stock?.[0]?.quantity ?? 0;
          totalStock += qty;
          categoryMap.set(p.category, (categoryMap.get(p.category) ?? 0) + qty);
        });

        setStockTotal(totalStock);

        const stockChart: StockChartPoint[] = Array.from(
          categoryMap.entries()
        ).map(([category, stock]) => ({ category, stock }));

        stockChart.sort((a, b) => b.stock - a.stock);
        setStockByCategory(stockChart);
      } else if (productError) {
        console.error("Error fetch products summary:", productError);
      }

      // -------- Pembelian --------
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select("id, total_price, status, created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      if (!purchaseError && purchaseData) {
        const rows = purchaseData as PurchaseAggRow[];
        const confirmed = rows.filter((p) => p.status === "CONFIRMED");

        const total30d = confirmed.reduce((sum, p) => sum + p.total_price, 0);
        setPurchaseTotal30d(total30d);

        const now = new Date();
        const chartPoints: PurchaseChartPoint[] = [];

        for (let offset = 6; offset >= 0; offset -= 1) {
          const d = new Date(now);
          d.setDate(now.getDate() - offset);
          const key = d.toISOString().slice(0, 10);
          const label = `${d.getDate()}/${d.getMonth() + 1}`;
          const total = confirmed
            .filter((p) => p.created_at.slice(0, 10) === key)
            .reduce((sum, p) => sum + p.total_price, 0);
          chartPoints.push({ date: label, total });
        }

        setPurchase7Days(chartPoints);
      } else if (purchaseError) {
        console.error("Error fetch purchases summary:", purchaseError);
      }

      setLoading(false);
    };

    void loadDashboardData();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header ringkas */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Sekilas performa toko & akses cepat.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-foreground font-medium">
            {user?.full_name ?? "Tidak login"}
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="uppercase tracking-wide">
            {user?.role ?? "unknown"}
          </span>
        </div>
      </header>

      {/* Stat cards sederhana */}
      <section className="grid gap-3 md:grid-cols-3">
        <Card className="border-border bg-card/80">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Produk
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {loading ? "…" : productCount}
              </p>
            </div>
            <div className="rounded-full bg-emerald-500/10 p-2">
              <Package className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total stok
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {loading ? "…" : stockTotal}
              </p>
            </div>
            <div className="rounded-full bg-sky-500/10 p-2">
              <ShoppingBag className="h-5 w-5 text-sky-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Pendapatan 30 hari
              </p>
              <p className="mt-1 text-lg font-semibold">
                {loading
                  ? "…"
                  : `Rp ${purchaseTotal30d.toLocaleString("id-ID")}`}
              </p>
            </div>
            <div className="rounded-full bg-amber-500/10 p-2">
              <Wallet2 className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Charts ringkas */}
      <section className="grid gap-4 lg:grid-cols-3 items-stretch">
        <Card className="lg:col-span-2 border-border bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-sky-500" />
              Pendapatan 7 hari
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {loading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Memuat grafik...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={purchase7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb33" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) =>
                      v === 0 ? "0" : `${(v / 1_000_000).toFixed(0)}jt`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) =>
                      `Rp ${value.toLocaleString("id-ID")}`
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </ReLineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium">
              Stok per kategori
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {loading || stockByCategory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {loading ? "Memuat..." : "Belum ada data stok."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart
                  data={stockByCategory}
                  layout="vertical"
                  margin={{ left: 40, right: 10, top: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb33" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="stock" fill="#3b82f6" radius={[4, 4, 4, 4]} />
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Akses cepat + info AI singkat */}
      <section className="grid gap-4 lg:grid-cols-2 items-stretch">
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Akses cepat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="justify-between"
            >
              <Link href="/admin/products">
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Kelola produk & stok
                </span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="justify-between"
            >
              <Link href="/admin/purchases">
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Kelola pembelian
                </span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Gunakan tombol chat bulat di pojok kanan bawah untuk:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tambah / ubah produk & stok.</li>
              <li>Catat pembelian dan ubah status.</li>
              <li>Kosongkan stok dengan satu perintah.</li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
