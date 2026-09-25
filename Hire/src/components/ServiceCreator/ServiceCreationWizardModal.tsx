/* --------------------------------------------------------------------------
 * ServiceCreationWizardModal.tsx
 *
 * Modal de Criação de Serviço
 * -------------------------------------------------
 * - Multietapas com animações (framer-motion)
 * - Upload e ordenação de imagens (drag & drop)
 * - Switches modernos para opções booleanas
 * - Tooltips e placeholders informativos
 * - Layout aprimorado e responsivo
 * - Duração e agenda com o ScheduleConfigurator
 * - Publica o serviço na API (imagens na ordem escolhida; a primeira é a capa)
 * -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { X, Info, Loader2 } from "lucide-react";
import { categoryAPI } from "../../api/CategoryAPI";
import { serviceAPI } from "../../api/ServiceAPI";
import type { Category } from "../../interfaces/CategoryInterface";
import type { ScheduleSlots } from "../../interfaces/Entities";
import ScheduleConfigurator from "../Schedule";
import { useToast } from "../Toast/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { formatCurrency } from "../../utils/format";

/* --------------------------------------------------------------------------
 * Tipagem dos dados do formulário
 * -------------------------------------------------------------------------- */
interface ServiceFormData {
  categoryId: number | "";
  subcategory: string;
  title: string;
  description: string;
  price: string;
  negotiable: boolean;
  duration: string;
  requiresScheduling: boolean;
  scheduleSlots: ScheduleSlots;
  cancellationNotice: string;
  acceptedTerms: boolean;
}

/** Imagem escolhida: o id estável permite reordenar sem perder a miniatura */
interface WizardImage {
  id: string;
  file: File;
  url: string;
}

const EMPTY_FORM: ServiceFormData = {
  categoryId: "",
  subcategory: "",
  title: "",
  description: "",
  price: "",
  negotiable: false,
  duration: "1 hora",
  requiresScheduling: false,
  scheduleSlots: {},
  cancellationNotice: "",
  acceptedTerms: false,
};

const TOTAL_STEPS = 8;
const MAX_IMAGES = 8;

/** "1.250,50" ou "1250.5" → 1250.5 */
function parsePrice(text: string) {
  const clean = text.replace(/[^\d.,]/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return Number(normalized);
}

/* --------------------------------------------------------------------------
 * Tooltip simples para instruções curtas
 * -------------------------------------------------------------------------- */
const Tooltip = ({ text }: { text: string }) => (
  <motion.div
    className="flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
  >
    <Info size={12} /> {text}
  </motion.div>
);

/* --------------------------------------------------------------------------
 * Switch estilizado (melhor UX)
 * -------------------------------------------------------------------------- */
const Switch = ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={onChange}
    className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors ${
      checked ? "bg-[var(--primary)]" : "bg-[var(--border-muted)]"
    }`}
  >
    <span
      className={`inline-block w-5 h-5 transform bg-[var(--text)] rounded-full transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

/* --------------------------------------------------------------------------
 * Componente principal
 * -------------------------------------------------------------------------- */
export const ServiceCreationWizardModal = ({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** chamado depois de publicar (ex.: recarregar a galeria) */
  onCreated?: () => void;
}) => {
  /* --------------------------------------------------------------------------
   * Estados
   * -------------------------------------------------------------------------- */
  const { showToast } = useToast();
  const [formData, setFormData] = useState<ServiceFormData>(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [step, setStep] = useState(0);
  const [imageList, setImageList] = useState<WizardImage[]>([]);
  const [publishing, setPublishing] = useState(false);
  const progressPercentage = ((step + 1) / TOTAL_STEPS) * 100;
  const categoryName = categories.find((c) => c.id === formData.categoryId)?.name ?? "";
  const price = parsePrice(formData.price);

  useEffect(() => {
    if (!isOpen) return;
    categoryAPI.getCategory().then((c) => setCategories(c ?? [])).catch(() => setCategories([]));
  }, [isOpen]);

  // ao fechar, limpa tudo (e libera as miniaturas)
  useEffect(() => {
    if (isOpen) return;
    setStep(0);
    setFormData(EMPTY_FORM);
    setImageList((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.url));
      return [];
    });
  }, [isOpen]);

  // Esc fecha
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !publishing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, publishing, onClose]);

  /* --------------------------------------------------------------------------
   * Manipuladores de eventos
   * -------------------------------------------------------------------------- */
  const handleNext = () => setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  const handlePrev = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "categoryId" ? (value ? Number(value) : "") : value,
    }));
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
    if (valid.length < files.length) showToast("Use imagens de até 8 MB.", "warning");
    setImageList((prev) => [
      ...prev,
      ...valid.map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) })),
    ].slice(0, MAX_IMAGES));
    e.target.value = "";
  };

  const removeImage = (id: string) => {
    setImageList((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  /* --------------------------------------------------------------------------
   * Publicação
   * -------------------------------------------------------------------------- */
  async function handleSubmit() {
    if (publishing) return;
    setPublishing(true);
    try {
      const data = new FormData();
      data.append("title", formData.title.trim());
      data.append("description_service", formData.description.trim());
      data.append("categoryId", String(formData.categoryId));
      data.append("subcategory", formData.subcategory.trim());
      data.append("price", String(price));
      data.append("negotiable", formData.negotiable ? "true" : "false");
      data.append("duration", formData.duration);
      data.append("requiresScheduling", formData.requiresScheduling ? "true" : "false");
      if (formData.requiresScheduling) {
        data.append("scheduleSlots", JSON.stringify(formData.scheduleSlots));
        data.append("cancellationNotice", formData.cancellationNotice.trim());
      }
      imageList.forEach((img) => data.append("images", img.file));
      await serviceAPI.create(data);
      showToast("Serviço publicado!", "success");
      onCreated?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível publicar o serviço."), "error");
    } finally {
      setPublishing(false);
    }
  }

  const hasSlots = Object.values(formData.scheduleSlots).some((t) => t && t.length > 0);

  // O que falta em cada etapa (null = pode avançar)
  const blocker = (() => {
    if (step === 1 && !formData.categoryId) return "Escolha uma categoria";
    if (step === 3 && (!formData.title.trim() || !formData.description.trim())) return "Preencha título e descrição";
    if (step === 3 && formData.description.trim().length > 250) return "A descrição pode ter até 250 caracteres";
    if (step === 4 && !(price > 0)) return "Informe um preço válido";
    if (step === 5 && formData.requiresScheduling && !hasSlots) return "Escolha ao menos um horário na agenda";
    if (step === 6 && !formData.acceptedTerms) return "Aceite os termos para continuar";
    return null;
  })();

  // -----------------------------------------------------------------------------
  // Componente: ServicePreview
  // -----------------------------------------------------------------------------
  // Mostra um "card" com as informações preenchidas no formulário, incluindo
  // imagem de capa, descrição e dados principais, com "Ver mais" e reordenação.
  // -----------------------------------------------------------------------------
  const ServicePreview = () => {
    // Estado local para controlar se a descrição está expandida
    const [expanded, setExpanded] = useState(false);

    // Limite de caracteres antes de aparecer o botão "Ver mais"
    const charLimit = 220;

    // Verifica se a descrição ultrapassa o limite
    const isLongText = formData.description && formData.description.length > charLimit;

    // Define o texto visível com base no estado "expanded"
    const displayedText = isLongText
      ? expanded
        ? formData.description
        : formData.description.slice(0, charLimit) + "..."
      : formData.description;

    return (
      // motion.div -> componente animado do Framer Motion (anima entrada)
      <motion.div
        className="p-4 rounded-lg shadow-xl w-full relative text-[var(--text)] overflow-hidden"

        // Fundo: primeira imagem enviada (ou transparente se não houver)
        style={{
          backgroundImage: imageList[0] ? `url(${imageList[0].url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Camada translúcida para garantir legibilidade do conteúdo */}
        <div className="bg-[var(--bg-light)]/90 p-4 rounded backdrop-blur-sm">
          {/* -------------------- TÍTULO -------------------- */}
          <h2 className="font-bold text-2xl mb-2 text-[var(--primary)]">
            {formData.title || "Título do serviço"}
          </h2>

          {/* -------------------- DESCRIÇÃO -------------------- */}
          <p className="text-[var(--text-muted)] mb-2">
            {displayedText || "Descrição do serviço..."}
          </p>

          {/* Botão “Ver mais / Ver menos” aparece apenas se o texto for longo */}
          {isLongText && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-[var(--primary)] text-sm hover:underline focus:outline-none"
            >
              {expanded ? "Ver menos" : "Ver mais"}
            </button>
          )}

          {/* -------------------- CATEGORIA -------------------- */}
          <p>
            <strong>Categoria:</strong> {categoryName || "-"} /{" "}
            {formData.subcategory || "-"}
          </p>

          {/* -------------------- PREÇO -------------------- */}
          <p>
            <strong>Preço:</strong>{" "}
            {price > 0 ? formatCurrency(price) : "-"}{" "}
            {formData.negotiable && "(Negociável)"}
          </p>

          {/* -------------------- DURAÇÃO -------------------- */}
          <p>
            <strong>Duração:</strong> {formData.duration || "-"}
          </p>

          {/* -------------------- CANCELAMENTO (se exigir agendamento) -------------------- */}
          {formData.requiresScheduling && (
            <p>
              <strong>Cancelamento:</strong>{" "}
              {formData.cancellationNotice || "-"}
            </p>
          )}

          {/* ---------------------------------------------------------------------
              GALERIA DE IMAGENS (com suporte a drag & drop via Reorder.Group)
             --------------------------------------------------------------------- */}
          {imageList.length > 0 && (
            <>
              <p className="text-xs text-[var(--text-muted)] mt-3">Arraste para reordenar — a primeira imagem é a capa.</p>
              <div className="flex gap-2 flex-wrap mt-2">
                <Reorder.Group
                  axis="x"
                  values={imageList}
                  onReorder={setImageList}
                  className="flex gap-2 flex-wrap"
                >
                  {imageList.map((img, i) => (
                    <Reorder.Item key={img.id} value={img}>
                      <div className="relative cursor-grab">
                        {/* Miniatura da imagem */}
                        <img
                          src={img.url}
                          alt={i === 0 ? "Capa do serviço" : `Imagem ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-lg shadow-md"
                          draggable={false}
                        />

                        {/* Botão para remover imagem */}
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          aria-label={`Remover imagem ${i + 1}`}
                          className="absolute top-0 right-0 bg-[var(--danger)] text-white rounded-full p-1 hover:bg-[var(--danger)]/80"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              </div>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  /* --------------------------------------------------------------------------
   * Conteúdo de cada etapa do wizard de criação de serviço
   * -------------------------------------------------------------------------- */
  const stepsContent = [

    /* ------------------------------------------------------------------------
     *   ETAPA 0 — UPLOAD DE IMAGENS
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-4 p-4 border-2 border-dashed border-[var(--border)] rounded-lg bg-[var(--bg-dark)]">
      <label htmlFor="wizard-images" className="text-[var(--text)] font-semibold">Adicione imagens do serviço</label>
      <Tooltip text={`A primeira imagem será usada como capa do serviço (até ${MAX_IMAGES}). Opcional.`} />

      {/* Input nativo para múltiplas imagens */}
      <input
        id="wizard-images"
        type="file"
        multiple
        accept="image/*"
        onChange={handleImageUpload}
        className="text-[var(--text)]"
      />

      {/* Exibe a pré-visualização apenas se houver imagens */}
      {imageList.length > 0 && <ServicePreview />}
    </div>,

    /* ------------------------------------------------------------------------
     *   ETAPA 1 — CATEGORIA PRINCIPAL
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-2">
      <label htmlFor="wizard-category" className="text-[var(--text)] font-semibold">Categoria</label>
      <Tooltip text="Escolha a área principal em que seu serviço se enquadra" />

      <select
        id="wizard-category"
        name="categoryId"
        value={formData.categoryId}
        onChange={handleInputChange}
        className="border rounded p-2 border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)]"
      >
        <option value="">Selecione uma categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>,

    /* ------------------------------------------------------------------------
     *   ETAPA 2 — SUBCATEGORIA
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-2">
      <label htmlFor="wizard-subcategory" className="text-[var(--text)] font-semibold">Subcategoria <span className="font-normal text-[var(--text-muted)]">(opcional)</span></label>
      <Tooltip text="Ajuda a especificar melhor o tipo de serviço oferecido. Ex: Elétrica, Pintura" />

      <input
        id="wizard-subcategory"
        type="text"
        name="subcategory"
        value={formData.subcategory}
        placeholder={categoryName ? `Especialidade em ${categoryName}` : "Ex: Elétrica"}
        maxLength={60}
        onChange={handleInputChange}
        className="border rounded w-full p-2 border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)]"
      />
    </div>,

    /* ------------------------------------------------------------------------
     *   ETAPA 3 — TÍTULO E DESCRIÇÃO
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-2">
      <label htmlFor="wizard-title" className="text-[var(--text)] font-semibold">Título do serviço</label>
      <Tooltip text="Escolha um nome curto e direto. Exemplo: 'Instalação de chuveiro elétrico'" />
      <input
        id="wizard-title"
        type="text"
        name="title"
        value={formData.title}
        maxLength={100}
        placeholder="Ex: Instalação de chuveiro elétrico"
        onChange={handleInputChange}
        className="border rounded p-2 border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)]"
      />

      <label htmlFor="wizard-description" className="text-[var(--text)] mt-5 font-semibold">Descrição</label>
      <Tooltip text="Descreva seu serviço, incluindo o que está incluso e como funciona." />
      <textarea
        id="wizard-description"
        name="description"
        value={formData.description}
        maxLength={250}
        placeholder="Descreva seu serviço com detalhes..."
        onChange={handleInputChange}
        className="border rounded p-2 border-[var(--border)] min-h-30 bg-[var(--bg-light)] text-[var(--text)]"
      />
      <span className="text-xs text-[var(--text-muted)] self-end">{formData.description.length}/250</span>
    </div>,

    /* ------------------------------------------------------------------------
     *   ETAPA 4 — VALOR DO SERVIÇO
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-2">
      <label htmlFor="wizard-price" className="text-[var(--text)] font-semibold">Preço (R$)</label>
      <Tooltip text="Informe o valor padrão do serviço. Se aceitar propostas, marque como negociável." />
      <input
        id="wizard-price"
        type="text"
        inputMode="decimal"
        name="price"
        value={formData.price}
        placeholder="Ex: 250,00"
        onChange={handleInputChange}
        className="border rounded p-2 border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)]"
      />
      {price > 0 && <span className="text-xs text-[var(--text-muted)]">{formatCurrency(price)}</span>}

      {/* Switch para indicar valor negociável */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[var(--text)]">Valor negociável</span>
        <Switch
          label="Valor negociável"
          checked={formData.negotiable}
          onChange={() =>
            setFormData((prev) => ({ ...prev, negotiable: !prev.negotiable }))
          }
        />
      </div>
      <Tooltip text="Negociável: o cliente pode pedir orçamento e propor valor, prazo e data." />
    </div>,

    /* ------------------------------------------------------------------------
     *   ETAPA 5 — DURAÇÃO MÉDIA E AGENDA
     * ------------------------------------------------------------------------ */
    <ScheduleConfigurator
      serviceType={categoryName}
      duration={formData.duration}
      onDurationChange={(duration) => setFormData((prev) => ({ ...prev, duration }))}
      useSchedule={formData.requiresScheduling}
      onUseScheduleChange={(requiresScheduling) => setFormData((prev) => ({ ...prev, requiresScheduling }))}
      slots={formData.scheduleSlots}
      onSlotsChange={(scheduleSlots) => setFormData((prev) => ({ ...prev, scheduleSlots }))}
      cancellationNotice={formData.cancellationNotice}
      onCancellationNoticeChange={(cancellationNotice) => setFormData((prev) => ({ ...prev, cancellationNotice }))}
    />,

    /* ------------------------------------------------------------------------
     *   ETAPA 6 — ACEITE DE TERMOS
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-2">
      <p className="text-[var(--text-muted)]">
        Antes de publicar, confirme que leu e aceita os termos da plataforma.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[var(--text)]">Aceito os termos</span>
        <Switch
          label="Aceito os termos"
          checked={formData.acceptedTerms}
          onChange={() =>
            setFormData((prev) => ({ ...prev, acceptedTerms: !prev.acceptedTerms }))
          }
        />
      </div>
    </div>,

    /* ------------------------------------------------------------------------
     *   ETAPA FINAL — PRÉ-VISUALIZAÇÃO
     * ------------------------------------------------------------------------ */
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-[var(--text)]">Pré-visualização</h2>
      <Tooltip text="Confira como seu serviço será exibido aos clientes." />
      <ServicePreview />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={publishing}
        className="mt-4 px-4 py-2 bg-[var(--primary)] text-white rounded hover:bg-[var(--primary)]/80 transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {publishing && <Loader2 size={16} className="animate-spin" />}
        {publishing ? "Publicando..." : "Publicar serviço"}
      </button>
    </div>,
  ];


  /* --------------------------------------------------------------------------
   * Renderização do modal de criação de serviço
   * -------------------------------------------------------------------------- */
  return (
    // AnimatePresence anima a entrada e a saída do modal
    <AnimatePresence>
      {isOpen && (
        // Camada de fundo escura semi-transparente
        <motion.div
          className="fixed inset-0 bg-black/60 flex justify-center  items-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Container principal do modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Criar serviço"
            className="bg-[var(--bg)] rounded-2xl shadow-2xl p-6 w-[95%] max-w-xl min-h-[32vh] max-h-[85vh] overflow-y-auto overflow-x-hidden relative"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.4, type: 'spring' }}
          >
            {/* Botão de fechar o modal */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--danger)]"
            >
              <X size={24} />
            </button>

            {/* Barra de progresso das etapas */}
            <div className="mx-10 mb-1 text-xs text-center text-[var(--text-muted)]">Etapa {step + 1} de {TOTAL_STEPS}</div>
            <div className="mx-10 h-2 bg-[var(--border-muted)] rounded-full mb-6 overflow-hidden">
              <motion.div
                className="h-2 bg-[var(--primary)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Renderização da etapa atual */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 50, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -50, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                {stepsContent[step]}
              </motion.div>
            </AnimatePresence>

            {/* Navegação entre etapas */}
            {blocker && <p className="text-xs text-[var(--text-muted)] mt-4 text-right">{blocker}</p>}
            <div className="flex justify-between mt-2 ">
              <button
                type="button"
                onClick={handlePrev}
                disabled={step === 0}
                className="px-4 py-2 bg-[var(--border-muted)] text-[var(--text)] rounded disabled:opacity-50"
              >
                Anterior
              </button>

              {step < TOTAL_STEPS - 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!!blocker}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded hover:bg-[var(--primary)]/80 transition disabled:opacity-50"
                >
                  Próximo
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
