// ProviderHero.tsx — Hero institucional refatorado (responsivo)
// Dados reais do prestador: nota, avaliações, selo de conta verificada, status e disponibilidade.
// ------------------------------------------------------

import React, { lazy, Suspense, useEffect, useState } from "react";
import { providerApi } from "../../api/ProviderAPI";
import { getErrorMessage } from "../../utils/errors";
import { useToast } from "../Toast/ToastContext";
import OpenStatusChip from "./OpenStatusChip";
import EditableAvatar from "../Common/EditableAvatar";
import { useSession } from "../../context/SessionContext";
import VerifiedSeal from "./VerifiedSeal";
import { motion } from "framer-motion";
import type {
  DayKey,
  DayAvailability,
} from "../ProviderRegistration/ProviderRegistration/helpers/types-and-helpers";
import {
  Briefcase,
  Globe,
  Map,
  Clock,
  Star,
  Edit3,
} from "lucide-react";
import ServiceGallery from "../ServiceGallery/ServiceGallery/ServiceGallery";
// o cadastro de prestador traz o mapa (leaflet): só é baixado quando o formulário abre
const ProviderRegistrationContainer = lazy(() => import("../ProviderRegistration/ProviderRegistration/Principal/ProviderRegistrationContainer"));
import type { ProviderEntity } from "../../interfaces/Entities";
import type { ServiceData } from "../../api/ServiceAPI";
import { avatarFor } from "../../utils/avatar";
import ServiceAreaLine from "../ServiceAreaLine";

interface ProviderHeroProps {
  provider: ProviderEntity;
  /** Perfil público: sem edição; a galeria mostra os serviços recebidos */
  readOnly?: boolean;
  services?: ServiceData[];
  /** Muda (ex.: contador) para abrir a edição do perfil de fora (checklist do Business) */
  editRequest?: number;
  /** Business: pede para desativar a conta profissional (o botão aparece no modo edição) */
  onDeactivate?: () => void;
  /** Perfil público: botões de ação abaixo do "Sobre" (mesma posição dos botões da página inicial) */
  actions?: React.ReactNode;
}

export default function ProviderHero({ provider, readOnly = false, services, editRequest, onDeactivate, actions }: ProviderHeroProps) {
  const { refresh } = useSession();
  const { showToast } = useToast();

  // foto do perfil profissional: trocada direto pela foto, no modo edição
  const changePhoto = async (file: File) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const body = new FormData();
    body.append("image", file);
    try {
      await providerApi.update(body, token);
      await refresh();
      showToast("Foto do perfil profissional atualizada.", "success");
    } catch (e) {
      showToast(getErrorMessage(e, "Não foi possível trocar a foto."), "error");
    }
  };
  const NameHeading = readOnly ? "h1" : "h2";
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (editRequest) setIsEditing(true);
  }, [editRequest]);

  // Fecha com ESC
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsEditing(false);
    }

    if (isEditing) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isEditing]);

  const name = provider.companyName || provider.professionalName;
  const imageLink = avatarFor(provider.profileImageUrl, name);
  const rating = provider.rating ?? { average: 0, count: 0 };

  // disponibilidade vem da API como lista; o layout usa um mapa por dia
  const availability: Partial<Record<DayKey, DayAvailability>> = {};
  for (const a of provider.availabilities ?? []) availability[a.day as DayKey] = { start: a.start, end: a.end };

  const days: [DayKey, string][] = [
    ["monday", "Segunda"],
    ["tuesday", "Terça"],
    ["wednesday", "Quarta"],
    ["thursday", "Quinta"],
    ["friday", "Sexta"],
    ["saturday", "Sábado"],
    ["sunday", "Domingo"],
  ];

  const availabilityList = days.filter(([key]) => availability?.[key]);

  /* ------------------------------------------------------------------------
   * FUNÇÕES DE EDIÇÃO
   * ------------------------------------------------------------------------ */
  const handleEditToggle = () => {
    setIsEditing((prev) => !prev);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mt-4 md:mt-2 mb-8 md:mb-10 bg-[var(--bg-dark)] md:px-4 py-6 text-[var(--text)] "
    >
      {/* HEADER */}
      {/* hero centralizado na página */}
      <div className="flex justify-center">
        <div className="flex flex-col sm:flex-row gap-5 lg:gap-10 min-w-0">
          {/* foto e a situação de atendimento: no desktop a ficha desce até a base dos botões */}
          <div className="flex flex-col items-center gap-3 shrink-0 sm:self-stretch sm:justify-between">
          <div className="relative">
            {/* Avatar / Logo */}
            <div className="w-72 h-72 sm:w-40 sm:h-40 lg:w-72 lg:h-72 rounded-full bg-[var(--bg)] border-4 border-[var(--primary)] flex items-center justify-center shrink-0 mx-auto sm:mx-0">
              <EditableAvatar
                src={imageLink}
                alt={`Foto de ${name}`}
                editing={!readOnly && isEditing}
                onPick={changePhoto}
                className="w-full h-full rounded-full object-cover text-[var(--primary)]"
              />
            </div>
            {/* BOTÃO DE EDIÇÃO */}
            {!readOnly && (
            <button
              onClick={handleEditToggle}
              aria-label="Editar perfil de prestador"
              className="absolute bottom-1 right-3 md:right-0 bg-[var(--primary)] text-white rounded-full p-2"
              title="Editar perfil"            >
              <Edit3 size={18} />
            </button>
            )}
          </div>
            <div className="flex flex-col items-center gap-2 max-w-72">
              <OpenStatusChip provider={provider} editable={!readOnly} onChanged={refresh} />
              {!!provider.lateCancellations && (
                <span
                  className="px-3 py-1 rounded-full text-xs sm:text-sm border border-amber-500/40 bg-amber-500/10 text-amber-500 text-center"
                  title="Cancelamentos de pedidos aceitos depois do prazo, nos últimos 12 meses"
                >
                  {provider.lateCancellations} cancelamento(s) em cima da hora
                </span>
              )}
            </div>
          </div>
          {/* Info principal */}
          <div className="flex items-center md:items-start  flex-col gap-2">
            <div className="flex flex-col md:flex-row sm:items-center gap-2 sm:gap-3">
              {/* no perfil público o nome é o título principal da página (h1) */}
              <NameHeading className="text-4xl sm:text-4xl font-semibold leading-tight inline-flex items-center gap-2">
                {name}
                {provider.verified && <VerifiedSeal />}
              </NameHeading>
              {/* mesmo lugar do "Excluir Usuário" da Home: só no modo edição */}
              {!readOnly && isEditing && onDeactivate && (
                <button className="px-2 py-2 text-md bg-red-700 rounded-md text-white whitespace-nowrap" onClick={onDeactivate}>
                  Desativar perfil profissional
                </button>
              )}
              <div className="flex items-center gap-1 text-yellow-400 text-sm">
                <Star size={16} fill={rating.count > 0 ? "currentColor" : "none"} />
                <span className="font-semibold">{rating.count > 0 ? rating.average.toFixed(1) : "Novo"}</span>
                <span className="text-[var(--text-muted)]">
                  ({rating.count} {rating.count === 1 ? "avaliação" : "avaliações"})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Briefcase className="w-4 h-4 text-[var(--primary)]" />
              <span>
                {provider.category
                  ? provider.category.name
                  : "Categoria não informada"}
              </span>
            </div>
            {/* experiência na plataforma (dados reais) */}
            {readOnly && (provider.memberSince || (provider.completedHires ?? 0) > 0) && (
              <p className="text-sm text-[var(--text-muted)]">
                {provider.memberSince && <>No Hire desde {new Date(provider.memberSince).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</>}
                {provider.memberSince && (provider.completedHires ?? 0) > 0 && " · "}
                {(provider.completedHires ?? 0) > 0 && <>{provider.completedHires} serviço(s) concluído(s) pelo Hire</>}
              </p>
            )}
            {/* área de atendimento */}
            <ServiceAreaLine full service={{ provider: { baseCity: provider.baseCity, baseState: provider.baseState, attendsOnline: provider.attendsOnline, serviceRadiusKm: provider.baseCity ? provider.serviceRadiusKm : undefined } }} />

            <h2 className="mt-2 md:ml-6 text-[var(--text)]">
              Sobre
            </h2>
            {provider.description && (
              <p className="mt-3 md:ml-6  max-w-2xl text-sm text-[var(--text-muted)] leading-relaxed">
                {provider.description}
              </p>
            )}

            {(provider.subcategories?.length ?? 0) > 0 && (
              <div className="flex md:ml-6 flex-wrap gap-2 mt-2">
                {provider.subcategories!.map(
                  (sub: { id: number; name: string }, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 text-xs rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20"
                    >
                      {sub.name}
                    </span>
                  )
                )}
              </div>
            )}
            {actions && <div className="flex flex-wrap sm:flex-nowrap gap-3 md:ml-6 mt-6 [&>*]:whitespace-nowrap">{actions}</div>}
          </div>
        </div>

      </div>

      {/* contato direto: só quando o prestador escolheu mostrar */}
      {readOnly && provider.showContact && (provider.professionalPhone || provider.professionalEmail) && (
        <div className="mt-8 flex flex-wrap gap-2 text-sm">
          {provider.professionalPhone && (
            <a
              href={`https://wa.me/55${provider.professionalPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--primary)]"
            >
              WhatsApp {provider.professionalPhone}
            </a>
          )}
          {provider.professionalEmail && (
            <a href={`mailto:${provider.professionalEmail}`} className="px-3 py-2 rounded-lg border border-[var(--border)] hover:border-[var(--primary)]">
              {provider.professionalEmail}
            </a>
          )}
        </div>
      )}

      {/* MODELO DE ATENDIMENTO */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-24">
        <InfoCard
          icon={<Globe />}
          label="Atendimento Online"
          value={provider.attendsOnline ? "Disponível" : "—"}
        />
        <InfoCard
          icon={<Map />}
          label="Atendimento Presencial"
          value={provider.attendsPresent ? "Disponível" : "—"}
        />
        <InfoCard
          icon={<Clock />}
          label="Agenda"
          value={availabilityList.length > 0 ? "Semanal" : "Sob consulta"}
        />
        <InfoCard
          icon={<Briefcase />}
          label="Propostas"
          value={provider.personalizedProposals ? "Flexíveis" : "Escopo fixo"}
        />
      </div>

      {/* DISPONIBILIDADE */}
      <div className="mt-6">
        <div className="text-sm font-medium text-[var(--text-highlight)] mb-2">
          Disponibilidade semanal
        </div>

        {availabilityList.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availabilityList.map(([key, label]) => {
              const slot = availability?.[key];
              if (!slot) return null;
              return (
                <div
                  key={key}
                  className="flex justify-between text-xs bg-[var(--bg)] border border-[var(--border)] px-3 py-2 rounded-lg"
                >
                  <span className="font-medium">{label}</span>
                  <span>
                    {slot.start} — {slot.end}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">
            Nenhuma disponibilidade informada
          </div>
        )}
      </div>
       {isEditing&&(<div className=""><Suspense fallback={null}><ProviderRegistrationContainer isOpen={isEditing} existing={provider} onClose={()=>setIsEditing(false)}/></Suspense></div>)}
      {!isEditing && (readOnly
        ? <div id="servicos" className="scroll-mt-24">
            {(services ?? []).length === 0
              ? <p className="mt-8 text-sm text-[var(--text-muted)]">Este profissional ainda não publicou serviços. Você pode conversar com ele para pedir um orçamento.</p>
              : <ServiceGallery services={services ?? []} noEdit title="Serviços" />}
          </div>
        : <ServiceGallery />)}
    </motion.section>
  );
}

/* ---------------- Subcomponentes ---------------- */

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-3 flex flex-col items-center justify-center">
      <div className="flex items-center gap-1 text-[var(--text-muted)] mb-1">
        {React.cloneElement(icon, {
          className: "w-4 h-4 text-[var(--primary)]",
        })}
        <span className="text-xs">{label}</span>
      </div>
      <div className="font-medium text-[var(--text-highlight)] text-sm">{value}</div>
    </div>
  );
}

export function StatusLine({
  icon,
  text,
  highlight,
}: {
  icon: React.ReactElement<{ className?: string }>;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center flex-shrink-0">
        {React.cloneElement(icon, {
          className: "w-3.5 h-3.5 text-[var(--primary)]",
        })}
      </div>
      <span
        className={`text-sm ${
          highlight
            ? "font-medium text-[var(--text-highlight)]"
            : "text-[var(--text-muted)]"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
