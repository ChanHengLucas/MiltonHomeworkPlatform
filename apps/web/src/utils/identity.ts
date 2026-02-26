/**
 * Student pattern: two digits before @milton.edu (e.g., something12@milton.edu)
 * Teacher/staff: milton.edu domain but NOT matching student pattern
 */
export function isStudentEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith('@milton.edu')) return false;
  const local = trimmed.slice(0, trimmed.indexOf('@'));
  return /\d{2}$/.test(local);
}

export function isTeacherEligible(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith('@milton.edu')) return false;
  return !isStudentEmail(trimmed);
}

export function displayNameFromEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return '';
  const local = trimmed.slice(0, trimmed.indexOf('@'));
  return local || '';
}
