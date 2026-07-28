// lib/auth.js
// Autenticação simples baseada em cookies de sessão assinados.
// Sem dependências externas: usa apenas o módulo "crypto" nativo do Node.

const crypto = require("crypto");

const SESSION_COOKIE = "drip_sid";
const ADMIN_COOKIE = "drip_admin_sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// Sessões guardadas em memória. Em um restart do processo os usuários
// precisam logar novamente. Para uma loja pequena isso é aceitável;
// para escalar, trocar por uma store persistente (ex: Redis).
const sessions = new Map(); // token -> { userId, expires }
const adminSessions = new Map(); // token -> { expires }

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createSession(userId) {
  const token = newToken();
  sessions.set(token, { userId, expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function destroySession(token) {
  sessions.delete(token);
}

function createAdminSession() {
  const token = newToken();
  adminSessions.set(token, { expires: Date.now() + SESSION_TTL_MS });
  return token;
}

function getAdminSession(token) {
  if (!token) return null;
  const s = adminSessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return s;
}

function destroyAdminSession(token) {
  adminSessions.delete(token);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    out[key] = val;
  });
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push("Path=/");
  parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.expiresNow) parts.push("Max-Age=0");
  const existing = res.getHeader("Set-Cookie");
  const cookieStr = parts.join("; ");
  if (existing) {
    res.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookieStr] : [existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", cookieStr);
  }
}

function clearCookie(res, name) {
  setCookie(res, name, "", { expiresNow: true });
}

module.exports = {
  SESSION_COOKIE,
  ADMIN_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  createAdminSession,
  getAdminSession,
  destroyAdminSession,
  parseCookies,
  setCookie,
  clearCookie,
};
