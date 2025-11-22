// components/ChatBot.tsx
"use client";

import {
  useEffect,
  useState,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useAuth } from "@/components/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Bot,
  MessageCircle,
  Loader2,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "admin-chatbot-messages-v1";

const getInitialMessages = (): ChatMessage[] => [
  {
    role: "assistant",
    content:
      "Halo, saya asisten AI Toko anda. Tulis saja perintah seperti yang anda inginkan.",
  },
];

export default function Chatbot() {
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [open, setOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load history dari localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        } else {
          setMessages(getInitialMessages());
        }
      } else {
        setMessages(getInitialMessages());
      }
    } catch {
      setMessages(getInitialMessages());
    } finally {
      setInitialized(true);
    }
  }, []);

  // Simpan history ke localStorage
  useEffect(() => {
    if (!initialized) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, initialized]);

  // Auto scroll ke bawah saat ada pesan baru / dialog dibuka
  useEffect(() => {
    if (!open) return;
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, open]);

  const handleSend = async () => {
    if (!input.trim() || !initialized) return;

    const text = input.trim();
    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    if (!user) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Kamu belum login, jadi aku belum bisa menjalankan aksi CRUD. Silakan login dulu sebagai admin atau staff.",
        },
      ]);
      setLoading(false);
      return;
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          user: safeUser,
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.reply as string },
        ]);
      } else if (data.error) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: `Maaf, terjadi kesalahan di server: ${data.error}`,
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "Maaf, aku gagal terhubung ke server. Coba cek koneksi atau refresh halaman, ya.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleReset = () => {
    const initial = getInitialMessages();
    setMessages(initial);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      } catch {
        // ignore
      }
    }
  };

  const quickPrompts: { label: string; text: string }[] = [
    {
      label: "Tambah produk",
      text: "Tambah produk baru kursi gaming hitam kategori Kursi harga 1.500.000 stok awal 5.",
    },
    {
      label: "Catat pembelian",
      text: "Catat pembelian 2 kursi kantor putar atas nama Budi.",
    },
    {
      label: "Kosongkan stok",
      text: "Kosongkan stok semua produk.",
    },
  ];

  const handleUsePrompt = (text: string) => {
    setInput(text);
    setOpen(true);
  };

  const roleLabel =
    user?.role === "admin"
      ? "Admin"
      : user?.role === "staff"
      ? "Staff"
      : "Guest";

  return (
    <>
      {/* Dialog besar ala ChatGPT */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="
            max-w-5xl
            w-[96vw]
            h-[90vh]
            p-0
            flex flex-col
            border-border
            bg-background/95
            backdrop-blur
            [&>button]:hidden
          "
        >
          {/* Header */}
          <DialogHeader className="border-b border-border/70 px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <DialogTitle className="text-sm font-semibold">
                    AI Assistant
                  </DialogTitle>
                  <DialogDescription className="text-[11px] text-muted-foreground">
                    Bantu CRUD produk, stok, dan pembelian dengan perintah
                    natural.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 text-[11px] text-muted-foreground">
                <div className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/70 px-2 py-0.5">
                  <UserCircle2 className="h-3 w-3" />
                  <span className="max-w-[140px] truncate">
                    {user?.full_name ?? "Belum login"}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-border" />
                  <span className="uppercase tracking-wide">{roleLabel}</span>
                </div>
                <div className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Online</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Body utama */}
          <div className="flex-1 flex flex-col gap-4 px-6 py-4 overflow-hidden">
            {/* Chat area scrollable */}
            <div className="flex-1 min-h-0">
              <ScrollArea className="h-full rounded-2xl border border-border bg-muted/40 px-4 py-4">
                <div className="space-y-3 text-xs">
                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-right shadow-sm"
                            : "max-w-[80%] rounded-2xl bg-card px-3 py-2 text-left text-foreground border border-border/70 shadow-sm"
                        }
                      >
                        <div className="mb-0.5 text-[10px] font-semibold opacity-70">
                          {m.role === "user" ? "Kamu" : "Bot"}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </div>
                      </div>
                    </div>
                  ))}

                  {initialized && messages.length === 0 && !loading && (
                    <p className="text-[11px] text-muted-foreground">
                      Mulai dengan salah satu pintasan di bawah, atau ketik
                      perintahmu sendiri.
                    </p>
                  )}

                  {loading && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Bot lagi mikir & cek database...
                    </p>
                  )}

                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Pintasan:
              </span>
              {quickPrompts.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleUsePrompt(p.text)}
                  className="rounded-full border border-border/80 bg-background px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input bar */}
            <div className="border border-border rounded-2xl bg-card/90 px-3 py-2 flex items-end gap-3">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tulis perintahmu di sini, contoh: kosongkan stok semua produk."
                className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs resize-none"
              />
              <div className="flex flex-col items-end gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading}
                  className="h-8 px-4 text-[11px]"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Kirim
                    </span>
                  ) : (
                    "Kirim"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={handleReset}
                  disabled={loading || !initialized}
                  className="h-7 px-2 text-[10px] text-muted-foreground"
                >
                  Reset chat
                </Button>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Enter = kirim · Shift+Enter = baris baru · Aksi CRUD mengikuti
              role login (admin / staff).
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tombol floating di pojok kanan bawah */}
      <Button
        type="button"
        size="icon"
        className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-xl border border-border bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
        <span className="sr-only">Buka chat AI</span>
      </Button>
    </>
  );
}
