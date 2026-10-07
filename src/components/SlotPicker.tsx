import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { OfflineError } from '../api';
import { addMonths, caracasDateKey, capitalizeFirst, dayLabel, formatTime, monthLabel, monthRange } from '../dates';
import { useRealtimeRefresh, useWatchProfessional } from '../realtime';
import { Chip, colors, Muted, Notice, radius, Row, TOUCH } from '../ui';

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/**
 * Elegir día en un calendario de mes y luego la hora (como en la web). Pide
 * los horarios libres del mes a la vista; los días sin horarios quedan
 * apagados. Si otra persona toma un horario o el médico cambia su horario, la
 * lista se actualiza sola.
 */
export function SlotPicker({
  loadSlots,
  selectedSlot,
  onSelectSlot,
  monthsAhead = 6,
  professionalId,
}: {
  /** Horarios libres (instantes ISO) entre dos días «AAAA-MM-DD». */
  loadSlots: (from: string, to: string) => Promise<string[]>;
  selectedSlot: string | null;
  onSelectSlot: (slot: string | null) => void;
  monthsAhead?: number;
  professionalId?: string | null;
}) {
  const [today] = useState(() => caracasDateKey(Date.now()));
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [day, setDay] = useState<string | null>(null);
  const [result, setResult] = useState<{ month: string; slots: string[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [taken, setTaken] = useState(false);
  // Siete columnas exactas: un ancho en porcentaje se redondea y la séptima salta de línea.
  const [gridWidth, setGridWidth] = useState(0);
  const cellSize = gridWidth
    ? { width: Math.floor(gridWidth / 7) }
    : { width: `${Math.floor(1000 / 7) / 10}%` as const };

  useWatchProfessional(professionalId);
  useRealtimeRefresh(['availability', 'appointments', 'schedule'], () => setVersion((v) => v + 1));

  const selected = useRef(selectedSlot);
  const select = useRef(onSelectSlot);
  useEffect(() => {
    selected.current = selectedSlot;
    select.current = onSelectSlot;
  });

  useEffect(() => {
    let active = true;
    const { first, last } = monthRange(month);
    setFailed(null);
    loadSlots(first < today ? today : first, last).then(
      (slots) => {
        if (!active) return;
        setResult({ month, slots });
        const chosen = selected.current;
        if (version > 0 && chosen && caracasDateKey(chosen).startsWith(month) && !slots.includes(chosen)) {
          select.current(null);
          setTaken(true);
        }
      },
      (e) => {
        if (!active) return;
        setFailed(
          e instanceof OfflineError
            ? 'Sin conexión: los horarios libres solo se ven con internet (cambian a cada momento).'
            : 'No se pudieron cargar los horarios. Tira hacia abajo para intentar de nuevo.',
        );
      },
    );
    return () => {
      active = false;
    };
  }, [month, today, loadSlots, version]);

  const loading = !failed && result?.month !== month;
  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    if (result?.month === month)
      for (const slot of result.slots) {
        const key = caracasDateKey(slot);
        map.set(key, [...(map.get(key) ?? []), slot]);
      }
    return map;
  }, [result, month]);

  const { first, last } = monthRange(month);
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: Number(last.slice(8)) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);
  const canPrev = month > thisMonth;
  const canNext = month < addMonths(thisMonth, monthsAhead);

  const changeMonth = (next: string) => {
    setMonth(next);
    setDay(null);
    setTaken(false);
    onSelectSlot(null);
  };
  const daySlots = day ? (byDay.get(day) ?? []) : [];

  return (
    <View style={{ gap: 12 }}>
      <View style={s.calendar} accessibilityLabel="Calendario">
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
            disabled={!canPrev}
            onPress={() => changeMonth(addMonths(month, -1))}
            style={[s.nav, !canPrev && { opacity: 0.3 }]}
          >
            <Text style={s.navText}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={s.month}>
            {capitalizeFirst(monthLabel(month))}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            disabled={!canNext}
            onPress={() => changeMonth(addMonths(month, 1))}
            style={[s.nav, !canNext && { opacity: 0.3 }]}
          >
            <Text style={s.navText}>›</Text>
          </Pressable>
        </View>
        <View style={s.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={[s.weekday, cellSize]}>
              {w}
            </Text>
          ))}
          {cells.map((key, i) => {
            if (!key) return <View key={`empty-${i}`} style={[s.cell, cellSize]} />;
            const free = byDay.has(key);
            const isSelected = key === day;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(key)}${free ? ', con horarios libres' : ', sin horarios'}`}
                accessibilityState={{ disabled: !free, selected: isSelected }}
                disabled={!free}
                onPress={() => {
                  setDay(key);
                  setTaken(false);
                  onSelectSlot(null);
                }}
                style={[s.cell, cellSize]}
              >
                <View style={[s.dayBox, free && s.dayFree, isSelected && s.daySelected]}>
                  <Text
                    style={[s.dayText, !free && s.dayOff, free && s.dayFreeText, isSelected && { color: colors.white }]}
                  >
                    {Number(key.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {loading && (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </View>
      <Muted>Los días resaltados tienen horarios libres. Las horas son de Caracas.</Muted>
      {!!failed && <Notice tone="warning">{failed}</Notice>}
      {taken && <Notice tone="warning">El horario que elegiste se acaba de ocupar. Elige otro.</Notice>}
      {!loading && !failed && byDay.size === 0 && (
        <Muted>No hay horarios libres este mes. Prueba con el siguiente.</Muted>
      )}
      {day && (
        <View style={{ gap: 8 }}>
          <Text style={s.dayTitle}>{capitalizeFirst(dayLabel(day))}</Text>
          <Row>
            {daySlots.map((slot) => (
              <Chip
                key={slot}
                label={formatTime(slot)}
                selected={selectedSlot === slot}
                onPress={() => {
                  setTaken(false);
                  onSelectSlot(slot);
                }}
              />
            ))}
          </Row>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  calendar: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, color: colors.primary, fontWeight: '600' },
  month: { fontSize: 17, fontWeight: '700', color: colors.heading },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { textAlign: 'center', fontSize: 12, color: colors.muted, paddingVertical: 4 },
  cell: { aspectRatio: 1, padding: 3, minHeight: 40 },
  dayBox: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayFree: { backgroundColor: colors.primarySoft },
  daySelected: { backgroundColor: colors.primary },
  dayText: { fontSize: 15, color: colors.text },
  dayOff: { color: colors.placeholder, opacity: 0.6 },
  dayFreeText: { color: colors.primary, fontWeight: '700' },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  loading: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
});
