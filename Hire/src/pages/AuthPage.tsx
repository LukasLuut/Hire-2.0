import { motion, AnimatePresence } from "framer-motion";
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




/** embedded: dentro da página de apresentação (não redireciona quem já está logado) */
export default function AuthPage({ embedded = false }: { embedded?: boolean }) {
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



  return (
    <div
      className="min-h-screen flex  items-center bg-[linear-gradient(135deg,_#000_0%,_#000_50%,_#000_75%,_var(--primary)_100%)] justify-center lg:justify-around gap-10 px-4 sm:px-8 lg:px-20 xl:px-40 pt-20 pb-10"
    >
      <img src={hirePng} width={480} height={679} className="hidden lg:block max-w-120 h-auto" alt="logo hire" />
      <div
        className={`relative w-full max-w-md ${isLogin ? "h-[620px] md:h-[590px]" : "h-[680px] md:h-[660px]"} rounded-3xl overflow-hidden shadow-[0_0_40px_10px_var(--primary)]`}
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* overlay */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundColor: "color-mix(in oklch, var(--bg-dark), transparent 90%)",

          }}
        />

        {/* botões slider */}
        <div
          className="absolute top-6 left-1/2 -translate-x-1/2 flex rounded-full p-1 backdrop-blur-md border shadow-lg z-20 w-[80%] max-w-[260px]"
          style={{
            backgroundColor: "color-mix(in oklch, var(--bg-light), transparent 30%)",
            borderColor: "var(--border-muted)",
          }}
        >
          <div className="relative flex w-full">
            {/* Bolha deslizante animada */}
            <motion.div
              layout
              animate={{ x: isLogin ? 0 : "100%" }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 22,
              }}
              className="absolute left-0 top-0 w-1/2 h-full rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <button
              onClick={() => setIsLogin(true)}
              className="relative z-10 w-1/2 py-2 text-sm font-medium transition-colors"
              style={{
                color: isLogin ? "var(--text)" : "var(--text-muted)",
              }}
            >
              Log In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className="relative z-10 w-1/2 py-2 text-sm font-medium transition-colors"
              style={{
                color: !isLogin ? "var(--text)" : "var(--text-muted)",
              }}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* container de formulários */}
        {/* rola quando o cadastro (empresa) fica mais alto que o cartão */}
        <div className="absolute inset-x-0 top-15 bottom-0 overflow-y-auto flex flex-col items-center p-6 md:p-8 z-10">
          <div className="my-auto w-full">
          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{
                  duration: 0.6,
                  type: "spring",
                  stiffness: 120,
                  damping: 18,
                }}
                className="w-full rounded-2xl p-6 md:p-8 bg-[var(--bg-dark)]/50 backdrop-blur-sm shadow-lg border-b-1 border-[var(--border)]"

              >
                <h2
                  className="text-2xl text-[var(--text)] md:text-3xl font-semibold mb-6 text-center"

                >
                  Bem-vindo de volta
                </h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <input
                    type="email"
                    placeholder="Email"
                    name="email"
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    required
                    onChange={handleChangeLogin}
                    value={formLoginData.email}
                  />
                  <input
                    type="password"
                    placeholder="Senha"
                    name="password"
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChangeLogin}
                    value={formLoginData.password}
                  />
                  <button
                    type="submit"
                    className="w-full py-3 text-[var(--text)] rounded-lg border-b-1 border-[var(--primary)] transparent-50% bg-[var(--primary)] font-semibold transition text-sm md:text-base"
                  >
                    Entrar
                  </button>
                  <Link to="/esqueci-senha" className="block text-center text-sm text-[var(--text-muted)] hover:text-[var(--primary)]">
                    Esqueci minha senha
                  </Link>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{
                  duration: 0.6,
                  type: "spring",
                  stiffness: 120,
                  damping: 18,
                }}
                className="w-full rounded-2xl border-b-1  border-[var(--border)] p-6 md:p-8 backdrop-blur-md shadow-lg"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--bg-dark), transparent 50%)",

                }}
              >
                <h2
                  className="text-2xl md:text-3xl font-semibold mb-6 text-center text-[var(--text)]"

                >
                  Crie sua conta
                </h2>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div role="radiogroup" aria-label="Como você vai usar o Hire" className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-[var(--border)]">
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
                        className={`py-2 px-1 rounded-lg text-xs md:text-sm transition ${accountType === id ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {accountType !== "cliente" && (
                    <p className="text-xs text-[var(--text-muted)]">
                      {isCompany
                        ? "Para pequenas empresas (MEI, ME ou EPP). Depois de entrar, você completa o perfil da empresa e publica os serviços."
                        : "Depois de entrar, você completa o perfil profissional e publica seus serviços. Você também pode contratar com a mesma conta."}
                    </p>
                  )}
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder={isCompany ? "Nome do responsável" : "Nome completo"}
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChange}
                    value={formData.name}
                  />
                  <input
                    type="text"
                    name="cpf"
                    required
                    placeholder={isCompany ? "CNPJ" : "CPF"}
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChangeCPF}
                    value={formatCPF(formData.cpf)}
                    inputMode="numeric"
                    pattern={isCompany ? "\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2}" : "\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}"}
                    maxLength={isCompany ? 18 : 14}
                    aria-label={isCompany ? "CNPJ" : "CPF"}
                  />
                  {isCompany && (
                    <>
                      <input
                        type="text"
                        required
                        placeholder="Razão social"
                        aria-label="Razão social"
                        maxLength={150}
                        className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                        value={company.legalName}
                        onChange={(e) => setCompany({ ...company, legalName: e.target.value })}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Nome fantasia (como os clientes veem)"
                        aria-label="Nome fantasia"
                        maxLength={100}
                        className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                        value={company.tradeName}
                        onChange={(e) => setCompany({ ...company, tradeName: e.target.value })}
                      />
                      <select
                        required
                        aria-label="Porte da empresa"
                        className="w-full p-3 rounded-lg focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] bg-[var(--bg-dark)] border-b-1 border-[var(--border)]"
                        value={company.companySize}
                        onChange={(e) => setCompany({ ...company, companySize: e.target.value })}
                      >
                        <option value="" disabled>Porte da empresa</option>
                        <option value="MEI">MEI — Microempreendedor individual</option>
                        <option value="ME">ME — Microempresa</option>
                        <option value="EPP">EPP — Empresa de pequeno porte</option>
                      </select>
                    </>
                  )}
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="Email"
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChange}
                    value={formData.email}
                  />
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="Senha"
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChange}
                    value={formData.password}
                  />
                  <label className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
                    <input
                      type="checkbox"
                      name="acceptedTerms"
                      checked={formData.acceptedTerms}
                      onChange={(e) =>
                        setFormData({ ...formData, acceptedTerms: e.target.checked })
                      }
                      
                      className="mt-1 accent-[var(--primary)]"
                    />
                    <span>
                      Li e concordo com a{" "}
                      <button
                      type="button"
                      onClick={() => setIsPrivacyOpen(true)}
                      className="text-[var(--primary)] hover:underline"
                      >
                        Política de Privacidade e Termos de Uso
                      </button>.
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-lg font-semibold transition text-sm md:text-base"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--text)",
                    }}
                  >
                    Registrar
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>

        {/* Efeitos orgânicos de luz */}

      </div>
      {isPrivacyOpen && (
                <UseTerms setIsPrivacyOpen={setIsPrivacyOpen}/>  
              )}
    </div>
  );
}
