import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { toFriendlyMessage } from "@/lib/api-error";

export const Route = createFileRoute("/admin/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signIn, token, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRedirectTarget = (): string => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const raw = sp.get("redirect");
      if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    } catch {
      /* ignore */
    }
    return "/admin/dashboard";
  };

  useEffect(() => {
    if (token && user && !authLoading) {
      navigate({ to: getRedirectTarget(), replace: true });
    }
  }, [authLoading, token, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      queryClient.clear();
      await router.invalidate();
    } catch (err) {
      setError(toFriendlyMessage(err, "Não foi possível entrar. Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#081F38] text-white">
      <picture className="absolute inset-0 block">
        <source
          media="(min-width: 1024px)"
          srcSet="/branding/login-hero-desktop.webp"
          type="image/webp"
        />
        <source
          media="(min-width: 1024px)"
          srcSet="/branding/login-hero-desktop.png"
          type="image/png"
        />
        <source srcSet="/branding/login-hero-mobile.webp" type="image/webp" />
        <img
          src="/branding/login-hero-mobile.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center lg:object-[68%_center]"
          draggable={false}
          fetchPriority="high"
        />
      </picture>

      <div className="absolute inset-0 bg-[#020817]/55 lg:bg-transparent" />
      <div className="absolute inset-x-0 top-0 h-[42vh] bg-[#020817]/88 lg:hidden" />
      <div className="absolute bottom-0 left-0 top-0 hidden w-[50%] bg-[#020817]/94 lg:block" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020817]/15 via-[#020817]/35 to-[#020817]/90 lg:bg-gradient-to-r lg:from-[#020817]/95 lg:via-[#020817]/80 lg:to-[#020817]/5" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] items-center px-5 py-8 lg:px-12 xl:px-20">
        <section className="flex w-full justify-center lg:w-[44%] lg:justify-start">
          <div className="w-full max-w-[440px]">
            <div
              className="rounded-[24px] border border-white/[0.08] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-[22px] sm:p-10"
              style={{ background: "rgba(8,12,25,0.72)" }}
            >
              <div className="mb-7 flex flex-col items-center text-center">
                <img
                  src="/branding/icon-1024.png"
                  alt="Defumar"
                  className="mb-5 h-16 w-16 select-none rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.35)]"
                  draggable={false}
                />
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Bem-vindo de volta
                </h2>
                <p className="mt-1.5 text-sm text-white/55">
                  Acesse sua conta administrativa
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-white/70">
                    E-mail
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@empresa.com"
                      className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/30 focus-visible:border-[#3B82F6]/60 focus-visible:ring-[#3B82F6]/30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium text-white/70">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-12 rounded-xl border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-white/30 focus-visible:border-[#3B82F6]/60 focus-visible:ring-[#3B82F6]/30"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-white/65">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(Boolean(v))}
                      className="border-white/25 data-[state=checked]:border-[#2563EB] data-[state=checked]:bg-[#2563EB]"
                    />
                    Lembrar de mim
                  </label>
                  <Link
                    to="/admin/login"
                    className="text-sm text-[#60A5FA] transition-colors hover:text-[#93C5FD]"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>

                {error && (
                  <div className="flex animate-in items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200 fade-in slide-in-from-top-1">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="group relative h-14 w-full overflow-hidden rounded-[14px] border-0 bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-base font-medium text-white shadow-[0_10px_40px_rgba(37,99,235,0.4)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_15px_50px_rgba(37,99,235,0.6)] active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-white/40">
              Sistema de autoatendimento e gestão
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
