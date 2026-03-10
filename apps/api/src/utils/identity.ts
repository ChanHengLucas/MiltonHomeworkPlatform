const MILTON_DOMAIN = '@milton.edu';
const STUDENT_LOCAL_PART = /^[a-z]+_[a-z]+\d{2}$/i;
const TEACHER_LOCAL_PART = /^[a-z]+_[a-z]+$/i;

function getLocalPart(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) return '';
  return trimmed.slice(0, atIndex);
}

export function isMiltonEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith(MILTON_DOMAIN)) return false;
  const local = getLocalPart(trimmed);
  return STUDENT_LOCAL_PART.test(local) || TEACHER_LOCAL_PART.test(local);
}

export function isStudentEmail(email: string): boolean {
  if (!isMiltonEmail(email)) return false;
  return STUDENT_LOCAL_PART.test(getLocalPart(email));
}

export function isTeacherEligible(email: string): boolean {
  if (!isMiltonEmail(email)) return false;
  return TEACHER_LOCAL_PART.test(getLocalPart(email));
}
