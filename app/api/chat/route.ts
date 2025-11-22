/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const runtime = "nodejs";

type AppUser = {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "staff";
};

type CRUDAction = {
  entity: "product" | "purchase";
  operation: "create" | "read" | "update" | "delete";
  params: any;
} | null;

type Plan = {
  reply: string;
  action: CRUDAction;
};

async function callOpenAIForPlan(
  messages: { role: string; content: string }[],
  user: AppUser | null
): Promise<Plan> {
  // Kalau key belum diset, jangan meledakkan server
  if (!OPENAI_API_KEY) {
    return {
      reply:
        "Layanan AI belum dikonfigurasi (OPENAI_API_KEY kosong). Kamu tetap bisa pakai halaman admin secara manual.",
      action: null,
    };
  }

  const systemPrompt = `
Kamu adalah AI asisten cerdas untuk admin dan staff toko furniture SEKALIGUS asisten umum seperti ChatGPT.

FOKUS:
- Pahami perintah dalam bahasa Indonesia bebas, tidak harus kata-kata tertentu.
  Mengerti sinonim seperti: "kosongkan stok", "nolkan stok", "hapus semua stok", dsb.
- Jika perintah menyangkut data di sistem (produk, stok, pembelian):
    -> rencanakan operasi CRUD (create / read / update / delete)
    -> kembalikan detail aksi tersebut di field "action".
- Jika perintah di luar sistem (tips marketing, ide konten, dll):
    -> jawab seperti ChatGPT biasa
    -> set "action": null.

ROLE & IZIN:
- Admin:
  - Produk: boleh penuh CRUD (Create, Read, Update, Delete).
  - Pembelian: boleh penuh CRUD (termasuk membuat, mengubah status, dan menghapus).
- Staff:
  - Produk: boleh Create, Read, Update; TIDAK boleh Delete.
  - Pembelian: boleh Read dan Update status (CONFIRMED/CANCELLED); TIDAK boleh Create atau Delete.

Jawaban HARUS berupa JSON:

{
  "reply": "Jawaban ke user, gaya santai tapi sopan, jelaskan apa yang kamu pahami dan apa yang akan/baru saja kamu lakukan.",
  "action": {
    "entity": "product" | "purchase",
    "operation": "create" | "read" | "update" | "delete",
    "params": {
      ...parameter yang dibutuhkan...
    }
  }
}

Kalau tidak ada operasi ke DB yang perlu dilakukan, set:
"action": null.

========================
SCHEMA CRUD UNTUK DATABASE
========================

Tabel:
- products (id, name, category, price, description)
- product_stock (product_id, quantity)
- purchases (id, product_id, buyer_name, quantity, total_price, status)

=== PRODUCT CRUD ===

entity: "product"

1) operation: "create"
   params:
   - name (string)
   - category (string)
   - price (number)
   - description? (string)
   - initialStock? (number)

2) operation: "read"
   params:
   - id? (number)
   - name? (string)
   - query? (string)
   Jika semua kosong -> ambil daftar semua produk.

3) operation: "update"
   params:
   - id? (number)
   - name? (string)
   - scope? (string: "all")  // gunakan "all" untuk operasi ke SEMUA produk
   - newName? (string)
   - newCategory? (string)
   - newPrice? (number)
   - newDescription? (string)
   - newStock? (number)

   Contoh update SATU produk:
   - "Ganti nama produk #3 jadi Sofa Premium"
   - "Ubah harga produk Kursi Kantor Putar jadi 900.000"
   - "Set stok produk Sofa 2 Dudukan jadi 10"

   Contoh update SEMUA produk:
   - "Kosongkan stok semua barang saya"
   - "Set stok semua produk jadi 0"
   - "nolkan semua stok produk"
   Jika jelas merujuk ke semua produk, gunakan:

   "action": {
     "entity": "product",
     "operation": "update",
     "params": {
       "scope": "all",
       "newStock": 0
     }
   }

4) operation: "delete"
   params:
   - id? (number)
   - name? (string)
   - scope? (string: "all")
   - confirmDeleteAll? (boolean)

   PENTING:
   - Jika user ingin menghapus SATU produk tertentu -> boleh langsung rencanakan "delete" dengan id/name (tapi hanya admin yang diizinkan).
   - Jika user ingin menghapus **SEMUA produk** (misalnya bilang "hapus semua produk", "hapus semua data produk", dll):
       *LANGKAH 1*:
       - JANGAN langsung menghapus.
       - Balas dengan penjelasan risiko, dan minta user mengetik PERSIS: "HAPUS SEMUA PRODUK" sebagai konfirmasi.
       - Pada langkah ini, set "action": null.
       *LANGKAH 2*:
       - Jika di pesan berikutnya user menulis tepat: "HAPUS SEMUA PRODUK" (huruf besar kecil boleh berbeda),
         barulah rencanakan aksi:
         "action": {
           "entity": "product",
           "operation": "delete",
           "params": {
             "scope": "all",
             "confirmDeleteAll": true
           }
         }

=== PURCHASE CRUD ===

entity: "purchase"

1) operation: "create"
   params:
   - productId? (number)
   - productName? (string)
   - quantity (number)
   - buyerName? (string)

2) operation: "read"
   params:
   - id? (number)
   Jika id kosong -> tampilkan list pembelian (misal 20 terakhir).

3) operation: "update"
   params:
   - id (number)
   - newStatus? (string: "CONFIRMED" | "CANCELLED")

4) operation: "delete"
   params:
   - id (number)

========================
ATURAN PENTING
========================
- Jawabanmu HARUS HANYA JSON valid, TANPA teks lain, TANPA komentar.
- Nomor seperti "1.500.000" harus diubah menjadi 1500000 (number, bukan string).
- Kamu boleh "berpikir" sendiri, tapi proses berpikir itu JANGAN ditulis di output.
`;

  const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1", // bisa diganti 'gpt-4.1-mini' kalau mau lebih hemat
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "system",
          content: user
            ? `KONTEKS_USER: id=${user.id}, email=${user.email}, role=${user.role}. Hanya rencanakan aksi yang diizinkan role ini.`
            : "KONTEKS_USER: belum login (guest). Jangan jalankan aksi CRUD apa pun, hanya beri jawaban informatif.",
        },
        ...messages,
      ],
      temperature: 0.25,
      response_format: { type: "json_object" },
    }),
  });

  if (!apiRes.ok) {
    let status = apiRes.status;
    let msg = "Gagal memanggil API AI.";
    let code: string | undefined;

    try {
      const errJson = await apiRes.json();
      if (errJson?.error?.message) msg = errJson.error.message;
      if (errJson?.error?.code) code = errJson.error.code;
    } catch {
      try {
        const errText = await apiRes.text();
        if (errText) msg = errText;
      } catch {
        // ignore
      }
    }

    console.error("Error dari OpenAI API:", status, msg);

    if (status === 429 && code === "insufficient_quota") {
      return {
        reply:
          "Saat ini layanan AI kehabisan kuota / tidak aktif. Kamu tetap bisa mengelola produk & pembelian lewat menu admin seperti biasa.\n\n" +
          "Kalau kamu adalah developer, cek kembali plan & billing di dashboard OpenAI atau ganti OPENAI_API_KEY.",
        action: null,
      };
    }

    return {
      reply:
        `Maaf, terjadi masalah saat menghubungi layanan AI (status ${status}). ` +
        `Detail: ${msg}`,
      action: null,
    };
  }

  const data = await apiRes.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";

  try {
    const parsed = JSON.parse(content);
    return {
      reply: parsed.reply ?? "",
      action: parsed.action ?? null,
    };
  } catch (error) {
    console.error("Gagal parse JSON dari AI:", content, error);
    return {
      reply: content,
      action: null,
    };
  }
}

async function handleCRUD(
  action: CRUDAction,
  user: AppUser | null
): Promise<string | null> {
  if (!action) return null;

  const { entity, operation, params = {} } = action;

  if (!user) {
    return "Tidak bisa menjalankan aksi CRUD karena Anda belum login.";
  }

  const isAdmin = user.role === "admin";
  const isStaff = user.role === "staff";

  const requireAdmin = async () => {
    if (!isAdmin) {
      return "Aksi ini hanya boleh dilakukan oleh admin.";
    }
    return null;
  };

  // admin & staff boleh menulis data produk (create + update)
  const requireProductWriter = async () => {
    if (!isAdmin && !isStaff) {
      return "Hanya admin atau staff yang boleh mengubah data produk.";
    }
    return null;
  };

  // admin & staff boleh mengubah status pembelian (CONFIRMED/CANCELLED)
  const requirePurchaseUpdater = async () => {
    if (!isAdmin && !isStaff) {
      return "Hanya admin atau staff yang boleh mengubah status pembelian.";
    }
    return null;
  };

  const findProduct = async (id?: number, name?: string) => {
    if (id) {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    }
    if (name) {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", name)
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data;
    }
    return null;
  };

  // ============= PRODUCT CRUD =============
  if (entity === "product") {
    switch (operation) {
      case "create": {
        const writeErr = await requireProductWriter();
        if (writeErr) return writeErr;

        let { name, category, price, description, initialStock } = params;
        if (!name || !category || price == null) {
          return "Perintah kurang lengkap. Sebutkan minimal nama, kategori, dan harga produk.";
        }

        if (typeof price === "string") price = Number(price);
        if (typeof initialStock === "string")
          initialStock = Number(initialStock);

        const { data: prod, error } = await supabase
          .from("products")
          .insert({
            name,
            category,
            price,
            description: description || null,
          })
          .select("id")
          .single();

        if (error || !prod) {
          console.error(error);
          return "Gagal menambahkan produk ke database.";
        }

        if (initialStock != null && !Number.isNaN(initialStock)) {
          const { error: stockErr } = await supabase
            .from("product_stock")
            .insert({ product_id: prod.id, quantity: initialStock });
          if (stockErr) {
            console.error(stockErr);
            return `Produk "${name}" berhasil dibuat dengan id ${prod.id}, tetapi stok awal gagal disimpan.`;
          }
        }

        return `Produk "${name}" berhasil ditambahkan dengan id ${prod.id}.`;
      }

      case "read": {
        let { id, name, query } = params;
        if (typeof id === "string") id = Number(id);
        if (!query && name) query = name;

        let q = supabase
          .from("products")
          .select(
            "id, name, category, price, description, product_stock(quantity)"
          )
          .order("id", { ascending: true }) as any;

        if (id) {
          q = q.eq("id", id);
        }
        if (query) {
          q = q.ilike("name", `%${query}%`);
        }

        const { data, error } = await q;

        if (error) {
          console.error(error);
          return "Gagal mengambil data produk.";
        }
        if (!data || data.length === 0) {
          return "Tidak ada produk yang cocok dengan permintaan.";
        }

        const lines = data.map((p: any) => {
          const qty = p.product_stock?.[0]?.quantity ?? 0;
          return `#${p.id} ${p.name} (${p.category}) - Rp ${Number(
            p.price
          ).toLocaleString("id-ID")} | stok: ${qty}`;
        });

        return "Berikut data produk:\n" + lines.join("\n");
      }

      case "update": {
        const writeErr = await requireProductWriter();
        if (writeErr) return writeErr;

        let {
          id,
          name,
          newName,
          newCategory,
          newPrice,
          newDescription,
          newStock,
          scope,
        } = params;

        if (typeof id === "string") id = Number(id);
        if (typeof newPrice === "string") newPrice = Number(newPrice);
        if (typeof newStock === "string") newStock = Number(newStock);

        const hasValidNewStock =
          newStock != null && !Number.isNaN(newStock as number);

        const nameStr = typeof name === "string" ? name.toLowerCase() : "";
        const bulkKeywords = [
          "semua produk",
          "semua barang",
          "semua stok",
          "stok semua",
          "stock semua",
          "stok produk kosong semua",
        ];
        const isBulkByName =
          !!nameStr && bulkKeywords.some((key) => nameStr.includes(key));

        // ==== BULK UPDATE: stok semua produk ====
        const isBulkStockUpdate =
          scope === "all" || isBulkByName || (!id && !name && hasValidNewStock);

        if (isBulkStockUpdate && hasValidNewStock) {
          const { error } = await supabase
            .from("product_stock")
            .update({ quantity: newStock })
            .not("id", "is", null);

          if (error) {
            console.error(error);
            return "Gagal mengupdate stok semua produk.";
          }

          return `Stok semua produk berhasil di-set menjadi ${newStock}.`;
        }

        // ==== NORMAL: update 1 produk ====
        const product = await findProduct(id, name);
        if (!product) return "Produk yang dimaksud tidak ditemukan.";

        const updateFields: any = {};
        if (newName) updateFields.name = newName;
        if (newCategory) updateFields.category = newCategory;
        if (newPrice != null && !Number.isNaN(newPrice))
          updateFields.price = newPrice;
        if (typeof newDescription === "string")
          updateFields.description = newDescription;

        if (Object.keys(updateFields).length > 0) {
          const { error } = await supabase
            .from("products")
            .update(updateFields)
            .eq("id", product.id);
          if (error) {
            console.error(error);
            return "Gagal mengupdate data produk.";
          }
        }

        if (hasValidNewStock) {
          const { data: stock, error: stockErr } = await supabase
            .from("product_stock")
            .select("id")
            .eq("product_id", product.id)
            .maybeSingle();

          if (stockErr) {
            console.error(stockErr);
            return "Produk terupdate, tetapi gagal mengupdate stok.";
          }

          if (!stock) {
            const { error: insErr } = await supabase
              .from("product_stock")
              .insert({ product_id: product.id, quantity: newStock });
            if (insErr) {
              console.error(insErr);
              return "Produk terupdate, tetapi gagal menyimpan stok baru.";
            }
          } else {
            const { error: updErr } = await supabase
              .from("product_stock")
              .update({ quantity: newStock })
              .eq("id", stock.id);
            if (updErr) {
              console.error(updErr);
              return "Produk terupdate, tetapi gagal mengupdate stok.";
            }
          }
        }

        return `Produk #${product.id} berhasil diupdate.`;
      }

      case "delete": {
        const adminErr = await requireAdmin();
        if (adminErr) return adminErr;

        let { id, name, scope, confirmDeleteAll } = params;
        if (typeof id === "string") id = Number(id);

        const nameStr = typeof name === "string" ? name.toLowerCase() : "";
        const looksLikeDeleteAll =
          scope === "all" ||
          (nameStr &&
            (nameStr.includes("semua produk") ||
              nameStr.includes("all product") ||
              nameStr.includes("semua barang")));

        // ==== DELETE SEMUA PRODUK DENGAN KONFIRMASI KHUSUS ====
        if (looksLikeDeleteAll) {
          if (!confirmDeleteAll) {
            return 'Saya mendeteksi permintaan menghapus SEMUA produk, tetapi belum ada konfirmasi "HAPUS SEMUA PRODUK". Ulangi dengan mengetik persis: HAPUS SEMUA PRODUK jika Anda yakin.';
          }

          const { error: stockErr } = await supabase
            .from("product_stock")
            .delete()
            .not("product_id", "is", null);

          if (stockErr) {
            console.error(stockErr);
            return "Gagal menghapus stok produk saat mencoba menghapus semua produk.";
          }

          const { error: prodErr } = await supabase
            .from("products")
            .delete()
            .not("id", "is", null);

          if (prodErr) {
            console.error(prodErr);
            return "Terjadi kesalahan saat menghapus semua produk.";
          }

          return "Semua produk dan stok terkait telah dihapus dari database.";
        }

        // ==== DELETE SATU PRODUK ====
        const product = await findProduct(id, name);
        if (!product) return "Produk yang dimaksud tidak ditemukan.";

        const { error: stockDelErr } = await supabase
          .from("product_stock")
          .delete()
          .eq("product_id", product.id);
        if (stockDelErr) {
          console.error(stockDelErr);
        }

        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", product.id);
        if (error) {
          console.error(error);
          return "Gagal menghapus produk dari database.";
        }

        return `Produk #${product.id} ("${product.name}") berhasil dihapus.`;
      }

      default:
        return "Operasi CRUD produk tidak dikenali.";
    }
  }

  // ============= PURCHASE CRUD =============
  if (entity === "purchase") {
    switch (operation) {
      case "create": {
        // HANYA ADMIN yang boleh create pembelian
        const adminErr = await requireAdmin();
        if (adminErr) return adminErr;

        let { productId, productName, quantity, buyerName } = params;
        if (typeof productId === "string") productId = Number(productId);
        if (typeof quantity === "string") quantity = Number(quantity);

        if (!quantity) {
          return "Jumlah pembelian (quantity) belum disebutkan.";
        }

        const product = await findProduct(productId, productName);
        if (!product) return "Produk yang dimaksud tidak ditemukan.";

        const { data: stockData, error: stockErr } = await supabase
          .from("product_stock")
          .select("id, quantity")
          .eq("product_id", product.id)
          .maybeSingle();

        if (stockErr) {
          console.error(stockErr);
          return "Gagal mengecek stok.";
        }
        if (!stockData || stockData.quantity < quantity) {
          return "Stok tidak cukup untuk pembelian ini.";
        }

        const { data: prodDetail, error: priceErr } = await supabase
          .from("products")
          .select("price")
          .eq("id", product.id)
          .maybeSingle();

        if (priceErr || !prodDetail) {
          console.error(priceErr);
          return "Gagal membaca harga produk.";
        }

        const totalPrice = Number(prodDetail.price) * quantity;

        const { error: purchaseErr } = await supabase.from("purchases").insert({
          product_id: product.id,
          buyer_name: buyerName || null,
          quantity,
          total_price: totalPrice,
          status: "CONFIRMED",
        });

        if (purchaseErr) {
          console.error(purchaseErr);
          return "Gagal mencatat pembelian.";
        }

        const { error: updateStockErr } = await supabase
          .from("product_stock")
          .update({ quantity: stockData.quantity - quantity })
          .eq("id", stockData.id);

        if (updateStockErr) {
          console.error(updateStockErr);
          return "Pembelian tercatat, tetapi stok gagal diupdate. Harap cek manual.";
        }

        return `Pembelian ${quantity}x "${
          product.name
        }" berhasil dicatat dengan total Rp ${totalPrice.toLocaleString(
          "id-ID"
        )}.`;
      }

      case "read": {
        let { id } = params;
        if (typeof id === "string") id = Number(id);

        let q = supabase
          .from("purchases")
          .select(
            "id, product_id, buyer_name, quantity, total_price, status, created_at"
          )
          .order("id", { ascending: false }) as any;

        if (id) {
          q = q.eq("id", id);
        } else {
          q = q.limit(20);
        }

        const { data, error } = await q;

        if (error) {
          console.error(error);
          return "Gagal mengambil data pembelian.";
        }
        if (!data || data.length === 0) {
          return "Belum ada data pembelian yang sesuai.";
        }

        const lines = data.map((p: any) => {
          return `#${p.id} produk_id=${p.product_id}, qty=${
            p.quantity
          }, total=Rp ${Number(p.total_price).toLocaleString(
            "id-ID"
          )}, status=${p.status}, pembeli=${p.buyer_name || "-"} `;
        });

        return "Berikut data pembelian:\n" + lines.join("\n");
      }

      case "update": {
        // Admin & staff boleh UPDATE/CANCEL
        const updPermErr = await requirePurchaseUpdater();
        if (updPermErr) return updPermErr;

        let { id, newStatus } = params;
        if (typeof id === "string") id = Number(id);
        if (!id) return "ID pembelian yang akan diupdate belum disebutkan.";

        const { data: purchase, error } = await supabase
          .from("purchases")
          .select("id, product_id, quantity, status")
          .eq("id", id)
          .maybeSingle();

        if (error || !purchase) {
          console.error(error);
          return "Data pembelian tidak ditemukan.";
        }

        if (!newStatus) {
          return "Status baru belum disebutkan. Gunakan CONFIRMED atau CANCELLED.";
        }

        const status = String(newStatus).toUpperCase();
        if (status !== "CONFIRMED" && status !== "CANCELLED") {
          return "Status baru tidak valid. Gunakan CONFIRMED atau CANCELLED.";
        }

        if (purchase.status === status) {
          return `Status pembelian #${purchase.id} sudah ${status}.`;
        }

        const { error: updErr } = await supabase
          .from("purchases")
          .update({
            status,
            cancelled_at:
              status === "CANCELLED" ? new Date().toISOString() : null,
            cancelled_by: status === "CANCELLED" ? user.id : null,
          })
          .eq("id", purchase.id);

        if (updErr) {
          console.error(updErr);
          return "Gagal mengupdate status pembelian.";
        }

        if (status === "CANCELLED" && purchase.status === "CONFIRMED") {
          const { data: stockData, error: stockErr } = await supabase
            .from("product_stock")
            .select("id, quantity")
            .eq("product_id", purchase.product_id)
            .maybeSingle();

          if (!stockErr && stockData) {
            await supabase
              .from("product_stock")
              .update({ quantity: stockData.quantity + purchase.quantity })
              .eq("id", stockData.id);
          }
        }

        return `Status pembelian #${purchase.id} berhasil diubah menjadi ${status}.`;
      }

      case "delete": {
        // Hanya admin yang boleh delete pembelian
        const adminErr = await requireAdmin();
        if (adminErr) return adminErr;

        let { id } = params;
        if (typeof id === "string") id = Number(id);
        if (!id) return "ID pembelian yang akan dihapus belum disebutkan.";

        const { error } = await supabase
          .from("purchases")
          .delete()
          .eq("id", id);
        if (error) {
          console.error(error);
          return "Gagal menghapus pembelian dari database.";
        }

        return `Pembelian #${id} berhasil dihapus dari database.`;
      }

      default:
        return "Operasi CRUD pembelian tidak dikenali.";
    }
  }

  return "Entity CRUD tidak dikenali oleh server.";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages as { role: string; content: string }[];
    const user = (body.user ?? null) as AppUser | null;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Format body salah, "messages" harus array.' },
        { status: 400 }
      );
    }

    const plan = await callOpenAIForPlan(messages, user);
    let finalReply = plan.reply?.trim() || "";

    if (plan.action) {
      const actionResult = await handleCRUD(plan.action, user);
      if (actionResult) {
        finalReply = finalReply
          ? `${finalReply}\n\n${actionResult}`
          : actionResult;
      }
    }

    if (!finalReply) {
      finalReply = "Perintah diterima, namun tidak ada yang perlu dilakukan.";
    }

    return NextResponse.json({ reply: finalReply });
  } catch (error) {
    console.error("Error di handler /api/chat:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server", detail },
      { status: 500 }
    );
  }
}
