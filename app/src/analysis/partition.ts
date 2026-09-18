export function partitionItems<T>(items: T[], n: number): T[][] {
  const k = Math.max(1, Math.min(n, Math.max(1, items.length)));
  const out: T[][] = Array.from({ length: k }, () => []);
  items.forEach((item, i) => {
    out[i % k].push(item);
  });
  return out.filter((chunk) => chunk.length > 0);
}

export function mergeHours(parts: Float32Array[]): Float32Array {
  if (parts.length === 0) return new Float32Array(0);
  const hours = new Float32Array(parts[0].length);
  for (const part of parts) {
    if (part.length !== hours.length) {
      throw new Error('sun hours chunk length mismatch');
    }
    for (let i = 0; i < hours.length; i++) hours[i] += part[i];
  }
  return hours;
}
