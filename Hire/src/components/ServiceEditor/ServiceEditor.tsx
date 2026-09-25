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
  duration: "",
  categoryId: null,
  subcategory: "",
  negotiable: false,
  requiresScheduling: false,
  acceptedTerms: true,
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

  /* --------------------------- Imagem --------------------------- */
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
    setImageFile(null);
    if (!hasService) {
      setService(EMPTY_SERVICE);
      setPriceDigits("");
      setImagePreview(null);
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
          acceptedTerms: true,
          imageUrl: data.imageUrl ?? "",
          cancellationNotice: "",
        });
        setPriceDigits(data.price.toFixed(2).replace(".", ","));
        setImagePreview(data.imageUrl);
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

    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
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
    const price = parsePrice(priceDigits);
    if (
      !selectedService.categoryId ||
      !selectedService.description_service.trim() ||
      !selectedService.title.trim() ||
      !selectedService.duration.trim() ||
      !(price > 0)
    ) {
      showToast("Preencha título, descrição, categoria, preço e duração.", "warning")
      return;
    }
    if (!hasService && !imageFile) return showToast("Selecione uma imagem", "warning");
    if (!providerId) return showToast("Cadastre sua empresa antes de publicar serviços.", "warning");

    const formData = new FormData();
    formData.append("title", selectedService.title.trim());
    formData.append("description_service", selectedService.description_service.trim());
    formData.append("categoryId", String(selectedService.categoryId));
    formData.append("providerId", String(providerId));
    formData.append("price", String(price));
    formData.append("duration", selectedService.duration.trim());
    formData.append("subcategory", selectedService.subcategory ? selectedService.subcategory.trim() : "");
    formData.append("negotiable", selectedService.negotiable ? "true" : "false");
    formData.append("requiresScheduling", selectedService.requiresScheduling ? "true" : "false");
    if (imageFile) formData.append("image", imageFile);

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
    <div  className="min-h-screen md:pt-15 pt-17 overflow-hidden bg-[var(--bg-dark)]/50 text-[var(--text)] flex flex-col md:flex-row transition-all duration-500 items-center justify-center">
      <div className="flex-1 relative flex overflow-hidden w-full max-w-[1024px]">

        {/* ----------------------------------------------------------------------
         * Editor do serviço
         * ----------------------------------------------------------------------
         * Modal no mobile, animação tipo slide usando framer-motion
         * ---------------------------------------------------------------------- */}
        <AnimatePresence initial={false} mode="wait">
          {(mobileSlide === "editor" || !isMobile) && (
            <motion.div
              key="editor"
              className={`${isMobile ? mobileModalClass : "w-1/2 p-6"}  md:ml-10 bg-[var(--bg-light)]  rounded-2xl shadow-lg border border-[var(--border)]`}
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
                <h3 className="text-4xl text-[var(--primary)] font-bold mb-3">{hasService ? "Editar Serviço" : "Criar Serviço"}</h3>
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
                    className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] resize-none"
                  />
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
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col">
                    <span className="text-[var(--text-muted)] text-sm mb-1">Preço (R$)</span>
                    <input
                      placeholder="Ex: R$ 200,00"
                      type="text"
                      inputMode="decimal"
                      value={formatPrice(priceDigits)}
                      onChange={onPriceChange}
                      className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                    />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-[var(--text-muted)] text-sm mb-1">Duração média</span>
                    <input
                      placeholder="Ex: 2 horas, 1 dia..."
                      type="text"
                      value={selectedService.duration}
                      onChange={(e) =>
                        handleChange("duration", e.target.value)
                      }
                      className="p-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)]"
                    />
                  </label>
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

                  
                </div>

                {/* --------------------------- Editor de imagens --------------------------- */}
                {/* <div className="mt-4">
                  <h4 className="font-semibold mb-2">Imagens do serviço</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selectedService.imageUrl && (
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-[var(--border)]">
                      <img
                        src={selectedService.imageUrl}
                        alt="Imagem do serviço"
                        className="w-full h-full object-cover"
                      />

                      <button
                        onClick={removeImage}
                        className="absolute top-1 right-1 bg-[var(--bg-dark)]/70 p-1 rounded-full text-white hover:bg-red-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                    <button
                      onClick={addImage}
                      className="flex items-center justify-center w-24 h-24 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-dark)]/20 transition"
                    >
                      <PlusCircle size={24} />
                    </button>
                  </div>
                </div> */}
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Imagem do serviço</h4>

                  <div className="flex gap-2 flex-wrap">
                    {imagePreview ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-[var(--border)]">
                        <img
                          src={imagePreview}
                          alt="Imagem do serviço"
                          className="w-full h-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-1 right-1 bg-[var(--bg-dark)]/70 p-1 rounded-full text-white hover:bg-red-600 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <label
                          htmlFor="imageUpload"
                          className="flex items-center justify-center w-24 h-24 rounded-lg border border-[var(--border)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--bg-dark)]/20 transition"
                        >
                          <PlusCircle size={24} />
                        </label>

                        <input
                          id="imageUpload"
                          type="file"
                          accept="image/*"
                          onChange={ handleImageChange }
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>


                {/* --------------------------- Botão salvar --------------------------- */}
                <div className="mt-5 flex gap-3 justify-center">
                  <button
                    className="flex items-center justify-center gap-2 bg-[var(--primary)] text-white font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save size={18} />{saving ? "Salvando..." : hasService ? "Salvar Alterações" : "Criar Serviço"}
                  </button>
                  {serviceId && (
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
      className={`${isMobile ? mobileModalClass : "w-1/2 p-6"} md:ml-10 max-h-[90vh] bg-[var(--bg-light)] rounded-2xl shadow-lg border border-[var(--border)] `}
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
    {imagePreview && (
      <img
        src={imagePreview ? imagePreview : selectedService.imageUrl}
        alt={selectedService.title}
        className="w-full h-64 object-cover rounded-lg mb-4"
      />
    )}

      {/* --------------------------- Informações do serviço --------------------------- */}
      <div className="p-4 flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-[var(--primary)]">
          {selectedService.title}
        </h2>

        <p className="text-[var(--text-muted)] line-clamp-3">
          {selectedService.description_service}
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
            <span className="font-semibold text-[var(--text)]">Preço: R$</span>{" "}
            {selectedService.price || "-"}
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
            <span className="font-semibold text-[var(--text)]">Exige agendamento:</span>{" "}
            {selectedService.requiresScheduling ? "Sim" : "Não"}
          </div>
        </div>

        {/* --------------------------- Lista de imagens adicionais --------------------------- */}
        {imagePreview && (
          <div className="flex gap-2 mt-4 overflow-x-auto">
            <img
              src={imagePreview}
              alt="Preview da imagem"
              className="w-24 h-24 object-cover rounded-lg border border-[var(--border)]"
            />
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
