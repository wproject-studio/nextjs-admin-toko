// app/admin/products/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, Pencil, Plus, Trash2, MoreHorizontal } from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ProductWithStock {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string | null;
  stock: number;
}

type SupabaseProductRow = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string | null;
  product_stock: { quantity: number }[] | null;
};

export default function ProductsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "staff";
  const canWriteProduct = isAdmin || isStaff;

  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(
    null
  );

  const [form, setForm] = useState<{
    id: number | null;
    name: string;
    category: string;
    price: string;
    description: string;
    stock: string;
  }>({
    id: null,
    name: "",
    category: "",
    price: "",
    description: "",
    stock: "",
  });

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/");
      } else if (user.role !== "admin") {
        router.replace("/admin");
      }
    }
  }, [loading, user, router]);

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  const avgPrice =
    products.length > 0
      ? products.reduce((sum, p) => sum + p.price, 0) / products.length
      : 0;

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, category, price, description, product_stock(quantity)"
        )
        .order("id", { ascending: true });

      if (error) {
        console.error("Error fetch products:", error);
        setProducts([]);
      } else {
        const rows = (data || []) as SupabaseProductRow[];
        const mapped: ProductWithStock[] = rows.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description,
          stock: p.product_stock?.[0]?.quantity ?? 0,
        }));
        setProducts(mapped);
      }

      setLoadingProducts(false);
    };

    void fetchProducts();
  }, []);

  const resetForm = () => {
    setForm({
      id: null,
      name: "",
      category: "",
      price: "",
      description: "",
      stock: "",
    });
    setEditingProduct(null);
  };

  const openCreateDialog = () => {
    if (!canWriteProduct) return;
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (p: ProductWithStock) => {
    if (!canWriteProduct) return;
    setEditingProduct(p);
    setForm({
      id: p.id,
      name: p.name,
      category: p.category,
      price: String(p.price),
      description: p.description ?? "",
      stock: String(p.stock),
    });
    setDialogOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!isAdmin) return;

    const confirmDelete = window.confirm(
      "Yakin ingin menghapus produk ini? Tindakan ini tidak bisa dibatalkan."
    );
    if (!confirmDelete) return;

    const { error: stockErr } = await supabase
      .from("product_stock")
      .delete()
      .eq("product_id", id);
    if (stockErr) {
      console.error("Gagal hapus stok:", stockErr);
      alert("Gagal menghapus stok produk. Coba lagi.");
      return;
    }

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error("Gagal hapus produk:", error);
      alert("Gagal menghapus produk. Coba lagi.");
      return;
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (form.id === id) {
      resetForm();
      setDialogOpen(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWriteProduct) return;

    const name = form.name.trim();
    const category = form.category.trim();
    const priceNum = Number(form.price);
    const stockNum = form.stock === "" ? null : Number(form.stock);
    const description = form.description.trim() || null;

    if (!name || !category || Number.isNaN(priceNum)) {
      alert("Nama, kategori, dan harga wajib diisi.");
      return;
    }

    setSaving(true);

    try {
      if (form.id == null) {
        const { data, error } = await supabase
          .from("products")
          .insert({
            name,
            category,
            price: priceNum,
            description,
          })
          .select("id")
          .single();

        if (error || !data) {
          console.error("Gagal tambah produk:", error);
          alert("Gagal menambahkan produk.");
          return;
        }

        if (stockNum != null && !Number.isNaN(stockNum)) {
          const { error: stockErr } = await supabase
            .from("product_stock")
            .insert({ product_id: data.id, quantity: stockNum });
          if (stockErr) {
            console.error("Gagal simpan stok awal:", stockErr);
            alert(
              `Produk berhasil dibuat (id=${data.id}), tetapi stok awal gagal disimpan.`
            );
          }
        }

        setProducts((prev) => [
          ...prev,
          {
            id: data.id,
            name,
            category,
            price: priceNum,
            description,
            stock: stockNum ?? 0,
          },
        ]);
      } else {
        const id = form.id;

        const updateFields: {
          name?: string;
          category?: string;
          price?: number;
          description?: string | null;
        } = {
          name,
          category,
          price: priceNum,
          description,
        };

        const { error: updErr } = await supabase
          .from("products")
          .update(updateFields)
          .eq("id", id);

        if (updErr) {
          console.error("Gagal update produk:", updErr);
          alert("Gagal mengupdate produk.");
          return;
        }

        if (stockNum != null && !Number.isNaN(stockNum)) {
          const { data: stockRow, error: stockSelErr } = await supabase
            .from("product_stock")
            .select("id")
            .eq("product_id", id)
            .maybeSingle();

          if (stockSelErr) {
            console.error("Gagal cek stok:", stockSelErr);
          } else if (!stockRow) {
            const { error: insErr } = await supabase
              .from("product_stock")
              .insert({ product_id: id, quantity: stockNum });
            if (insErr) {
              console.error("Gagal buat stok:", insErr);
            }
          } else {
            const { error: updStockErr } = await supabase
              .from("product_stock")
              .update({ quantity: stockNum })
              .eq("id", stockRow.id);
            if (updStockErr) {
              console.error("Gagal update stok:", updStockErr);
            }
          }
        }

        setProducts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  name,
                  category,
                  price: priceNum,
                  description,
                  stock: stockNum ?? p.stock,
                }
              : p
          )
        );
      }

      resetForm();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user || !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Memuat...</div>;
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Manajemen Produk
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Tambah, perbarui, dan kelola stok produk untuk toko kamu.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
              <span className="uppercase tracking-wide">Role</span>
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              <span className="font-medium text-foreground">
                {isAdmin ? "Admin (CRUD)" : isStaff ? "Staff (CRU)" : user.role}
              </span>
            </div>
            {canWriteProduct && (
              <Button
                size="sm"
                className="inline-flex items-center gap-1"
                onClick={openCreateDialog}
              >
                <Plus className="h-3 w-3" />
                Tambah Produk
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border border-border/70 bg-linear-to-br from-emerald-500/5 via-background to-background shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total Produk
              </p>
              <p className="mt-2 text-2xl font-semibold">{totalProducts}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Total Stok
              </p>
              <p className="mt-2 text-2xl font-semibold">{totalStock}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/70 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Harga rata-rata
              </p>
              <p className="mt-2 text-lg font-semibold">
                {avgPrice > 0
                  ? `Rp ${Math.round(avgPrice).toLocaleString("id-ID")}`
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabel produk full-width */}
        <Card className="rounded-2xl border border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Daftar Produk</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Klik menu aksi di tiap baris untuk mengedit atau menghapus produk.
              Hapus hanya tersedia untuk admin.
            </p>
          </CardHeader>
          <CardContent>
            {loadingProducts ? (
              <p className="text-xs text-muted-foreground">
                Memuat data produk...
              </p>
            ) : products.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada produk. Tambahkan produk pertama dari tombol
                &quot;Tambah Produk&quot;.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Stok</TableHead>
                      <TableHead className="w-20 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow
                        key={p.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="text-xs text-muted-foreground">
                          #{p.id}
                        </TableCell>
                        <TableCell className="text-sm">{p.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.category}
                        </TableCell>
                        <TableCell className="text-xs">
                          Rp {p.price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-xs">{p.stock}</TableCell>
                        <TableCell className="text-right">
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

                              {/* Edit: admin & staff (tapi staff nggak akan sampai sini karena guard admin di atas) */}
                              {canWriteProduct && (
                                <DropdownMenuItem
                                  onClick={() => openEditDialog(p)}
                                >
                                  <Pencil className="mr-2 h-3 w-3" />
                                  Edit produk
                                </DropdownMenuItem>
                              )}

                              {/* Hapus: admin */}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteProduct(p.id)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Hapus produk
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

      {/* Dialog Create / Edit Produk */}
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
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingProduct
                ? "Perbarui informasi produk dan stok. Perubahan akan langsung tersimpan di database."
                : "Isi detail produk baru beserta stok awalnya."}
            </DialogDescription>
          </DialogHeader>

          {saving && (
            <div className="mb-3">
              <Progress value={70} className="h-1" />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Menyimpan perubahan...
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama produk</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Contoh: Kursi Kantor Putar"
                disabled={saving || !canWriteProduct}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Kategori</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                placeholder="Contoh: Kursi"
                disabled={saving || !canWriteProduct}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="price">Harga (Rp)</Label>
                <Input
                  id="price"
                  type="number"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="1500000"
                  disabled={saving || !canWriteProduct}
                />
              </div>
              <div className="w-full space-y-1.5 sm:w-32">
                <Label htmlFor="stock">Stok</Label>
                <Input
                  id="stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stock: e.target.value }))
                  }
                  placeholder="10"
                  disabled={saving || !canWriteProduct}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Deskripsi</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Opsional"
                disabled={saving || !canWriteProduct}
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
                disabled={saving || !canWriteProduct}
                className="inline-flex items-center gap-1"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {editingProduct ? "Simpan perubahan" : "Simpan produk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
