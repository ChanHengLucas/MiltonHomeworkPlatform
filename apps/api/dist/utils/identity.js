"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStudentEmail = isStudentEmail;
exports.isTeacherEligible = isTeacherEligible;
/**
 * Student pattern: two digits before @milton.edu (e.g., something12@milton.edu)
 * Teacher/staff: milton.edu domain but NOT matching student pattern
 */
function isStudentEmail(email) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith('@milton.edu'))
        return false;
    const local = trimmed.slice(0, trimmed.indexOf('@'));
    return /\d{2}$/.test(local);
}
function isTeacherEligible(email) {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith('@milton.edu'))
        return false;
    return !isStudentEmail(trimmed);
}
