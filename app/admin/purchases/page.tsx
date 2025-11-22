"use client";

import { useEffect, useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Pencil,
  Plus,
  Trash2,
  MoreHorizontal,
  Check,
  X,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ProductOption {
  id: number;
  name: string;
  price: number;
}

interface PurchaseRow {
  id: number;
  product_id: number;
  buyer_name: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  product_name?: string;
}

type SupabasePurchaseRow = {
  id: number;
  product_id: number;
  buyer_name: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  products: { name: string }[] | null;
};

export default function PurchasesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";

  const canCreatePurchase = isAdmin; // hanya admin
  const canUpdatePurchase = isAdmin || isStaff; // admin + staff

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRow | null>(
    null
  );

  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [form, setForm] = useState<{
    productId: string;
    buyerName: string;
    quantity: string;
  }>({
    productId: "",
    buyerName: "",
    quantity: "",
  });

  // ====== Derived stats ======
  const totalPurchases = purchases.length;
  const totalRevenue = purchases.reduce(
    (sum, p) => sum + (p.status === "CONFIRMED" ? p.total_price : 0),
    0
  );
  const cancelledCount = purchases.filter(
    (p) => p.status === "CANCELLED"
  ).length;

  // Load produk & pembelian
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [prodRes, purRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, price")
          .order("name", { ascending: true }),
        supabase
          .from("purchases")
          .select(
            "id, product_id, buyer_name, quantity, total_price, status, created_at, products(name)"
          )
          .order("id", { ascending: false }),
      ]);

      if (prodRes.error) {
        console.error("Error fetch products:", prodRes.error);
        setProducts([]);
      } else {
        const prodData = (prodRes.data || []) as {
          id: number;
          name: string;
          price: number;
        }[];
        setProducts(prodData);
      }

      if (purRes.error) {
        console.error("Error fetch purchases:", purRes.error);
        setPurchases([]);
      } else {
        const purRows = (purRes.data || []) as SupabasePurchaseRow[];
        const mapped: PurchaseRow[] = purRows.map((p) => ({
          id: p.id,
          product_id: p.product_id,
          buyer_name: p.buyer_name,
          quantity: p.quantity,
          total_price: p.total_price,
          status: p.status,
          created_at: p.created_at,
          product_name: p.products?.[0]?.name ?? `#${p.product_id}`,
        }));
        setPurchases(mapped);
      }

      setLoading(false);
    };

    void fetchData();
  }, []);

  const resetForm = () => {
    setForm({
      productId: "",
      buyerName: "",
      quantity: "",
    });
    setEditingPurchase(null);
  };

  const openCreateDialog = () => {
    if (!canCreatePurchase) return;
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (purchase: PurchaseRow) => {
    if (!isAdmin) return;
    setEditingPurchase(purchase);
    setForm({
      productId: String(purchase.product_id),
      buyerName: purchase.buyer_name ?? "",
      quantity: String(purchase.quantity),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // ===== CREATE (hanya admin) =====
    if (!editingPurchase) {
      if (!canCreatePurchase) return;

      const productIdNum = Number(form.productId);
      const quantityNum = Number(form.quantity);
      const buyerName = form.buyerName.trim() || null;

      if (!productIdNum || Number.isNaN(productIdNum)) {
        alert("Pilih produk terlebih dahulu.");
        return;
      }

      if (!quantityNum || Number.isNaN(quantityNum) || quantityNum <= 0) {
        alert("Jumlah pembelian tidak valid.");
        return;
      }

      setSaving(true);

      try {
        const { data: prod, error: prodErr } = await supabase
          .from("products")
          .select("id, price, product_stock(quantity)")
          .eq("id", productIdNum)
          .maybeSingle();

        if (prodErr || !prod) {
          console.error("Gagal baca produk:", prodErr);
          alert("Gagal membaca data produk.");
          return;
        }

        const price = prod.price as number;
        const currentStock =
          (prod.product_stock &&
            (prod.product_stock as { quantity: number }[])[0]?.quantity) ??
          0;

        if (currentStock < quantityNum) {
          alert(
            `Stok tidak cukup. Stok sekarang: ${currentStock}, diminta: ${quantityNum}.`
          );
          return;
        }

        const totalPrice = price * quantityNum;

        const { data: inserted, error: purchaseErr } = await supabase
          .from("purchases")
          .insert({
            product_id: productIdNum,
            buyer_name: buyerName,
            quantity: quantityNum,
            total_price: totalPrice,
            status: "CONFIRMED",
          })
          .select("id, created_at")
          .single();

        if (purchaseErr || !inserted) {
          console.error("Gagal buat pembelian:", purchaseErr);
          alert("Gagal mencatat pembelian.");
          return;
        }

        const { error: stockUpdErr } = await supabase
          .from("product_stock")
          .update({ quantity: currentStock - quantityNum })
          .eq("product_id", productIdNum);

        if (stockUpdErr) {
          console.error("Gagal update stok:", stockUpdErr);
          alert(
            "Pembelian tercatat, tetapi stok gagal diupdate. Harap cek stok secara manual."
          );
        }

        const productName =
          products.find((p) => p.id === productIdNum)?.name ??
          `#${productIdNum}`;

        setPurchases((prev) => [
          {
            id: inserted.id,
            product_id: productIdNum,
            buyer_name: buyerName,
            quantity: quantityNum,
            total_price: totalPrice,
            status: "CONFIRMED",
            created_at: inserted.created_at,
            product_name: productName,
          },
          ...prev,
        ]);

        resetForm();
        setDialogOpen(false);
      } finally {
        setSaving(false);
      }

      return;
    }

    // ===== UPDATE (EDIT) – hanya admin =====
    if (!isAdmin) return;
    const id = editingPurchase.id;

    const newQuantity = Number(form.quantity);
    const newBuyerName = form.buyerName.trim() || null;

    if (!newQuantity || Number.isNaN(newQuantity) || newQuantity <= 0) {
      alert("Jumlah pembelian tidak valid.");
      return;
    }

    setSaving(true);

    try {
      // Ambil pembelian lama dari DB
      const { data: fullPurchase, error: purErr } = await supabase
        .from("purchases")
        .select("id, product_id, quantity, status")
        .eq("id", id)
        .maybeSingle();

      if (purErr || !fullPurchase) {
        console.error("Gagal baca pembelian untuk edit:", purErr);
        alert("Gagal membaca data pembelian.");
        return;
      }

      const oldQty = fullPurchase.quantity as number;
      const status = fullPurchase.status as string;
      const productId = fullPurchase.product_id as number;

      // Ambil harga produk
      const { data: product, error: productErr } = await supabase
        .from("products")
        .select("price")
        .eq("id", productId)
        .maybeSingle();

      if (productErr || !product) {
        console.error("Gagal baca produk untuk edit:", productErr);
        alert("Gagal membaca harga produk.");
        return;
      }

      const price = product.price as number;
      const totalPrice = price * newQuantity;

      // Sesuaikan stok hanya jika status CONFIRMED
      if (status === "CONFIRMED") {
        const delta = newQuantity - oldQty;

        if (delta !== 0) {
          const { data: stockRow, error: stockErr } = await supabase
            .from("product_stock")
            .select("id, quantity")
            .eq("product_id", productId)
            .maybeSingle();

          if (stockErr || !stockRow) {
            console.error("Gagal baca stok untuk edit:", stockErr);
            alert("Gagal membaca stok produk.");
            return;
          }

          const currentStock = stockRow.quantity as number;

          if (delta > 0 && currentStock < delta) {
            alert(
              `Stok tidak cukup untuk menaikkan jumlah. Stok sekarang: ${currentStock}, tambahan diminta: ${delta}.`
            );
            return;
          }

          const newStock = currentStock - delta; // delta bisa negatif (stok kembali)
          const { error: updStockErr } = await supabase
            .from("product_stock")
            .update({ quantity: newStock })
            .eq("id", stockRow.id);

          if (updStockErr) {
            console.error("Gagal update stok saat edit:", updStockErr);
            alert("Gagal mengupdate stok produk.");
            return;
          }
        }
      }

      // Update pembelian
      const { error: updPurchaseErr } = await supabase
        .from("purchases")
        .update({
          buyer_name: newBuyerName,
          quantity: newQuantity,
          total_price: totalPrice,
        })
        .eq("id", id);

      if (updPurchaseErr) {
        console.error("Gagal update pembelian:", updPurchaseErr);
        alert("Gagal mengupdate pembelian.");
        return;
      }

      // Update state lokal
      setPurchases((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                buyer_name: newBuyerName,
                quantity: newQuantity,
                total_price: totalPrice,
              }
            : p
        )
      );

      resetForm();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (
    id: number,
    newStatus: "CONFIRMED" | "CANCELLED"
  ) => {
    if (!canUpdatePurchase) return;

    const purchase = purchases.find((p) => p.id === id);
    if (!purchase) return;

    if (purchase.status === newStatus) return;

    setStatusUpdatingId(id);

    try {
      const { data: fullPurchase, error: purErr } = await supabase
        .from("purchases")
        .select("id, product_id, quantity, status")
        .eq("id", id)
        .maybeSingle();

      if (purErr || !fullPurchase) {
        console.error("Gagal baca pembelian:", purErr);
        alert("Gagal membaca data pembelian.");
        return;
      }

      const prevStatus = fullPurchase.status as string;

      const { error: updErr } = await supabase
        .from("purchases")
        .update({
          status: newStatus,
          cancelled_at:
            newStatus === "CANCELLED" ? new Date().toISOString() : null,
          cancelled_by: newStatus === "CANCELLED" ? user?.id ?? null : null,
        })
        .eq("id", id);

      if (updErr) {
        console.error("Gagal update status:", updErr);
        alert("Gagal mengupdate status pembelian.");
        return;
      }

      // Jika dari CONFIRMED -> CANCELLED, kembalikan stok
      if (prevStatus === "CONFIRMED" && newStatus === "CANCELLED") {
        const { data: stockRow, error: stockErr } = await supabase
          .from("product_stock")
          .select("id, quantity")
          .eq("product_id", fullPurchase.product_id)
          .maybeSingle();

        if (!stockErr && stockRow) {
          await supabase
            .from("product_stock")
            .update({
              quantity: (stockRow.quantity as number) + fullPurchase.quantity,
            })
            .eq("id", stockRow.id);
        }
      }

      setPurchases((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: newStatus,
              }
            : p
        )
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDeletePurchase = async (id: number) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(
      "Yakin ingin menghapus pembelian ini? Stok tidak akan disesuaikan otomatis. Untuk mengembalikan stok, gunakan fitur Cancel."
    );
    if (!confirmDelete) return;

    setDeletingId(id);

    try {
      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) {
        console.error("Gagal hapus pembelian:", error);
        alert("Gagal menghapus pembelian.");
        return;
      }

      setPurchases((prev) => prev.filter((p) => p.id !== id));

      if (editingPurchase?.id === id) {
        resetForm();
        setDialogOpen(false);
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Harap login terlebih dahulu untuk mengakses halaman pembelian.
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Manajemen Pembelian
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Catat transaksi, ubah status, dan kelola riwayat pembelian.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              <span className="uppercase tracking-wide">Role</span>
              <span className="h-1 w-1 rounded-full bg-sky-500" />
              <span className="font-medium text-foreground">
                {isAdmin
                  ? "Admin (Create / Edit / Delete / Status)"
                  : isStaff
                  ? "Staff (Update Status)"
                  : user.role}
              </span>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                className="inline-flex items-center gap-1"
                onClick={openCreateDialog}
              >
                <Plus className="h-3 w-3" />
                Catat Pembelian
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border border-border/70 bg-linear-to-br from-sky-500/6 via-background to-background shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total Pembelian
              </p>
              <p className="mt-2 text-2xl font-semibold">{totalPurchases}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pendapatan Terkonfirmasi
              </p>
              <p className="mt-2 text-lg font-semibold">
                {totalRevenue > 0
                  ? `Rp ${totalRevenue.toLocaleString("id-ID")}`
                  : "-"}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Pembatalan
              </p>
              <p className="mt-2 text-2xl font-semibold">{cancelledCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabel pembelian full-width */}
        <Card className="rounded-2xl border border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Daftar Pembelian</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Staff dapat mengubah status menjadi{" "}
              <span className="font-semibold">CONFIRMED</span> atau{" "}
              <span className="font-semibold">CANCELLED</span>. Edit dan hapus
              hanya untuk admin.
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-xs text-muted-foreground">
                Memuat data pembelian...
              </p>
            ) : purchases.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada pembelian tercatat.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Pembeli</TableHead>
                      <TableHead>Jumlah</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p) => (
                      <TableRow
                        key={p.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          #{p.id}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.product_name}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.buyer_name || "-"}
                        </TableCell>
                        <TableCell className="text-xs">{p.quantity}</TableCell>
                        <TableCell className="text-xs">
                          Rp {p.total_price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.status === "CONFIRMED" && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 px-2 py-0.5 text-[10px] font-medium">
                              CONFIRMED
                            </span>
                          )}
                          {p.status === "CANCELLED" && (
                            <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 px-2 py-0.5 text-[10px] font-medium">
                              CANCELLED
                            </span>
                          )}
                          {p.status !== "CONFIRMED" &&
                            p.status !== "CANCELLED" && (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200 px-2 py-0.5 text-[10px] font-medium">
                                {p.status}
                              </span>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Satu tombol menu aksi supaya rapi */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="rounded-full"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                              <DropdownMenuSeparator />

                              {/* Edit: admin */}
                              {isAdmin && (
                                <DropdownMenuItem
                                  onClick={() => openEditDialog(p)}
                                >
                                  <Pencil className="mr-2 h-3 w-3" />
                                  Edit pembelian
                                </DropdownMenuItem>
                              )}

                              {/* Confirm / Cancel: admin + staff */}
                              {canUpdatePurchase && (
                                <>
                                  <DropdownMenuItem
                                    disabled={
                                      p.status === "CONFIRMED" ||
                                      statusUpdatingId === p.id
                                    }
                                    onClick={() =>
                                      handleUpdateStatus(p.id, "CONFIRMED")
                                    }
                                  >
                                    {statusUpdatingId === p.id ? (
                                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="mr-2 h-3 w-3" />
                                    )}
                                    Tandai confirmed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={
                                      p.status === "CANCELLED" ||
                                      statusUpdatingId === p.id
                                    }
                                    onClick={() =>
                                      handleUpdateStatus(p.id, "CANCELLED")
                                    }
                                  >
                                    {statusUpdatingId === p.id ? (
                                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="mr-2 h-3 w-3" />
                                    )}
                                    Batalkan (cancel)
                                  </DropdownMenuItem>
                                </>
                              )}

                              {/* Hapus: admin */}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={deletingId === p.id}
                                    onClick={() => handleDeletePurchase(p.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    {deletingId === p.id ? (
                                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-2 h-3 w-3" />
                                    )}
                                    Hapus pembelian
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Create / Edit Pembelian */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) {
            setDialogOpen(open);
            if (!open) resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingPurchase ? "Edit Pembelian" : "Catat Pembelian Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingPurchase
                ? "Ubah nama pembeli dan jumlah. Stok akan disesuaikan jika status masih CONFIRMED."
                : "Pilih produk, isi jumlah, dan (opsional) nama pembeli."}
            </DialogDescription>
          </DialogHeader>

          {/* Progress bar saat saving */}
          {saving && (
            <div className="mb-3">
              <Progress value={70} className="h-1" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Memproses pembelian...
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="productId">Produk</Label>
              <select
                id="productId"
                value={form.productId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, productId: e.target.value }))
                }
                disabled={!!editingPurchase || saving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Pilih produk</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} (Rp {p.price.toLocaleString("id-ID")})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyerName">Nama pembeli (opsional)</Label>
              <Input
                id="buyerName"
                value={form.buyerName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, buyerName: e.target.value }))
                }
                placeholder="Contoh: Budi"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Jumlah</Label>
              <Input
                id="quantity"
                type="number"
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                placeholder="Contoh: 2"
                disabled={saving}
              />
            </div>

            <DialogFooter className="mt-4 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setDialogOpen(false);
                }}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || (!canCreatePurchase && !editingPurchase)}
                className="inline-flex items-center gap-1"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {editingPurchase ? "Simpan perubahan" : "Simpan pembelian"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
