// ---------------------------------
// Container principal: gerencia estado, navegação e envio do cadastro de prestador.
// Serve para criar (formulário vazio, com nome e e-mail da conta) e para editar
// (formulário preenchido com os dados já salvos).

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { toFiles } from "../helpers/file-helpers";
import {
  type ProviderForm,
  type FileOrNull,
  type Availability,
  type DayKey,
} from "../helpers/types-and-helpers";

import StepIdentity from "../Etapa1/StepIdentity";
import StepProfessional from "../Etapa2/StepProfessional";
import StepAddress from "../Etapa3/StepAddress";
import StepDocuments from "../Etapa4/StepDocuments";
import StepPreferences from "../Etapa5/StepPreferences";
import ProfilePreview from "../ProfilePreview/ProfilePreview";
import { addressAPI } from "../../../../api/AddressAPI";
import type { Address } from "../../../../interfaces/AddressInterface";
import type { ProviderEntity } from "../../../../interfaces/Entities";
import { providerApi } from "../../../../api/ProviderAPI";
import { validateFormData } from "../../../../validate/validateFormData";
import { useToast } from "../../../Toast/ToastContext";
import { useSession } from "../../../../context/SessionContext";
import { uploadUrl } from "../../../../utils/avatar";
import { getErrorMessage } from "../../../../utils/errors";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Prestador já salvo (modo edição). Sem ele, o formulário cria um novo. */
  existing?: ProviderEntity | null;
  /** Chamado depois de salvar com sucesso */
  onDone?: () => void;
}

const DAYS: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function buildInitialForm(existing: ProviderEntity | null | undefined, user: { name?: string; email?: string } | null): ProviderForm {
  const availability = Object.fromEntries(DAYS.map((d) => [d, null])) as Availability;
  for (const a of existing?.availabilities ?? []) {
    if ((DAYS as string[]).includes(a.day)) availability[a.day as DayKey] = { start: a.start, end: a.end };
  }

  return {
  // Identidade
  // um nome só (etapa de identidade): como o cliente vê você — empresa ou nome profissional
  name: existing?.companyName || existing?.professionalName || user?.name || "",
  cnpj: existing?.cnpj ?? "",
  professionalEmail: existing?.professionalEmail ?? user?.email ?? "",
  professionalPhone: existing?.professionalPhone ?? "",
  shortDescription: existing?.description ?? "",
  profilePhoto: null,

  // Profissional
  companyName: existing?.companyName ?? "",
  category: existing?.category?.id ? String(existing.category.id) : "",
  subcategories: (existing?.subcategories ?? []).map((s) => s.name),
  experienceLevel: "",
  portfolio: [],
  inPerson: existing ? !!existing.attendsPresent : true,
  online: !!existing?.attendsOnline,
  onlineLink: existing?.onlineLink ?? "",

  availability,

  // Endereço
  hasPhysicalLocation: true,
  // na edição, a área de atendimento salva volta preenchida (cidade, UF e ponto no mapa)
  address: {
    cep: "",
    street: "",
    number: "",
    neighborhood: "",
    city: existing?.baseCity ?? "",
    state: existing?.baseState ?? "",
    ...(existing?.latitude != null && existing?.longitude != null ? { lat: existing.latitude, lng: existing.longitude } : {}),
  },
  serviceRadiusKm: existing?.serviceRadiusKm ?? 20,

  // Documentos
  idDocument: null,
  certifications: [],
  links: (existing?.links ?? []).map((l) => l.name),

  // Preferências
  acceptsCustomProposals: existing ? !!existing.personalizedProposals : true,
  notifications: { email: existing ? !!existing.emailNotification : true, whatsapp: !!existing?.whatsNotification },
  showApproxLocation: existing ? !!existing.approximateLocation : true,
  allowReviews: existing ? !!existing.publicReviews : true,
  showPrices: existing ? !!existing.pricesOnPage : true,
  showContact: existing ? !!existing.showContact : false,
  status: existing?.status === "paused" ? "paused" : "available",
  };
}

export default function ProviderRegistrationContainer({ isOpen, onClose, existing, onDone }: ModalProps) {
  const isEdit = !!existing;
  const { user, refresh } = useSession();
  const { showToast } = useToast();
  const [step, setStep] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const totalSteps = 5;

  const [form, setForm] = useState<ProviderForm>(() => buildInitialForm(existing, user));
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(
    uploadUrl(existing?.profileImageUrl)
  );

   // Fecha com ESC (exceto durante o envio)
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }

    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, saving]);

  if (!isOpen) return null;

  /* update */
  const update = <K extends keyof ProviderForm>(
    k: K,
    v: ProviderForm[K]
  ) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  /* file handlers */
  const handleProfileFile = (f: FileOrNull) => {
    update("profilePhoto", f);
    if (f) setProfilePreviewUrl(URL.createObjectURL(f));
  };

  const handleIdDocument = (f: File | null) => update("idDocument", f);
  const handleCompanyDocument = (f: File | null) => update("companyDocument", f);

  const handleCertifications = (files: FileList | File[] | null) => {
  if (!files) return;

  const normalized = Array.isArray(files)
    ? files
    : toFiles(files);

  update("certifications", [
    ...form.certifications,
    ...normalized,
  ]);
};

  const addSubcategory = (t: string) => {
    if (!t) return;
    if (form.subcategories.includes(t)) return;
    update("subcategories", [...form.subcategories, t]);
  };

  const removeSubcategory = (t: string) =>
    update("subcategories", form.subcategories.filter((s) => s !== t));

  // cidade/UF já vêm preenchidas na edição (área de atendimento); só conta como
  // "mexeu no endereço" quando a pessoa preenche CEP, rua, número ou bairro
  const addressTouched = () => {
    const a = form.address ?? {};
    return [a.cep, a.street, a.number, a.neighborhood].some((v) => typeof v === "string" && v.trim() !== "");
  };

  // Endereço obrigatório no cadastro; na edição só é validado se a pessoa preencher algo
  function validateAddress(): string | null {
    if (isEdit && !addressTouched()) return null;
    const a = form.address ?? {};
    if (!a.cep || a.cep.replace(/\D/g, "").length !== 8) return "Coloque um CEP válido";
    if (!a.street || a.street.trim() === "") return "Rua é obrigatório";
    if (!a.number || a.number.trim() === "") return "Número é obrigatório";
    if (!/^\d+$/.test(a.number.trim())) return "O número deve conter apenas dígitos";
    if (!a.neighborhood || a.neighborhood.trim() === "") return "Bairro é obrigatório";
    if (!a.city || a.city.trim() === "") return "Cidade é obrigatório";
    if (!a.state || a.state.trim() === "") return "Estado é obrigatório";
    return null;
  }

  const validateStep = (s: number) => validateFormData(form, s) ?? (s === 2 ? validateAddress() : null);

  /* navigation */
  const next = () => {
    const problem = validateStep(step);
    if (problem) {
      showToast(problem, "warning");
      return;
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1))
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  /* submit */
  const handleFinish = async () => {
    for (let s = 0; s < totalSteps; s++) {
      const problem = validateStep(s);
      if (problem) {
        setStep(s);
        showToast(problem, "warning");
        return;
      }
    }

    const token = localStorage.getItem("token");
    if(!token) return;

    const formData = new FormData();

    formData.append("companyName", form.name.trim());
    // nome da pessoa: só no cadastro (na edição fica o que já existe)
    if (!isEdit) formData.append("professionalName", user?.name || form.name.trim());
    formData.append("professionalEmail", form.professionalEmail);
    formData.append("professionalPhone", form.professionalPhone);
    formData.append("description", form.shortDescription);
    formData.append("cnpj", form.cnpj ? form.cnpj : "");
    formData.append("categoryId", form.category);
    formData.append("subcategories", JSON.stringify(form.subcategories));
    formData.append("attendsPresent", JSON.stringify(form.inPerson));
    formData.append("attendsOnline", JSON.stringify(form.online));
    formData.append("personalizedProposals", JSON.stringify(form.acceptsCustomProposals));
    formData.append("approximateLocation", JSON.stringify(form.showApproxLocation));
    formData.append("publicReviews", JSON.stringify(form.allowReviews));
    formData.append("pricesOnPage", JSON.stringify(form.showPrices));
    formData.append("showContact", JSON.stringify(form.showContact));
    formData.append("whatsNotification", JSON.stringify(form.notifications.whatsapp));
    formData.append("emailNotification", JSON.stringify(form.notifications.email));
    formData.append("status", form.status);
    formData.append("onlineLink", form.onlineLink);
    formData.append("links", JSON.stringify(form.links));
    formData.append("availabilities", JSON.stringify(form.availability));
    // área de atendimento (usada na busca por proximidade)
    if (form.address?.lat != null && form.address?.lng != null) {
      formData.append("latitude", String(form.address.lat));
      formData.append("longitude", String(form.address.lng));
    }
    if (form.address?.city) formData.append("baseCity", form.address.city);
    if (form.address?.state) formData.append("baseState", form.address.state);
    formData.append("serviceRadiusKm", String(form.serviceRadiusKm ?? 20));
    if (form.profilePhoto) formData.append("image", form.profilePhoto);

    setSaving(true);
    try {
      if (isEdit) await providerApi.update(formData, token);
      else await providerApi.create(formData, token);

      if (!isEdit || addressTouched()) {
        const address: Address = {
          id: 0,
          num: form.address?.number,
          street: form.address?.street,
          neighborhood: form.address?.neighborhood,
          city: form.address?.city,
          state: form.address?.state,
          country: "Brasil",
          postalCode: form.address?.cep
        }
        try {
          await addressAPI.create(address, token);
        } catch {
          showToast("Perfil salvo, mas não foi possível salvar o endereço.", "warning");
        }
      }

      // documentos para verificação vão para armazenamento privado e análise manual
      let docsSent = false;
      if (form.idDocument instanceof File) {
        try {
          await providerApi.submitVerification(form.idDocument, form.certifications, token, form.companyDocument instanceof File && form.cnpj ? form.companyDocument : null);
          docsSent = true;
        } catch (err) {
          showToast(getErrorMessage(err, "Perfil salvo, mas os documentos não foram enviados."), "warning");
        }
      }

      await refresh();
      showToast(
        (isEdit ? "Perfil de prestador atualizado!" : "Empresa cadastrada! Agora publique seu primeiro serviço.") + (docsSent ? " Documentos enviados para verificação." : ""),
        "success"
      );
      onDone?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível salvar o cadastro."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-auto bg-[var(--bg-dark)] text-[var(--text)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-extrabold">{isEdit ? "Editar perfil de prestador" : "Cadastro de Prestador"}</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Monte sua vitrine profissional em poucos passos
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Cancelar cadastro"
            className="p-2 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-light)] transition"
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {/* progress */}
            <div className="mb-4">
              <div className="w-full h-2 bg-[var(--border-muted)] rounded-full overflow-hidden">
                <motion.div
                  className="h-2 bg-[var(--primary)]"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((step + 1) / totalSteps) * 100}%`,
                  }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-sm text-[var(--text-muted)]">
                <span>
                  Etapa {step + 1} de {totalSteps}
                </span>
                <span className="font-medium">
                  {["Identidade", "Profissional", "Endereço", "Documentos", "Preferências"][step]}
                </span>
              </div>
            </div>

            {/* ====================================== */}
            {/*   🔥 ETAPAS COM ANIMATEPRESENCE CORRETO */}
            {/* ====================================== */}
            <div className="bg-[var(--bg-light)] border border-[var(--border)] rounded-2xl p-6 shadow-md">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <StepIdentity
                      form={form}
                      update={update}
                      profilePreviewUrl={profilePreviewUrl}
                      onProfileFile={handleProfileFile}
                    />
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <StepProfessional
                      form={form}
                      update={update}
                      addSubcategory={addSubcategory}
                      removeSubcategory={removeSubcategory}
                    />
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <StepAddress form={form} update={update} />
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <StepDocuments
                      form={form}
                      update={update}
                      onIdDocument={handleIdDocument}
                      onCompanyDocument={handleCompanyDocument}
                      onCertifications={handleCertifications}
                    />
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <StepPreferences
                      form={form}
                      update={update}
                      onSave={handleFinish}
                      onBack={prev}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* nav */}
              <div className="mt-6 flex justify-between items-center">
                <div>
                  {step > 0 && (
                    <button
                      onClick={prev}
                      className="px-4 py-2 rounded border border-[var(--border)] text-[var(--text)] flex items-center gap-2"
                    >
                      <ArrowLeft size={16} /> Voltar
                    </button>
                  )}
                </div>

                <div>
                  {step < totalSteps - 1 ? (
                    <button
                      onClick={next}
                      className="px-4 py-2 rounded bg-[var(--primary)] text-white flex items-center gap-2"
                    >
                      Próximo <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinish}
                      disabled={saving}
                      className="px-4 py-2 rounded bg-[var(--primary)] text-white flex items-center gap-2 disabled:opacity-70"
                    >
                      {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar & Publicar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* preview */}
          <aside className="order-first md:order-last">
            <ProfilePreview form={form} profilePreviewUrl={profilePreviewUrl} />
          </aside>
        </div>
      </div>
    </div>
  );
}
