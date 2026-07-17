import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Lock, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { toFriendlyMessage } from "@/lib/api-error";
import bgAsset from "@/assets/login-bg.svg";
import ecosystemAsset from "@/assets/eventtech-ecosystem.svg";
import logoAsset from "@/assets/defumar-logo-horizontal.svg";
import dHoloAsset from "@/assets/defumar-d-holographic.svg";



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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05080F] text-white">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgAsset})` }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/45" />
      {/* Radial blue glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-[#2563EB]/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full bg-[#4F46E5]/20 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-[#3B82F6]/10 blur-[100px]" />

      {/* Holographic D — giant background watermark */}
      <img
        src={dHoloAsset}
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute -right-[12%] top-1/2 -translate-y-1/2 w-[min(900px,75vw)] opacity-[0.06] mix-blend-screen"
        draggable={false}
      />


      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px] flex-col lg:flex-row">
        {/* LEFT 55% */}
        <section className="hidden lg:flex lg:w-[55%] flex-col justify-center px-12 xl:px-20 py-12">
          <div className="flex items-center">
            <img
              src={logoAsset}
              alt="Defumar Events Platform"
              className="h-14 xl:h-16 w-auto select-none drop-shadow-[0_8px_30px_rgba(37,99,235,0.35)]"
              draggable={false}
            />
          </div>


          <h1 className="mt-10 text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight text-white">
            Tecnologia que <br />
            <span className="bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#818CF8] bg-clip-text text-transparent">
              impulsiona eventos.
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base xl:text-lg leading-relaxed text-white/65">
            Plataforma completa para autoatendimento, pagamentos, NFC, impressão
            inteligente e gestão operacional em tempo real.
          </p>

          {/* Ecosystem image — centerpiece */}
          <div className="relative mt-10 flex items-center justify-center">
            <div className="pointer-events-none absolute inset-0 -z-10 mx-auto h-[420px] w-[420px] translate-y-6 rounded-full bg-[#2563EB]/25 blur-[100px]" />
            <img
              src={ecosystemAsset}
              alt="Ecossistema EventTech Defumar"
              className="h-auto w-full max-w-[560px] animate-[float_6s_ease-in-out_infinite] drop-shadow-[0_25px_60px_rgba(37,99,235,0.35)]"
            />
          </div>
        </section>

        {/* RIGHT 45% */}
        <section className="flex flex-1 lg:w-[45%] items-center justify-center px-5 py-10 lg:px-12">
          <div className="w-full max-w-[440px]">
            {/* Mobile brand */}
            <div className="mb-8 flex items-center justify-center lg:hidden">
              <img
                src={logoAsset}
                alt="Defumar Events Platform"
                className="h-10 w-auto select-none"
                draggable={false}
              />
            </div>


            <div
              className="rounded-[24px] border border-white/[0.08] p-8 sm:p-10 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-[20px]"
              style={{ background: "rgba(8,12,25,0.65)" }}
            >
              <div className="mb-7 flex flex-col items-center text-center">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#4F46E5] shadow-[0_10px_40px_rgba(37,99,235,0.5)]">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
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
                  <label className="flex items-center gap-2 text-sm text-white/65 cursor-pointer select-none">
                    <Checkbox
                      checked={remember}
                      onCheckedChange={(v) => setRemember(Boolean(v))}
                      className="border-white/25 data-[state=checked]:bg-[#2563EB] data-[state=checked]:border-[#2563EB]"
                    />
                    Lembrar de mim
                  </label>
                  <Link
                    to="/admin/login"
                    className="text-sm text-[#60A5FA] hover:text-[#93C5FD] transition-colors"
                  >
                    Esqueceu sua senha?
                  </Link>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200 animate-in fade-in slide-in-from-top-1">
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
              Defumar Events Platform · Sistema de autoatendimento e gestão
            </p>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
