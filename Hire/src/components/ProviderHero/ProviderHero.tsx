// ProviderHero.tsx — Hero institucional refatorado (responsivo)
// Dados reais do prestador: nota, avaliações, nível, status e disponibilidade.
// ------------------------------------------------------

import React, { lazy, Suspense, useEffect, useState } from "react";
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

interface ProviderHeroProps {
  provider: ProviderEntity;
  /** Perfil público: sem edição; a galeria mostra os serviços recebidos */
  readOnly?: boolean;
  services?: ServiceData[];
}

export default function ProviderHero({ provider, readOnly = false, services }: ProviderHeroProps) {
  const [isEditing, setIsEditing] = useState(false);

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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="relative">
            {/* Avatar / Logo */}
            <div className="w-72 h-72 sm:w-40 sm:h-40   md:ml-40 lg:w-72 lg:h-72 rounded-full bg-[var(--bg)] border-4 border-[var(--primary)] flex items-center justify-center shrink-0 mx-auto sm:mx-0">
              <img
                src={imageLink}
                alt={`Foto de ${name}`}
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
          {/* Info principal */}
          <div className="flex items-center md:items-start  flex-col gap-2">
            <div className="flex flex-col md:flex-row sm:items-center gap-2 sm:gap-3">
              <h2 className="text-4xl sm:text-4xl font-semibold leading-tight">
                {name}
              </h2>
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
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
          <span
            className={`px-3 py-1 rounded-full text-xs sm:text-sm border ${
              provider.status === "available"
                ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30"
                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
            }`}
          >
            {provider.status === "available" ? "Aberto" : "Agenda fechada"}
          </span>

          <span
            className="px-3 py-1 rounded-full text-xs sm:text-sm border border-[var(--border)]"
            title={`${provider.completedHires ?? 0} serviço(s) concluído(s)`}
          >
            Nível {provider.level ?? "Iniciante"}
          </span>
        </div>
      </div>

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
        ? <ServiceGallery services={services ?? []} noEdit title="Serviços" />
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
