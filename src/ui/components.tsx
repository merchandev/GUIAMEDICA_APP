import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, radius, TOUCH } from './theme';

/**
 * Componentes de la app: los mismos en todas las pantallas para que se vean y
 * se lean igual (tamaños táctiles de 48, etiquetas accesibles y textos que
 * crecen con la letra del teléfono).
 */

type Children = { children?: React.ReactNode };

export function Title({ children }: Children) {
  return (
    <Text accessibilityRole="header" style={s.title}>
      {children}
    </Text>
  );
}

export function Heading({ children }: Children) {
  return (
    <Text accessibilityRole="header" style={s.heading}>
      {children}
    </Text>
  );
}

export function Body({ children, center = false }: Children & { center?: boolean }) {
  return <Text style={[s.body, center && { textAlign: 'center' }]}>{children}</Text>;
}

export function Muted({ children, center = false }: Children & { center?: boolean }) {
  return <Text style={[s.muted, center && { textAlign: 'center' }]}>{children}</Text>;
}

export function Card({
  children,
  style,
  onPress,
  label,
}: Children & { style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (onPress)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }, style]}
      >
        {children}
      </Pressable>
    );
  return <View style={[s.card, style]}>{children}</View>;
}

/** Bloque con título (y una explicación corta) dentro de una pantalla. */
export function Section({
  title,
  description,
  children,
  right,
}: Children & { title: string; description?: string; right?: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Heading>{title}</Heading>
          {!!description && <Muted>{description}</Muted>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, wrap = true, style }: Children & { wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.row, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

type Tone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success' | 'gold' | 'info';
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.secondary, fg: colors.text },
  primary: { bg: colors.primarySoft, fg: colors.primary },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.successSoft, fg: colors.success },
  gold: { bg: colors.goldSoft, fg: colors.gold },
  info: { bg: colors.infoSoft, fg: colors.info },
};

export function Badge({ label, tone = 'primary' }: { label: string; tone?: Tone }) {
  return (
    <View style={[s.badge, { backgroundColor: TONES[tone].bg }]}>
      <Text style={[s.badgeText, { color: TONES[tone].fg }]}>{label}</Text>
    </View>
  );
}

/** Aviso de color: información, advertencia, error o éxito. */
export function Notice({ tone = 'info', title, children }: Children & { tone?: Tone; title?: string }) {
  return (
    <View
      accessibilityRole={tone === 'danger' || tone === 'warning' ? 'alert' : undefined}
      style={[s.notice, { backgroundColor: TONES[tone].bg }]}
    >
      {!!title && <Text style={[s.noticeTitle, { color: TONES[tone].fg }]}>{title}</Text>}
      {typeof children === 'string' ? (
        <Text style={[s.noticeText, { color: TONES[tone].fg }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={s.error}>
      {message}
    </Text>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  hint,
  small = false,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  small?: boolean;
}) {
  const off = disabled || loading;
  const fg =
    variant === 'primary' || variant === 'danger'
      ? colors.white
      : variant === 'ghost'
        ? colors.primary
        : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      accessibilityHint={hint}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        variant === 'secondary' && { backgroundColor: colors.secondary },
        variant === 'danger' && { backgroundColor: colors.danger },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        off && { opacity: 0.5 },
        pressed && !off && { opacity: 0.8 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  hint,
  error,
  secure = false,
  multiline = false,
  keyboardType,
  autoCapitalize = 'sentences',
  placeholder,
  maxLength,
  editable = true,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  error?: string | null;
  secure?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  placeholder?: string;
  maxLength?: number;
  editable?: boolean;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        secureTextEntry={secure}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        autoCapitalize={secure ? 'none' : autoCapitalize}
        autoComplete={autoComplete}
        maxLength={maxLength}
        editable={editable}
        style={[
          s.input,
          multiline && { minHeight: 110 },
          !!error && { borderColor: colors.danger },
          !editable && s.inputOff,
        ]}
      />
      {!!hint && !error && <Text style={s.hint}>{hint}</Text>}
      {!!error && <Text style={s.fieldError}>{error}</Text>}
    </View>
  );
}

export interface Option {
  value: string;
  label: string;
}

/** Lista de opciones en una hoja: toca la fila y elige. */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Elegir…',
  hint,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'sin elegir'}`}
        onPress={() => setOpen(true)}
        style={[s.input, s.select]}
      >
        <Text style={[s.selectText, !current && { color: colors.placeholder }]}>{current?.label ?? placeholder}</Text>
        <Text style={s.chevron}>▾</Text>
      </Pressable>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Cerrar">
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{label}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: o.value === value }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={[s.option, o.value === value && { backgroundColor: colors.primarySoft }]}
                >
                  <Text style={s.optionText}>{o.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[s.chipText, selected && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/** Varias opciones a la vez, como fichas. */
export function MultiSelect({
  label,
  values,
  options,
  onChange,
  hint,
}: {
  label: string;
  values: readonly string[];
  options: readonly Option[];
  onChange: (values: string[]) => void;
  hint?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.row, { flexWrap: 'wrap' }]}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={values.includes(o.value)}
            onPress={() =>
              onChange(values.includes(o.value) ? values.filter((v) => v !== o.value) : [...values, o.value])
            }
          />
        ))}
      </View>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

/** Casilla de verificación (aceptaciones y opciones de una lista). */
export function Check({
  label,
  value,
  onValueChange,
  description,
  children,
  disabled = false,
}: Children & {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <View style={[s.check, value && { borderColor: colors.accent }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value, disabled }}
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => onValueChange(!value)}
        style={s.checkRow}
      >
        <View style={[s.box, value && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          {value && <Text style={s.tick}>✓</Text>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.toggleLabel}>{label}</Text>
          {!!description && <Text style={s.hint}>{description}</Text>}
        </View>
      </Pressable>
      {children}
    </View>
  );
}

export function Toggle({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <View style={s.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {!!description && <Text style={s.hint}>{description}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.inputBorder }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Fecha (AAAA-MM-DD) u hora (HH:MM) con el selector del sistema. */
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  hint,
  placeholder = 'Elegir',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
  hint?: string;
  placeholder?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const current =
    mode === 'date'
      ? value
        ? new Date(`${value}T12:00:00`)
        : new Date()
      : value
        ? new Date(`2000-01-01T${value}:00`)
        : new Date('2000-01-01T08:00:00');
  const apply = (event: DateTimePickerEvent, picked?: Date) => {
    setIosOpen(false);
    if (event.type !== 'set' || !picked) return;
    onChange(mode === 'date' ? toDateKey(picked) : toTime(picked));
  };
  const open = () => {
    if (Platform.OS === 'android')
      DateTimePickerAndroid.open({ value: current, mode, is24Hour: false, minimumDate, maximumDate, onChange: apply });
    else setIosOpen(true);
  };
  const shown = !value
    ? placeholder
    : mode === 'date'
      ? new Intl.DateTimeFormat('es-VE', { dateStyle: 'long' }).format(current)
      : new Intl.DateTimeFormat('es-VE', { timeStyle: 'short' }).format(current);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        onPress={open}
        style={[s.input, s.select]}
      >
        <Text style={[s.selectText, !value && { color: colors.placeholder }]}>{shown}</Text>
        <Text style={s.chevron}>{mode === 'date' ? '📅' : '🕒'}</Text>
      </Pressable>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
      {iosOpen && (
        <DateTimePicker
          value={current}
          mode={mode}
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={apply}
        />
      )}
    </View>
  );
}

/** Fila de un menú o de una lista: toca para abrir. */
export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  danger = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={[s.itemTitle, danger && { color: colors.danger }]}>{title}</Text>
        {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
      </View>
      {right}
      {onPress && <Text style={s.chevron}>›</Text>}
    </>
  );
  if (!onPress) return <View style={s.item}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.background }]}
    >
      {content}
    </Pressable>
  );
}

/** Grupo de filas en una tarjeta (menús). */
export function List({ children }: Children) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={s.list}>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? s.separator : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Avatar({ uri, name, size = 56 }: { uri?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !broken)
    return <Image accessibilityIgnoresInvertColors source={{ uri }} style={box} onError={() => setBroken(true)} />;
  return (
    <View style={[box, s.initials]}>
      <Text style={[s.initialsText, { fontSize: size / 3 }]}>{initials}</Text>
    </View>
  );
}

export function Empty({ title, description, children }: Children & { title: string; description?: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      {!!description && <Muted center>{description}</Muted>}
      {children}
    </View>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={s.loading} accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <Muted>{label}</Muted>
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{value || '—'}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  title: { fontSize: 24, color: colors.heading, fontWeight: '700' },
  heading: { fontSize: 19, color: colors.heading, fontWeight: '700' },
  body: { fontSize: 15, color: colors.body, lineHeight: 23 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  notice: { borderRadius: radius.m, padding: 13, gap: 4 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
  noticeText: { fontSize: 14, lineHeight: 21 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: 13,
    borderRadius: radius.s,
    lineHeight: 21,
  },
  button: {
    minHeight: TOUCH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.m,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonSmall: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 12 },
  buttonText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  field: { gap: 6 },
  label: { fontSize: 14, color: colors.text, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  fieldError: { fontSize: 13, color: colors.danger, lineHeight: 19 },
  input: {
    minHeight: TOUCH,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.m,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputOff: { backgroundColor: colors.background, color: colors.muted },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectText: { flex: 1, fontSize: 16, color: colors.text },
  chevron: { fontSize: 18, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 30, 25, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 32,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.heading, marginBottom: 8 },
  option: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.s },
  optionText: { fontSize: 16, color: colors.text },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.white,
  },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TOUCH },
  toggleLabel: { fontSize: 15, color: colors.text, lineHeight: 21 },
  check: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.m,
    padding: 12,
    gap: 6,
    backgroundColor: colors.white,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 32 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tick: { color: colors.white, fontSize: 15, fontWeight: '800', lineHeight: 18 },
  list: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemTitle: { fontSize: 16, color: colors.text, fontWeight: '600' },
  initials: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: colors.primary, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 17, color: colors.heading, fontWeight: '700', textAlign: 'center' },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 36 },
  kv: { gap: 2 },
  kvLabel: { fontSize: 12, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  kvValue: { fontSize: 15, color: colors.text },
});
