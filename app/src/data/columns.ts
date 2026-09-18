import columnConfig from '../../config/building-columns.json';

export function pickColumn(
  props: Record<string, unknown>,
  names: string[],
): unknown {
  for (const name of names) {
    const value = props[name];
    if (value != null && value !== '') return value;
  }
  return undefined;
}

export function pickMapped(
  props: Record<string, unknown>,
  key: keyof typeof columnConfig,
): unknown {
  return pickColumn(props, columnConfig[key]);
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function toText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}
