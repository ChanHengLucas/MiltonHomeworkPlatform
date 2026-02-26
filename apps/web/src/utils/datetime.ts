/**
 * Format epoch ms into "YYYY-MM-DDTHH:mm" for datetime-local input (local time).
 * Returns empty string if invalid.
 */
export function toDateTimeLocalValue(epochMs: number | null | undefined): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) return '';
  const d = new Date(epochMs);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Parse "YYYY-MM-DDTHH:mm" (datetime-local value) as local time into epoch ms.
 * Returns NaN if invalid.
 */
export function fromDateTimeLocalValue(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  const t = new Date(trimmed).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/**
 * Display epoch ms for cards, etc. Returns "No due date" if invalid.
 */
export function formatDueDate(epochMs: number | null | undefined): string {
  if (epochMs == null || !Number.isFinite(epochMs) || epochMs <= 0) return 'No due date';
  const d = new Date(epochMs);
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleString();
}
