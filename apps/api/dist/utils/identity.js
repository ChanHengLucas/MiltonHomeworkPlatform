"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMiltonEmail = isMiltonEmail;
exports.isStudentEmail = isStudentEmail;
exports.isTeacherEligible = isTeacherEligible;
const MILTON_DOMAIN = '@milton.edu';
const STUDENT_LOCAL_PART = /^[a-z]+_[a-z]+\d{2}$/i;
const TEACHER_LOCAL_PART = /^[a-z]+_[a-z]+$/i;
function getLocalPart(email) {
    const trimmed = email.trim().toLowerCase();
    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0)
        return '';
    return trimmed.slice(0, atIndex);
}
function isMiltonEmail(email) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(MILTON_DOMAIN))
        return false;
    const local = getLocalPart(trimmed);
    return STUDENT_LOCAL_PART.test(local) || TEACHER_LOCAL_PART.test(local);
}
function isStudentEmail(email) {
    if (!isMiltonEmail(email))
        return false;
    return STUDENT_LOCAL_PART.test(getLocalPart(email));
}
function isTeacherEligible(email) {
    if (!isMiltonEmail(email))
        return false;
    return TEACHER_LOCAL_PART.test(getLocalPart(email));
}
