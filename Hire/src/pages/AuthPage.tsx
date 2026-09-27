import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { clearPendingInvite, pendingInvite } from "../api/InviteAPI";
import { useEffect, useState } from "react";
import bgImage from "../assets/bg-login.webp";
import hirePng from "../assets/hire-logo.webp";
import { userAPI, type AccountType, type UserAPI, type UserLoginAPI } from "../api/UserAPI";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import UseTerms from "../components/Terms/UseTerms";
import { useToast } from "../components/Toast/ToastContext"
import { useSession } from "../context/SessionContext";
import { getErrorMessage } from "../utils/errors";




/** Página /auth: arte do Hire ao lado do cartão de entrar/cadastrar */
export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center bg-[linear-gradient(135deg,_#000_0%,_#000_50%,_#000_75%,_var(--primary)_100%)] justify-center lg:justify-around gap-10 px-4 sm:px-8 lg:px-20 xl:px-40 pt-24 pb-10">
      <img src={hirePng} width={480} height={679} className="hidden lg:block max-w-120 h-auto" alt="logo hire" />
      <AuthCard />
    </div>
  );
}

/** Pedido externo para o cartão (ex.: "Cadastrar como profissional" na página inicial) */
export type AuthCardRequest = { signup: boolean; tipo?: AccountType; nonce: number };

/**
 * Cartão de entrar/cadastrar (usado em /auth e no topo da página inicial).
 * embedded: dentro de outra página (não redireciona quem já está logado).
 */
export function AuthCard({ embedded = false, request, id }: { embedded?: boolean; request?: AuthCardRequest | null; id?: string }) {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(() => new URLSearchParams(window.location.search).get("cadastro") !== "1");
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    email: "",
    password: "",
    acceptedTerms: false
  });
  // Quero contratar / Sou profissional / Sou empresa (?tipo=profissional|empresa já chega escolhido)
  const [accountType, setAccountType] = useState<AccountType>(() => {
    const tipo = new URLSearchParams(window.location.search).get("tipo");
    return tipo === "profissional" || tipo === "empresa" ? tipo : "cliente";
  });
  const [company, setCompany] = useState({ legalName: "", tradeName: "", companySize: "" });
  const isCompany = accountType === "empresa";
  const [formLoginData, setFormLoginData] = useState({ 
    email: "",
    password: "",
  });
  const navigate = useNavigate()
  const { showToast } = useToast();
  // pedido de fora (botões da página inicial): abre a aba e o tipo de conta certos
  useEffect(() => {
    if (!request) return;
    setIsLogin(!request.signup);
    if (request.tipo) setAccountType(request.tipo);
  }, [request]);
  const { token, login } = useSession();
  // Para onde voltar depois de entrar (só caminhos internos, ex.: /service/12)
  const [params] = useSearchParams();
  const nextParam = params.get("next") ?? "";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/home";
  

  // Quem já está logado vai direto para a página inicial
  // destino depois do login (profissional/empresa sem perfil vai para o cadastro profissional)
  const [afterLogin, setAfterLogin] = useState<string | null>(null);
  useEffect(() => {
    if (token && !embedded) navigate(afterLogin ?? next, { replace: true });
  }, [token, navigate, embedded, next, afterLogin])

  const cleanForm = () => {
    setFormData({
      name: "",
      cpf: "",
      email: "",
      password: "",
      acceptedTerms: false
    });

    setFormLoginData({
      "email": "",
      "password": ""
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleChangeLogin = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormLoginData({ ...formLoginData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // evita reload da página

    try {
      // Chama a função que faz o registro
      if (isLogin) {
        const body: any = await handleLogin(formLoginData);
        // quem se cadastrou como profissional/empresa segue para o perfil profissional (se ainda não tiver)
        const pro = body.user?.accountType === "profissional" || body.user?.accountType === "empresa";
        const target = pro && !nextParam ? "/home?prestador=1" : next;
        setAfterLogin(target);
        login(body.token);
        showToast("Login realizado com sucesso!", "success")
        navigate(target);

      } else {

        if (!formData.acceptedTerms) {
          showToast("Você precisa aceitar os termos antes de continuar.", "warning");
          return;
        }

        await handleRegistrar(formData);
        clearPendingInvite();
         showToast("Conta criada! Enviamos um link para confirmar seu e-mail. Agora é só entrar.", "success");
        setIsLogin(true);
        cleanForm();

      }
    } catch (error) {
      // o servidor já responde sem revelar se o e-mail existe (e avisa trava por tentativas / conta suspensa)
      showToast(getErrorMessage(error, isLogin ? "E-mail ou senha incorretos" : "Erro na requisição!"), "error");
    }
  };

  const handleRegistrar = async (data: UserAPI) => {
    return await userAPI.create({
      name: data.name,
      email: data.email,
      cpf: data.cpf,
      password: data.password,
      acceptedTerms: data.acceptedTerms,
      invite: pendingInvite(),
      accountType,
      ...(isCompany ? company : {}),
    })
  }

  const handleLogin = async (data: UserLoginAPI) => {
    return await userAPI.login({
      email: data.email,
      password: data.password
    })
  }

  const formatCPF = (value: string) => {
  // Remove tudo que não é número e adiciona máscara (CNPJ para empresa)
    const onlyNums = value.replace(/\D/g, "");
    if (isCompany) return onlyNums
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
    return onlyNums
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

// Atualiza e formata o CPF no estado
  const handleChangeCPF = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setFormData((prev) => ({ ...prev, cpf: formatted }));
  };



  // campo do formulário: caixa com borda própria (não encosta nem sai do cartão)
  const field =
    "w-full h-12 px-4 rounded-xl text-sm md:text-base text-[var(--text)] placeholder:text-[var(--text-muted)] border border-[var(--border-muted)] bg-[color-mix(in_oklch,var(--bg-dark)_55%,transparent)] outline-none transition-colors duration-150 focus:border-[var(--primary)]";
  const ease = [0.22, 1, 0.36, 1] as const;
  // troca de aba: o formulário novo entra pelo lado da aba escolhida
  const slide = {
    enter: (toSignup: boolean) => ({ opacity: 0, x: toSignup ? 28 : -28 }),
    center: { opacity: 1, x: 0 },
    exit: (toSignup: boolean) => ({ opacity: 0, x: toSignup ? -28 : 28 }),
  };
  const toSignup = !isLogin;

  return (
    <>
      <MotionConfig reducedMotion="user">
        {/* o cartão acompanha a altura do formulário (anima ao crescer/encolher), sem rolagem interna */}
        <motion.div
          id={id}
          layout
          transition={{ layout: { duration: 0.32, ease } }}
          className="relative w-full max-w-[460px] sm:max-w-[540px] rounded-3xl overflow-hidden shadow-[0_0_40px_10px_var(--primary)]"
          style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 z-0" style={{ backgroundColor: "color-mix(in oklch, var(--bg-dark), transparent 90%)" }} />

          <div className="relative z-10 p-5 sm:p-7">
            {/* seletor Log In / Sign Up: a bolha desliza entre as abas */}
            <motion.div
              layout="position"
              role="tablist"
              aria-label="Entrar ou criar conta"
              className="mx-auto flex w-full max-w-[280px] rounded-full p-1 backdrop-blur-md border shadow-lg"
              style={{ backgroundColor: "color-mix(in oklch, var(--bg-light), transparent 30%)", borderColor: "var(--border-muted)" }}
            >
              {([
                [true, "Log In"],
                [false, "Sign Up"],
              ] as const).map(([login, label]) => {
                const active = isLogin === login;
                return (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setIsLogin(login)}
                    className={`relative flex-1 h-10 rounded-full text-sm font-medium transition-colors duration-200 ${active ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="auth-tab-pill"
                        data-auth-pill
                        className="absolute inset-0 rounded-full bg-[var(--primary)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative">{label}</span>
                  </button>
                );
              })}
            </motion.div>

            <AnimatePresence mode="popLayout" initial={false} custom={toSignup}>
              {isLogin ? (
                <motion.div
                  key="login"
                  custom={toSignup}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease }}
                  className="mt-6 w-full rounded-2xl p-5 sm:p-7 bg-[var(--bg-dark)]/50 backdrop-blur-sm shadow-lg border border-[var(--border-muted)]"
                >
                  <h2 className="text-2xl text-[var(--text)] md:text-3xl font-semibold mb-6 text-center">Bem-vindo de volta</h2>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <input type="email" placeholder="Email" aria-label="Email" name="email" autoComplete="email" className={field} required onChange={handleChangeLogin} value={formLoginData.email} />
                    <input type="password" placeholder="Senha" aria-label="Senha" name="password" autoComplete="current-password" className={field} onChange={handleChangeLogin} value={formLoginData.password} />
                    <button type="submit" className="w-full h-12 text-white rounded-xl bg-[var(--primary)] font-semibold transition hover:brightness-110 active:scale-[0.99] text-sm md:text-base">
                      Entrar
                    </button>
                    <Link to="/esqueci-senha" className="block text-center text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
                      Esqueci minha senha
                    </Link>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  custom={toSignup}
                  variants={slide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease }}
                  className="mt-6 w-full rounded-2xl border border-[var(--border-muted)] p-5 sm:p-7 backdrop-blur-md shadow-lg"
                  style={{ backgroundColor: "color-mix(in oklch, var(--bg-dark), transparent 50%)" }}
                >
                  <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center text-[var(--text)]">Crie sua conta</h2>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div role="radiogroup" aria-label="Como você vai usar o Hire" className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-[var(--border-muted)]">
                      {([
                        ["cliente", "Quero contratar"],
                        ["profissional", "Sou profissional"],
                        ["empresa", "Sou empresa"],
                      ] as [AccountType, string][]).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={accountType === id}
                          onClick={() => { setAccountType(id); setFormData((f) => ({ ...f, cpf: "" })); }}
                          className={`relative min-h-11 py-2 px-1 rounded-lg text-xs md:text-sm leading-tight transition-colors duration-200 ${accountType === id ? "text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                        >
                          {accountType === id && (
                            <motion.span layoutId="auth-type-pill" className="absolute inset-0 rounded-lg bg-[var(--primary)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                          )}
                          <span className="relative">{label}</span>
                        </button>
                      ))}
                    </div>

                    <AnimatePresence initial={false} mode="wait">
                      {accountType !== "cliente" && (
                        <motion.p
                          key={accountType}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease }}
                          className="text-xs text-[var(--text-muted)] overflow-hidden"
                        >
                          {isCompany
                            ? "Para pequenas empresas (MEI, ME ou EPP). Depois de entrar, você completa o perfil da empresa e publica os serviços."
                            : "Depois de entrar, você completa o perfil profissional e publica seus serviços. Você também pode contratar com a mesma conta."}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    <div className="grid sm:grid-cols-2 gap-4">
                    <input type="text" name="name" required autoComplete="name" placeholder={isCompany ? "Nome do responsável" : "Nome completo"} aria-label={isCompany ? "Nome do responsável" : "Nome completo"} className={field} onChange={handleChange} value={formData.name} />
                    <input
                      type="text"
                      name="cpf"
                      required
                      placeholder={isCompany ? "CNPJ" : "CPF"}
                      className={field}
                      onChange={handleChangeCPF}
                      value={formatCPF(formData.cpf)}
                      inputMode="numeric"
                      pattern={isCompany ? "\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}" : "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"}
                      maxLength={isCompany ? 18 : 14}
                      aria-label={isCompany ? "CNPJ" : "CPF"}
                    />
                    </div>

                    {/* dados da empresa entram e saem com o formulário crescendo junto */}
                    <AnimatePresence initial={false}>
                      {isCompany && (
                        <motion.div
                          key="company"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.28, ease }}
                          className="overflow-hidden"
                        >
                          <div className="grid sm:grid-cols-2 gap-4">
                            <input type="text" required placeholder="Razão social" aria-label="Razão social" maxLength={150} className={field} value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} />
                            <input type="text" required placeholder="Nome fantasia" title="Nome como os clientes veem a empresa" aria-label="Nome fantasia" maxLength={100} className={field} value={company.tradeName} onChange={(e) => setCompany({ ...company, tradeName: e.target.value })} />
                            <select required aria-label="Porte da empresa" className={`${field} bg-[var(--bg-dark)] sm:col-span-2`} value={company.companySize} onChange={(e) => setCompany({ ...company, companySize: e.target.value })}>
                              <option value="" disabled>Porte da empresa</option>
                              <option value="MEI">MEI — Microempreendedor individual</option>
                              <option value="ME">ME — Microempresa</option>
                              <option value="EPP">EPP — Empresa de pequeno porte</option>
                            </select>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <input type="email" name="email" required autoComplete="email" placeholder="Email" aria-label="Email" className={field} onChange={handleChange} value={formData.email} />
                      <input type="password" name="password" required autoComplete="new-password" placeholder="Senha" aria-label="Senha" className={field} onChange={handleChange} value={formData.password} />
                    </div>
                    <label className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        name="acceptedTerms"
                        checked={formData.acceptedTerms}
                        onChange={(e) => setFormData({ ...formData, acceptedTerms: e.target.checked })}
                        className="mt-1 accent-[var(--primary)]"
                      />
                      <span>
                        Li e concordo com a{" "}
                        <button type="button" onClick={() => setIsPrivacyOpen(true)} className="text-[var(--primary)] hover:underline">
                          Política de Privacidade e Termos de Uso
                        </button>.
                      </span>
                    </label>
                    <button type="submit" className="w-full h-12 rounded-xl font-semibold text-white bg-[var(--primary)] transition hover:brightness-110 active:scale-[0.99] text-sm md:text-base">
                      Registrar
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </MotionConfig>
      {isPrivacyOpen && <UseTerms setIsPrivacyOpen={setIsPrivacyOpen} />}
    </>
  );
}
