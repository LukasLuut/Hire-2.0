import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, Calendar, Clock } from 'lucide-react';
import type { ScheduleSlots } from '../interfaces/Entities';

/*
  ScheduleConfiguratorAdvanced.tsx
  ----------------------------------
  - Duração média sempre visível com odômetro animado
  - Agenda expansível com dias e time slots
  - Preview completo com cores por tipo de serviço
  - Micro-animações para interações
  - Responsivo para mobile e tablets

  Componente controlado: o assistente de criação e o editor de serviço guardam
  duração, uso da agenda e horários, que vão para a API.
*/

type DayKey = keyof ScheduleSlots;

export const WEEK: { key: DayKey; short: string; name: string }[] = [
  { key: 'monday', short: 'Seg', name: 'Segunda' },
  { key: 'tuesday', short: 'Ter', name: 'Terça' },
  { key: 'wednesday', short: 'Qua', name: 'Quarta' },
  { key: 'thursday', short: 'Qui', name: 'Quinta' },
  { key: 'friday', short: 'Sex', name: 'Sexta' },
  { key: 'saturday', short: 'Sáb', name: 'Sábado' },
  { key: 'sunday', short: 'Dom', name: 'Domingo' },
];
// índice de Date.getDay() (0 = domingo) → chave do dia
const DAY_BY_INDEX: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Horários de início oferecidos em cada dia (a cada 2 horas, como no protótipo). */
export const SLOT_TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

const units = ['min', 'h', 'd', 'sem'];
const unitMultipliers = [1, 60, 60*24, 60*24*7];
const unitWords: [string, string][] = [['minuto', 'minutos'], ['hora', 'horas'], ['dia', 'dias'], ['semana', 'semanas']];
const serviceColors: Record<string, string> = {
  mecanica: 'bg-red-500',
  limpeza: 'bg-green-500',
  tecnologia: 'bg-blue-500',
  construcao: 'bg-orange-500',
  manutencao: 'bg-indigo-500',
  saude: 'bg-pink-500'
};

/** Cor dos horários pelo nome da categoria (sem acento, por palavra-chave). */
function colorFor(serviceType: string) {
  const t = serviceType.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/mecan|auto/.test(t)) return serviceColors.mecanica;
  if (/limp/.test(t)) return serviceColors.limpeza;
  if (/reform|constru|obra/.test(t)) return serviceColors.construcao;
  if (/manut|repar|eletric|hidraul/.test(t)) return serviceColors.manutencao;
  if (/saude|estetic|beleza/.test(t)) return serviceColors.saude;
  return serviceColors.tecnologia;
}

/** "2 horas" → { value: 2, unitIndex: 1 }; texto livre cai em 1 hora. */
export function parseDuration(text: string): { value: number; unitIndex: number } {
  const m = text.trim().toLowerCase().match(/^(\d+)\s*(min|minutos?|h|horas?|d|dias?|sem|semanas?)\b/);
  if (!m) return { value: 1, unitIndex: 1 };
  const u = m[2];
  const unitIndex = u.startsWith('min') ? 0 : u.startsWith('h') ? 1 : u.startsWith('d') ? 2 : 3;
  return { value: Math.max(1, Number(m[1])), unitIndex };
}

export function formatDuration(value: number, unitIndex: number) {
  const [one, many] = unitWords[unitIndex];
  return `${value} ${value === 1 ? one : many}`;
}

export default function ScheduleConfiguratorAdvanced({
  serviceType = 'tecnologia',
  duration,
  onDurationChange,
  useSchedule,
  onUseScheduleChange,
  slots,
  onSlotsChange,
  cancellationNotice,
  onCancellationNoticeChange,
}: {
  serviceType?: string;
  duration: string;
  onDurationChange: (text: string) => void;
  useSchedule: boolean;
  onUseScheduleChange: (value: boolean) => void;
  slots: ScheduleSlots;
  onSlotsChange: (slots: ScheduleSlots) => void;
  cancellationNotice?: string;
  onCancellationNoticeChange?: (text: string) => void;
}) {
  const selectedCount = WEEK.reduce((n, d) => n + (slots[d.key]?.length ?? 0), 0);

  return (
    <div className="flex flex-col items-center text-[var(--text)]">
      <div className="w-full space-y-6">

        {/* Duração média */}
        <DurationPicker value={duration} onChange={onDurationChange} />

        {/* Habilitar agenda */}
        <motion.button
          type="button"
          layout
          role="switch"
          aria-checked={useSchedule}
          className={`w-full p-4 rounded-2xl cursor-pointer transition text-left ${useSchedule ? 'bg-blue-600 text-white' : 'bg-[var(--bg-light)] text-[var(--text-muted)]'}`}
          onClick={() => onUseScheduleChange(!useSchedule)}
        >
          <div className="flex items-center justify-between">
            <span>Utilizar agenda para este serviço?</span>
            <span>{useSchedule ? 'Sim' : 'Não'}</span>
          </div>
        </motion.button>

        {/* Agenda detalhada */}
        {useSchedule && (
          <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} transition={{duration:0.3}} className="space-y-6">
            <p className="text-sm text-[var(--text-muted)]">Toque nos horários em que o cliente pode marcar o início do serviço.</p>
            <SlotGrid slots={slots} onChange={onSlotsChange} serviceType={serviceType} />

            {onCancellationNoticeChange && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Prazo para cancelamento</span>
                <input
                  type="text"
                  value={cancellationNotice ?? ''}
                  placeholder="Ex: até 24h antes"
                  onChange={(e) => onCancellationNoticeChange(e.target.value)}
                  className="border rounded p-2 border-[var(--border)] bg-[var(--bg-light)] text-[var(--text)]"
                />
              </label>
            )}

            {/* Preview completo */}
            <motion.div className="p-4 rounded-2xl bg-[var(--bg-light)]/40 border border-[var(--border)] backdrop-blur-md shadow-sm">
              <div className="flex items-center gap-2 mb-2"><Calendar className="size-5 text-blue-400" /><span className="text-sm font-medium">Preview da agenda</span></div>
              <div className="text-sm text-[var(--text-muted)] space-y-1">
                {selectedCount === 0 && <div>Nenhum horário escolhido ainda.</div>}
                {WEEK.map(({ key, short }) => {
                  const selected = slots[key] ?? [];
                  return selected.length > 0 ? <div key={key}><strong>{short}:</strong> {selected.join(', ')}</div> : null;
                })}
              </div>
            </motion.div>

          </motion.div>
        )}

      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * DurationPicker — odômetro da duração média (usado no assistente e no editor)
 * -------------------------------------------------------------------------- */
export function DurationPicker({ value, onChange, compact = false }: { value: string; onChange: (text: string) => void; compact?: boolean }) {
  const { value: durationValue, unitIndex } = parseDuration(value);

  const increment = () => {
    // minutos andam de 15 em 15; ao completar a unidade seguinte, troca (60 min → 1 h, 24 h → 1 d, 7 d → 1 sem)
    const next = durationValue + (unitIndex === 0 ? 15 : 1);
    const minutes = next * unitMultipliers[unitIndex];
    if (unitIndex < units.length - 1 && minutes >= unitMultipliers[unitIndex + 1] && minutes % unitMultipliers[unitIndex + 1] === 0) {
      onChange(formatDuration(minutes / unitMultipliers[unitIndex + 1], unitIndex + 1));
    } else {
      onChange(formatDuration(next, unitIndex));
    }
  };

  const decrement = () => {
    if (durationValue <= 1 && unitIndex > 0) {
      // 1 h → 45 min, 1 dia → 23 h, 1 semana → 6 dias
      const lower = unitIndex - 1;
      const inLower = unitMultipliers[unitIndex] / unitMultipliers[lower];
      onChange(formatDuration(lower === 0 ? 45 : inLower - 1, lower));
    } else {
      const step = unitIndex === 0 ? 15 : 1;
      onChange(formatDuration(Math.max(unitIndex === 0 ? 15 : 1, durationValue - step), unitIndex));
    }
  };

  return (
    <motion.div className={`${compact ? "p-3 rounded-xl" : "p-6 rounded-3xl"} bg-[var(--bg-light)]/20 backdrop-blur-xl border border-[var(--border)] shadow-lg`}>
      <div className={`flex items-center justify-center gap-4 ${compact ? "mb-2" : "mb-4"}`}>
        <Clock className={compact ? "size-5 text-blue-400" : "size-6 text-blue-400"} />
        <span className={compact ? "text-sm font-medium" : "text-lg font-medium"}>Duração média do serviço</span>
      </div>
      <div className="flex items-center justify-center gap-6">
        <button type="button" onClick={decrement} aria-label="Diminuir duração" className="px-4 py-2 rounded-lg bg-[var(--bg-light)] hover:brightness-110 transition"><Minus className="size-5" /></button>
        <motion.div key={value} animate={{ scale: [1,1.1,1] }} className={compact ? "text-2xl font-bold" : "text-3xl font-bold"} aria-live="polite">{durationValue}</motion.div>
        <span className="text-xl font-medium">{units[unitIndex]}</span>
        <button type="button" onClick={increment} aria-label="Aumentar duração" className="px-4 py-2 rounded-lg bg-[var(--bg-light)] hover:brightness-110 transition"><Plus className="size-5" /></button>
      </div>
    </motion.div>
  );
}

/* --------------------------------------------------------------------------
 * SlotGrid — dias da semana × horários de início (usado no assistente e no editor)
 * -------------------------------------------------------------------------- */
export function SlotGrid({ slots, onChange, serviceType = 'tecnologia' }: { slots: ScheduleSlots; onChange: (slots: ScheduleSlots) => void; serviceType?: string }) {
  const slotColor = colorFor(serviceType);
  const toggleSlot = (day: DayKey, time: string) => {
    const current = slots[day] ?? [];
    const next = current.includes(time) ? current.filter((t) => t !== time) : [...current, time].sort();
    onChange({ ...slots, [day]: next });
  };
  return (
    <div className="space-y-3">
      {WEEK.map(day => (
        <div key={day.key} className="rounded-2xl bg-[var(--bg-light)]/40 border border-[var(--border)] p-4 backdrop-blur-md">
          <div className="text-sm font-medium mb-2 flex items-center gap-2"><Calendar className="size-5 text-blue-400" />{day.name}</div>
          <div className="flex flex-wrap gap-2">
            {SLOT_TIMES.map(time => {
              const on = slots[day.key]?.includes(time) ?? false;
              return (
                <button type="button" key={time} onClick={() => toggleSlot(day.key, time)} aria-pressed={on} aria-label={`${day.name} ${time}`}
                  className={`px-3 py-2 rounded-lg text-sm transition ${on ? slotColor+' text-white' : 'bg-[var(--bg-light)] text-[var(--text-muted)]'} hover:scale-105`}>
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * SlotPicker — o cliente escolhe um horário da agenda do serviço
 * Mostra as próximas duas semanas, sem horários passados ou já reservados.
 * O valor é "AAAA-MM-DDTHH:mm" no horário local.
 * -------------------------------------------------------------------------- */
const pad = (n: number) => String(n).padStart(2, '0');
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function SlotPicker({
  slots,
  booked,
  value,
  onChange,
  days = 14,
}: {
  slots: ScheduleSlots | null;
  booked: string[];
  value: string | null;
  onChange: (value: string) => void;
  days?: number;
}) {
  const options = useMemo(() => {
    const taken = new Set(booked.map((b) => localKey(new Date(b))));
    const now = Date.now();
    const list: { date: Date; times: string[] }[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + i);
      const times = (slots?.[DAY_BY_INDEX[date.getDay()]] ?? []).filter((t) => {
        const [h, m] = t.split(':').map(Number);
        const at = new Date(date);
        at.setHours(h, m);
        return at.getTime() > now && !taken.has(localKey(at));
      });
      if (times.length) list.push({ date, times });
    }
    return list;
  }, [slots, booked, days]);

  if (options.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">Nenhum horário livre nas próximas semanas. Envie uma mensagem ao prestador.</p>;
  }

  return (
    <div className="space-y-3 max-h-56 overflow-y-auto pr-1" role="radiogroup" aria-label="Horário de início">
      {options.map(({ date, times }) => (
        <div key={date.toISOString()}>
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
            <Calendar size={12} />
            {date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
          </div>
          <div className="flex flex-wrap gap-2">
            {times.map((t) => {
              const key = `${localKey(date).slice(0, 10)}T${t}`;
              const on = value === key;
              return (
                <button
                  type="button"
                  key={key}
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${on ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-light)] text-[var(--text)] hover:brightness-110'}`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
