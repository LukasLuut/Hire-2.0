import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import bgImage from "../assets/bg-login.webp";
import hirePng from "../assets/hire-logo.webp";
import { userAPI, type UserAPI, type UserLoginAPI } from "../api/UserAPI";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import UseTerms from "../components/Terms/UseTerms";
import { useToast } from "../components/Toast/ToastContext"
import { useSession } from "../context/SessionContext";




/** embedded: dentro da página de apresentação (não redireciona quem já está logado) */
export default function AuthPage({ embedded = false }: { embedded?: boolean }) {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    email: "",
    password: "",
    acceptedTerms: false
  });
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
  useEffect(() => {
    if (token && !embedded) navigate(next, { replace: true });
  }, [token, navigate, embedded, next])

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
        login(body.token);
        showToast("Login realizado com sucesso!", "success")
        navigate(next);

      } else {

        if (!formData.acceptedTerms) {
          showToast("Você precisa aceitar os termos antes de continuar.", "warning");
          return;
        }

        await handleRegistrar(formData);
         showToast("Conta criada! Enviamos um link para confirmar seu e-mail. Agora é só entrar.", "success");
        setIsLogin(true);
        cleanForm();

      }
    } catch (error: any) {
      console.error(isLogin ? "Usuário não encontrado: " : "Erro ao registrar usuário:", error);
      isLogin ? showToast('E-mail e/ou senha informado é inválido', 'error') : showToast(error.message || "Erro na requisição!","error");
    }
  };

  const handleRegistrar = async (data: UserAPI) => {
    return await userAPI.create({
      name: data.name,
      email: data.email,
      cpf: data.cpf,
      password: data.password,
      acceptedTerms: data.acceptedTerms
    })
  }

  const handleLogin = async (data: UserLoginAPI) => {
    return await userAPI.login({
      email: data.email,
      password: data.password
    })
  }

  const formatCPF = (value: string) => {
  // Remove tudo que não é número e adiciona máscara
    const onlyNums = value.replace(/\D/g, "");
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
        className="relative w-full max-w-md h-[620px] md:h-[590px] rounded-3xl overflow-hidden shadow-[0_0_40px_10px_var(--primary)]"
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
        <div className="absolute inset-0 mt-15 flex items-center justify-center p-6 md:p-8 z-10">
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
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Nome completo"
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChange}
                    value={formData.name}
                  />
                  <input
                    type="text"
                    name="cpf"
                    required
                    placeholder="CPF"
                    className="w-full p-3 rounded-lg placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm md:text-base text-[var(--text)] border-b-1 border-[var(--border)]"
                    onChange={handleChangeCPF}
                    value={formatCPF(formData.cpf)}
                    inputMode="numeric"
                    pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
                    maxLength={14}
                  />
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

        {/* Efeitos orgânicos de luz */}

      </div>
      {isPrivacyOpen && (
                <UseTerms setIsPrivacyOpen={setIsPrivacyOpen}/>  
              )}
    </div>
  );
}
