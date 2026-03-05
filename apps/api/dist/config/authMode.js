"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebOriginFallback = getWebOriginFallback;
exports.getAuthModeInfo = getAuthModeInfo;
exports.getAuthMode = getAuthMode;
require("./env");
function trimEnv(name) {
    return (process.env[name] || '').trim();
}
function boolFromEnv(name) {
    const raw = trimEnv(name).toLowerCase();
    return raw === '1' || raw === 'true';
}
function inferDefaultCallbackUrl() {
    const port = trimEnv('PORT') || '4000';
    return `http://localhost:${port}/api/auth/google/callback`;
}
function getWebOriginFallback() {
    return trimEnv('WEB_ORIGIN') || trimEnv('FRONTEND_URL') || 'http://localhost:3000';
}
function getAuthModeInfo() {
    const nodeEnv = trimEnv('NODE_ENV') || 'development';
    const mockAuthOverride = nodeEnv !== 'production' && boolFromEnv('MOCK_AUTH');
    const detected = {
        googleClientId: Boolean(trimEnv('GOOGLE_CLIENT_ID')),
        googleClientSecret: Boolean(trimEnv('GOOGLE_CLIENT_SECRET')),
        googleCallbackUrl: Boolean(trimEnv('GOOGLE_CALLBACK_URL')),
        sessionSecret: Boolean(trimEnv('SESSION_SECRET')),
    };
    const googleConfigured = detected.googleClientId
        && detected.googleClientSecret
        && detected.googleCallbackUrl;
    const mode = nodeEnv === 'production'
        ? 'google'
        : (mockAuthOverride || !googleConfigured ? 'dev' : 'google');
    return {
        mode,
        nodeEnv,
        mockAuthOverride,
        detected,
        googleCallbackUrl: trimEnv('GOOGLE_CALLBACK_URL') || inferDefaultCallbackUrl(),
    };
}
function getAuthMode() {
    return getAuthModeInfo().mode;
}
