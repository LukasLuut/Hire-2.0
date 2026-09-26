import {  useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Save, Trash2, PlusCircle, Trash, X } from "lucide-react";
import { serviceAPI } from "../../api/ServiceAPI";
import type { Service } from "../../interfaces/ServiceInterface";
import { categoryAPI } from "../../api/CategoryAPI";
import type { Category } from "../../interfaces/CategoryInterface";
import { useToast } from "../../components/Toast/ToastContext";
import { useSession } from "../../context/SessionContext";
import ConfirmModal from "../Common/ConfirmModal";
import { getErrorMessage } from "../../utils/errors";
import { uploadUrl } from "../../utils/avatar";
import { DurationPicker, SlotGrid, WEEK, durationToMinutes, NOTICE_OPTIONS } from "../Schedule";
import { PRICE_UNITS, formatServicePrice, type PriceUnit } from "../../utils/price";

/** Pacote em edição (preço como texto digitado) */
type PackageDraft = { name: string; description: string; price: string };
import type { ScheduleSlots } from "../../interfaces/Entities";

/** Imagem na lista do editor: já publicada (path no servidor) ou nova (arquivo) */
type EditorImage = { id: string; path?: string; file?: File; url: string };
const MAX_IMAGES = 8;


interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: number | null;
  /** Chamado depois de criar, editar ou excluir (a lista recarrega sem recarregar a página) */
  onSaved?: () => void;
}

const EMPTY_SERVICE: Service = {
  id: 0,
  title: "",
  description_service: "",
  price: "",
  duration: "1 hora",
  categoryId: null,
  subcategory: "",
  negotiable: false,
  requiresScheduling: false,
  online: false,
  acceptedTerms: false,
  imageUrl: "",
  cancellationNotice: "",
};

/** "1.250,50" ou "1250.5" → 1250.5 */
const parsePrice = (text: string) => {
  const t = text.trim();
  if (!t) return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
};

/* --------------------------------------------------------------------------
 * Componente principal do painel de serviços
 * -------------------------------------------------------------------------- */
export default function ServiceDashboard({ isOpen, onClose, serviceId, onSaved }: ModalProps) {
  /* --------------------------- Estado inicial dos serviços --------------------------- */
  const { provider } = useSession();
  const providerId = provider?.id ?? 0;
  const { showToast } = useToast();

  const [service, setService] = useState<Service>(EMPTY_SERVICE);
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* --------------------------- Controle de seleção e responsividade --------------------------- */
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  // Controle de qual slide está visível no mobile (editor ou preview)
  const [mobileSlide, setMobileSlide] = useState<"editor" | "preview">(
    "editor"
  );

  // Direção do slide (para controlar animação de entrada/saída)
  const [slideDirection, setSlideDirection] = useState<"left" | "right">(
    "right"
  );

  /* --------------------------- Imagens e agenda --------------------------- */
  const [images, setImages] = useState<EditorImage[]>([]);
  const [slots, setSlots] = useState<ScheduleSlots>({});
  // como o serviço é cobrado e pacotes opcionais
  const [priceUnit, setPriceUnit] = useState<PriceUnit>("fixo");
  const [packages, setPackages] = useState<PackageDraft[]>([]);

  // Preço digitado (aceita centavos: "150,00")
  const [priceDigits, setPriceDigits] = useState("");

  const hasService = !!serviceId && Number(serviceId) > 0;

  // Fecha com ESC
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }

    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, saving]);

  // Enquanto o editor está aberto, a página de trás não rola (só o formulário)
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  /* --------------------------- Atualiza estado ao redimensionar a tela --------------------------- */
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Categorias
  useEffect(() => {
    categoryAPI.getCategory().then((c) => setCategories(c ?? [])).catch(() => setCategories([]));
  }, []);

  // Carrega o serviço para edição (ou limpa para criar)
  useEffect(() => {
    if (!isOpen) return;
    setImages([]);
    setSlots({});
    setPriceUnit("fixo");
    setPackages([]);
    if (!hasService) {
      setService(EMPTY_SERVICE);
      setPriceDigits("");
      return;
    }
    serviceAPI
      .getServiceById(Number(serviceId))
      .then((data) => {
        if (!data) return;
        setService({
          id: data.id,
          title: data.title,
          description_service: data.description_service,
          price: String(data.price),
          duration: data.duration,
          categoryId: data.category?.id || null,
          subcategory: data.subcategory,
          negotiable: data.negotiable,
          requiresScheduling: data.requiresScheduling,
          online: data.online,
          active: data.active,
          acceptedTerms: true,
          imageUrl: data.imageUrl ?? "",
          cancellationNotice: data.cancellationNotice ?? "",
        });
        setPriceDigits(data.price.toFixed(2).replace(".", ","));
        setImages(data.imagePaths.map((path) => ({ id: path, path, url: uploadUrl(path)! })));
        setSlots(data.scheduleSlots ?? {});
        setPriceUnit(data.priceUnit ?? "fixo");
        setPackages((data.packages ?? []).map((pk) => ({ name: pk.name, description: pk.description, price: pk.price.toFixed(2).replace(".", ",") })));
      })
      .catch((err) => showToast(getErrorMessage(err, "Não foi possível carregar o serviço."), "error"));
  }, [isOpen, hasService, serviceId, showToast]);

  /* --------------------------- Serviço atualmente selecionado --------------------------- */
  const selectedService: Service = service;
  const categoryName = categories.find((c) => c.id === selectedService.categoryId)?.name ?? "";

  /* --------------------------- Função para atualizar campos do serviço --------------------------- */
  const handleChange = (
  field: keyof Service,
  value: string | boolean | undefined | string[] | number
) => {
  setService((prev) => ({
    ...prev,
    [field]: value
  }));
};

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/") && f.size <= 8 * 1024 * 1024);
    e.target.value = "";
    if (!files.length) return;
    setImages((prev) =>
      [...prev, ...files.map((file) => ({ id: `${file.name}-${Math.random()}`, file, url: URL.createObjectURL(file) }))].slice(0, MAX_IMAGES)
    );
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  // a imagem escolhida vira a capa (primeira da lista)
  const makeCover = (id: string) => {
    setImages((prev) => [...prev.filter((img) => img.id === id), ...prev.filter((img) => img.id !== id)]);
  };

  /* --------------------------- Função de swipe lateral (mobile) --------------------------- */
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (mobileSlide === "editor") {
      // Editor: arrastar para esquerda → preview
      if (info.offset.x < -50) {
        setSlideDirection("right"); // preview entra pela direita
        setMobileSlide("preview");
      }
    } else if (mobileSlide === "preview") {
      // Preview: arrastar para direita → volta para editor
      if (info.offset.x > 50) {
        setSlideDirection("left"); // editor entra pela esquerda
        setMobileSlide("editor");
      }
    }
  };

  /* --------------------------- Variants do framer-motion para animação --------------------------- */
  const variants = {
    enter: (direction: "left" | "right") => ({
      x: direction === "right" ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: "left" | "right") => ({
      x: direction === "right" ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  /* --------------------------- Estilo modal mobile --------------------------- */
  const mobileModalClass =
    "absolute top-10 left-4 right-4 bottom-10 bg-[var(--bg-light)] rounded-2xl shadow-lg border border-[var(--border)] p-6 flex flex-col overflow-auto";

  const formatPrice = (digits: string) => {
    if (!digits) return "";
    return `R$ ${digits}`;
  };

  const onPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value.replace(/^R\$\s?/, "").replace(/[^\d.,]/g, "");
    setPriceDigits(typed);
    handleChange("price", typed);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await serviceAPI.deleteUser(selectedService.id);
      showToast("Serviço removido com sucesso!", "success");
      setConfirmDelete(false);
      onSaved?.();
      onClose();
    }
    catch (err) {
      // ex.: serviço com contratação em andamento
      showToast(getErrorMessage(err, "Erro ao remover serviço!"), "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  /** Cria ou atualiza o serviço, esperando a resposta do servidor. */
  const handleSave = async () => {
    // "sob orçamento" pode ficar sem valor de referência
    const price = priceUnit === "orcamento" && !priceDigits.trim() ? 0 : parsePrice(priceDigits);
    if (
      !selectedService.categoryId ||
      !selectedService.description_service.trim() ||
      !selectedService.title.trim() ||
      !selectedService.duration.trim() ||
      !(price > 0 || (priceUnit === "orcamento" && price === 0))
    ) {
      showToast("Preencha título, descrição, categoria, preço e duração.", "warning")
      return;
    }
    const pkgs = packages.map((pk) => ({ name: pk.name.trim(), description: pk.description.trim(), price: parsePrice(pk.price) }));
    const badPkg = pkgs.find((pk) => !pk.name || !(pk.price > 0));
    if (badPkg) return showToast("Cada pacote precisa de nome e preço.", "warning");
    if (selectedService.description_service.trim().length > 250) return showToast("A descrição pode ter até 250 caracteres.", "warning");
    if (!hasService && !selectedService.acceptedTerms) return showToast("Aceite os termos da plataforma para publicar.", "warning");
    if (!providerId) return showToast("Cadastre sua empresa antes de publicar serviços.", "warning");
    const hasSlots = Object.values(slots).some((t) => t && t.length > 0);
    if (selectedService.requiresScheduling && !hasSlots) return showToast("Escolha ao menos um horário na agenda.", "warning");

    const formData = new FormData();
    formData.append("title", selectedService.title.trim());
    formData.append("description_service", selectedService.description_service.trim());
    formData.append("categoryId", String(selectedService.categoryId));
    formData.append("price", String(price));
    formData.append("priceUnit", priceUnit);
    formData.append("packages", JSON.stringify(pkgs));
    formData.append("duration", selectedService.duration.trim());
    formData.append("subcategory", selectedService.subcategory ? selectedService.subcategory.trim() : "");
    formData.append("negotiable", selectedService.negotiable ? "true" : "false");
    formData.append("requiresScheduling", selectedService.requiresScheduling ? "true" : "false");
    formData.append("online", selectedService.online ? "true" : "false");
    if (hasService) formData.append("active", selectedService.active === false ? "false" : "true");
    if (selectedService.requiresScheduling) {
      formData.append("scheduleSlots", JSON.stringify(slots));
      formData.append("cancellationNotice", (selectedService.cancellationNotice ?? "").trim());
    }
    // imagens: as já publicadas que ficaram (na ordem) + as novas; a primeira é a capa
    formData.append("keepImages", JSON.stringify(images.filter((i) => i.path).map((i) => i.path)));
    images.forEach((img) => img.file && formData.append("images", img.file));

    setSaving(true);
    try {
      if (hasService) await serviceAPI.update(selectedService.id, formData);
      else await serviceAPI.create(formData);
      showToast(hasService ? "Informações editadas com sucesso" : "Serviço criado com sucesso.", "success");
      onSaved?.();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, "Não foi possível salvar o serviço."), "error");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  /* --------------------------------------------------------------------------
   * Renderização principal
   * -------------------------------------------------------------------------- */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-editor-title"
      className="fixed inset-0 z-50 md:pt-20 pt-17 bg-[var(--bg-dark)]/80 backdrop-blur-sm text-[var(--text)] flex flex-col md:flex-row transition-all duration-500 items-start justify-center"
    >
      <div className="flex-1 relative flex w-full max-w-[1024px] h-[calc(100dvh-4.5rem)] md:h-[calc(100vh-6.5rem)] md:px-4">

        {/* ----------------------------------------------------------------------
         * Editor do serviço
         * ----------------------------------------------------------------------
         * Modal no mobile, animação tipo slide usando framer-motion
         * ---------------------------------------------------------------------- */}
        <AnimatePresence initial={false} mode="wait">
          {(mobileSlide === "editor" || !isMobile) && (
            <motion.div
              key="editor"
              className={`${isMobile ? mobileModalClass : "w-1/2 p-6 h-full overflow-y-auto overscroll-contain"} bg-[var(--bg-light)] rounded-2xl shadow-lg border border-[var(--border)]`}
              custom={slideDirection}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
            >
              {/* --------------------------- Título e descrição --------------------------- */}
              <div className="flex items-start justify-between gap-3">
                <h2 id="service-editor-title" className="text-4xl text-[var(--primary)] font-bold mb-3">{hasService ? "Editar Serviço" : "Criar Serviço"}</h2>
                <button onClick={onClose} disabled={saving} aria-label="Fechar" className="text-[var(--text-muted)] hover:text-[var(--primary)] p-1">
                  <X size={22} />
                </button>
              </div>
              <h3 className="text-sm text-[var(--text-muted)] ml-1 mb-6">Monte sua vitrine digital e transforme seu trabalho em oportunidades reais.</h3>
              <div className="flex flex-col gap-4">
                <label className="flex flex-col">
                  <span className="text-[var(--text-muted)] text-sm mb-1">
                    Título do Serviço
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ex: Consultoria Jurídica, Design Gráfico..."
                    value={selectedService.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                    className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[var(--text-muted)] text-sm mb-1">
                    Descrição detalhada
                  </span>
                  <textarea
                    required
                    placeholder="Descreva o serviço, incluindo detalhes importantes..."
                    value={selectedService.description_service}
                    onChange={(e) =>
                      handleChange("description_service", e.target.value)
                    }
                    rows={4}
                    maxLength={250}
                    className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] resize-none"
                  />
                  <span className="text-xs text-[var(--text-muted)] self-end mt-1">{selectedService.description_service.length}/250</span>
                </label>

                {/* --------------------------- Categoria / Subcategoria --------------------------- */}
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col">
                    <span className="text-[var(--text-muted)] text-sm mb-1">Categoria</span>
                    <select
                      required
                      value={selectedService.categoryId ?? ""}
                      onChange={(e) => handleChange("categoryId", Number(e.target.value))}
                      className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                    >
                      <option value="" disabled>Selecione uma categoria</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id} >
                          {cat.name}
                        </option>
                      ))}

                    </select>
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[var(--text-muted)] text-sm mb-1">Subcategoria</span>
                    <input
                      placeholder="Ex: Desenvolvimento Web, Cabelereiro..."
                      type="text"
                      value={selectedService.subcategory}
                      onChange={(e) =>
                        handleChange("subcategory", e.target.value)
                      }
                      className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                    />
                  </label>
                </div>

                {/* --------------------------- Preço / Duração --------------------------- */}
                <div className="grid grid-cols-1 gap-4">
                  <label className="flex flex-col">
                    <span className="text-[var(--text-muted)] text-sm mb-1">Como você cobra</span>
                    <select
                      value={priceUnit}
                      onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
                      className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                    >
                      {PRICE_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                    </select>
                    <span className="text-xs text-[var(--text-muted)] mt-1">{PRICE_UNITS.find((u) => u.value === priceUnit)?.hint}</span>
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[var(--text-muted)] text-sm mb-1">
                      {priceUnit === "hora" ? "Preço por hora (R$)" : priceUnit === "m2" ? "Preço por m² (R$)" : priceUnit === "visita" ? "Preço por visita (R$)" : priceUnit === "a_partir_de" ? "Valor mínimo (R$)" : priceUnit === "orcamento" ? "Valor de referência (R$, opcional)" : "Preço (R$)"}
                    </span>
                    <input
                      placeholder="Ex: R$ 200,00"
                      type="text"
                      inputMode="decimal"
                      value={formatPrice(priceDigits)}
                      onChange={onPriceChange}
                      className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                    />
                  </label>
                  <DurationPicker compact value={selectedService.duration || "1 hora"} onChange={(d) => handleChange("duration", d)} />
                </div>

                {/* --------------------------- Pacotes (opcional) --------------------------- */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text)] font-medium">Pacotes <span className="text-xs text-[var(--text-muted)] font-normal">(opcional, até 3)</span></span>
                    {packages.length < 3 && (
                      <button type="button" onClick={() => setPackages((p) => [...p, { name: "", description: "", price: "" }])} className="text-sm text-[var(--primary)] hover:underline">
                        + Adicionar pacote
                      </button>
                    )}
                  </div>
                  {packages.length === 0 && <p className="text-xs text-[var(--text-muted)]">Ex.: "Básico" e "Completo" com preços diferentes. O cliente escolhe um ao contratar.</p>}
                  {packages.map((pk, i) => (
                    <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 items-start p-2 rounded-lg bg-[var(--bg)] border border-[var(--border-muted)]">
                      <input aria-label={`Nome do pacote ${i + 1}`} placeholder="Nome (ex.: Completo)" maxLength={40} value={pk.name} onChange={(e) => setPackages((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm" />
                      <input aria-label={`Preço do pacote ${i + 1}`} placeholder="R$" inputMode="decimal" value={pk.price} onChange={(e) => setPackages((p) => p.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d.,]/g, "") } : x)))} className="p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm" />
                      <button type="button" aria-label={`Remover pacote ${i + 1}`} onClick={() => setPackages((p) => p.filter((_, j) => j !== i))} className="p-2 text-[var(--text-muted)] hover:text-red-500"><Trash2 size={16} /></button>
                      <input aria-label={`Descrição do pacote ${i + 1}`} placeholder="O que inclui (opcional)" maxLength={120} value={pk.description} onChange={(e) => setPackages((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="col-span-3 p-2 bg-[var(--bg-light)] border border-[var(--border)] rounded-lg text-[var(--text)] text-sm" />
                    </div>
                  ))}
                </div>

                {/* --------------------------- Switches --------------------------- */}
                <div className="flex flex-col gap-3 mt-2">
                  {/* Preço negociável */}
                  <label className="flex items-center justify-between">
                    <span className="text-[var(--text)]">Preço negociável</span>
                    <input
                      type="checkbox"
                      checked={selectedService.negotiable}
                      onChange={(e) =>
                        handleChange("negotiable", e.target.checked)
                      }
                      className="relative w-10 h-5 appearance-none bg-[var(--border)] rounded-full cursor-pointer transition-all duration-300
                         checked:bg-[var(--primary)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4
                         after:bg-[var(--bg-light)] after:rounded-full after:transition-all checked:after:translate-x-5"
                    />
                  </label>

                  {/* Ativo / pausado (só na edição) */}
                  {hasService && (
                    <label className="flex items-center justify-between">
                      <span className="text-[var(--text)]">
                        Serviço ativo
                        <span className="block text-xs text-[var(--text-muted)]">Pausado, ele some da vitrine e não recebe pedidos novos.</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedService.active !== false}
                        onChange={(e) => handleChange("active", e.target.checked)}
                        className="relative w-10 h-5 shrink-0 appearance-none bg-[var(--border)] rounded-full cursor-pointer transition-all duration-300
                           checked:bg-[var(--primary)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4
                           after:bg-[var(--bg-light)] after:rounded-full after:transition-all checked:after:translate-x-5"
                      />
                    </label>
                  )}

                  {/* Onde acontece: presencial pede o endereço do cliente; online não */}
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-[var(--text)]">
                      Atendimento online
                      <span className="block text-xs text-[var(--text-muted)]">Sem visita: o cliente não precisa informar endereço</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!selectedService.online}
                      onChange={(e) => handleChange("online", e.target.checked)}
                      className="relative w-10 h-5 shrink-0 appearance-none bg-[var(--border)] rounded-full cursor-pointer transition-all duration-300
                         checked:bg-[var(--primary)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4
                         after:bg-[var(--bg-light)] after:rounded-full after:transition-all checked:after:translate-x-5"
                    />
                  </label>

                  {/* Requer agendamento */}
                  <label className="flex items-center justify-between">
                    <span className="text-[var(--text)]">Exige agendamento prévio</span>
                    <input
                      type="checkbox"
                      checked={selectedService.requiresScheduling}
                      onChange={(e) =>
                        handleChange("requiresScheduling", e.target.checked)
                      }
                      className="relative w-10 h-5 appearance-none bg-[var(--border)] rounded-full cursor-pointer transition-all duration-300
                         checked:bg-[var(--primary)] after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4
                         after:bg-[var(--bg-light)] after:rounded-full after:transition-all checked:after:translate-x-5"
                    />
                  </label>

                  {/* Agenda: horários em que o cliente pode marcar o início */}
                  {selectedService.requiresScheduling && (
                    <div className="flex flex-col gap-3">
                      <span className="text-sm text-[var(--text-muted)]">Horários disponíveis para o cliente escolher</span>
                      <SlotGrid slots={slots} onChange={setSlots} serviceType={categoryName} minutes={durationToMinutes(selectedService.duration || "1 hora")} hours={Object.fromEntries((provider?.availabilities ?? []).map((a) => [a.day, { start: a.start, end: a.end }]))} />
                      <label className="flex flex-col">
                        <span className="text-[var(--text-muted)] text-sm mb-1">Prazo para cancelamento</span>
                        <select
                          value={selectedService.cancellationNotice ?? ""}
                          onChange={(e) => handleChange("cancellationNotice", e.target.value)}
                          className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                        >
                          {/* textos antigos digitados à mão continuam aparecendo */}
                          {[...NOTICE_OPTIONS, ...(NOTICE_OPTIONS.includes(selectedService.cancellationNotice ?? "") ? [] : [selectedService.cancellationNotice ?? ""])].map((o) => (
                            <option key={o} value={o}>{o || "Sem prazo mínimo"}</option>
                          ))}
                        </select>
                        <span className="text-xs text-[var(--text-muted)] mt-1">Quem cancelar um pedido aceito depois desse prazo fica com o cancelamento registrado no perfil.</span>
                      </label>
                    </div>
                  )}


                </div>

                {/* --------------------------- Editor de imagens --------------------------- */}
                <div className="mt-4">
                  <h4 className="font-semibold mb-1">Imagens do serviço</h4>
                  <p className="text-xs text-[var(--text-muted)] mb-2">A primeira é a capa. Toque em uma imagem para torná-la capa.</p>
                  <div className="flex gap-2 flex-wrap">
                    {images.map((img, i) => (
                    <div key={img.id} className={`relative w-24 h-24 rounded-lg overflow-hidden border ${i === 0 ? "border-[var(--primary)] border-2" : "border-[var(--border)]"}`}>
                      <button type="button" onClick={() => makeCover(img.id)} className="w-full h-full" aria-label={i === 0 ? "Capa do serviço" : `Usar imagem ${i + 1} como capa`}>
                        <img
                          src={img.url}
                          alt={i === 0 ? "Capa do serviço" : `Imagem ${i + 1} do serviço`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {i === 0 && <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center bg-[var(--primary)] text-white">Capa</span>}

                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        aria-label={`Remover imagem ${i + 1}`}
                        className="absolute top-1 right-1 bg-[var(--bg-dark)]/70 p-1 rounded-full text-white hover:bg-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    ))}

                    {images.length < MAX_IMAGES && (
                      <>
                        <label
                          htmlFor="imageUpload"
                          className="flex items-center justify-center w-24 h-24 rounded-lg border border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-dark)]/20 transition"
                        >
                          <PlusCircle size={24} />
                          <span className="sr-only">Adicionar imagens</span>
                        </label>

                        <input
                          id="imageUpload"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={ handleImageChange }
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>


                {/* --------------------------- Termos (só ao publicar) --------------------------- */}
                {!hasService && (
                  <label className="flex items-center gap-3 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!selectedService.acceptedTerms}
                      onChange={(e) => handleChange("acceptedTerms", e.target.checked)}
                      className="w-4 h-4 accent-[var(--primary)]"
                    />
                    Li e aceito os termos da plataforma para publicar este serviço.
                  </label>
                )}

                {/* --------------------------- Botão salvar --------------------------- */}
                <div className="mt-5 pb-2 flex flex-wrap gap-3 justify-center">
                  <button
                    className="flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition disabled:opacity-60"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save size={18} />{saving ? "Salvando..." : hasService ? "Salvar Alterações" : "Criar Serviço"}
                  </button>
                  {hasService && (
                  <button className="flex items-center justify-center gap-2 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition"
                  onClick={() => setConfirmDelete(true)}>
                    <Trash size={18} /> Excluir serviço
                  </button>

                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ----------------------------------------------------------------------
         * Preview do serviço
         * ----------------------------------------------------------------------*/}
      <AnimatePresence initial={false} mode="wait">
  {(mobileSlide === "preview" || !isMobile) && (
    <motion.div
      key="preview"
      className={`${isMobile ? mobileModalClass : "w-1/2 p-6 h-full overflow-y-auto"} md:ml-6 bg-[var(--bg-light)] rounded-2xl shadow-lg border border-[var(--border)] `}
      custom={slideDirection}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      drag={isMobile ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
    >
      {/* --------------------------- Imagem principal --------------------------- */}
    {images[0] && (
      <img
        src={images[0].url}
        alt={selectedService.title}
        className="w-full h-64 object-cover rounded-lg mb-4"
      />
    )}

      {/* --------------------------- Informações do serviço --------------------------- */}
      <div className="p-4 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Pré-visualização</p>
        <h3 className="text-2xl font-bold text-[var(--primary)]">
          {selectedService.title || "Título do serviço"}
        </h3>

        <p className="text-[var(--text-muted)] line-clamp-3">
          {selectedService.description_service || "Descrição do serviço..."}
        </p>

        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <span className="font-semibold text-[var(--text)]">Categoria:</span>{" "}
            {categoryName || "-"}
          </div>
          <div>
            <span className="font-semibold text-[var(--text)]">Subcategoria:</span>{" "}
            {selectedService.subcategory || "-"}
          </div>
          <div>
            <span className="font-semibold text-[var(--text)]">Preço:</span>{" "}
            {parsePrice(priceDigits) > 0 || priceUnit === "orcamento" || packages.length
              ? formatServicePrice(parsePrice(priceDigits) || 0, priceUnit, packages.map((pk) => ({ ...pk, price: parsePrice(pk.price) || 0 })).filter((pk) => pk.price > 0))
              : "-"}
          </div>
          <div>
            <span className="font-semibold text-[var(--text)]">Duração:</span>{" "}
            {selectedService.duration || "-"}
          </div>
        </div>

        <div className="flex flex-col gap-1 mt-2">
          <div>
            <span className="font-semibold text-[var(--text)]">Negociável:</span>{" "}
            {selectedService.negotiable ? "Sim" : "Não"}
          </div>
          <div>
            <span className="font-semibold text-[var(--text)]">Atendimento:</span>{" "}
            {selectedService.online ? "Online" : "Presencial (no endereço do cliente)"}
          </div>
          <div>
            <span className="font-semibold text-[var(--text)]">Exige agendamento:</span>{" "}
            {selectedService.requiresScheduling ? "Sim" : "Não"}
          </div>
          {selectedService.requiresScheduling && (
            <>
              <div>
                <span className="font-semibold text-[var(--text)]">Cancelamento:</span>{" "}
                {selectedService.cancellationNotice || "-"}
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                {WEEK.filter((d) => slots[d.key]?.length).map((d) => `${d.short}: ${slots[d.key]!.join(", ")}`).join(" · ") || "Nenhum horário escolhido"}
              </div>
            </>
          )}
        </div>

        {/* --------------------------- Lista de imagens adicionais --------------------------- */}
        {images.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {images.slice(1).map((img, i) => (
              <img
                key={img.id}
                src={img.url}
                alt={`Imagem ${i + 2} do serviço`}
                className="w-24 h-24 object-cover rounded-lg border border-[var(--border)] shrink-0"
              />
            ))}
          </div>
        )}

      </div>
    </motion.div>
  )}
</AnimatePresence>

         {/* --------------------------- Indicadores de slide (mobile) --------------------------- */}
        {isMobile && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-50">
            <span
              className={`w-3 h-3 rounded-full transition-colors ${
                mobileSlide === "editor"
                  ? "bg-[var(--primary)]"
                  : "bg-[var(--border)]"
              }`}
            />
            <span
              className={`w-3 h-3 rounded-full transition-colors ${
                mobileSlide === "preview"
                  ? "bg-[var(--primary)]"
                  : "bg-[var(--border)]"
              }`}
            />
          </div>
        )}
      </div>
      <ConfirmModal
        open={confirmDelete}
        title="Excluir este serviço?"
        description="Ele deixa de aparecer na busca. Serviços com contratação em andamento não podem ser excluídos."
        confirmLabel="Excluir serviço"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
