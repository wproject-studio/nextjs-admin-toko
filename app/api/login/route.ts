// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 }
      );
    }

    // DEMO ONLY: masih pakai plain password. Production wajib pakai hash.
    const { data, error } = await supabase
      .from("users")
      // kita TIDAK select kolom password di sini
      .select("id, email, full_name, role")
      .eq("email", email)
      .eq("password", password)
      .maybeSingle();

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Terjadi kesalahan database" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Email / password salah" },
        { status: 401 }
      );
    }

    // `data` sudah tidak mengandung password, jadi bisa langsung dikirim
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
