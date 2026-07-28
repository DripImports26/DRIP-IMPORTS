// server.js
// Servidor da Drip Imports - Node.js puro (sem frameworks), pronto para produção.
// Responsável por: servir o site, API de produtos, cadastro/login de clientes,
// carrinho -> pedido -> checkout InfinitePay (Pix e cartão), painel admin.

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");

// ---- Carrega variáveis do .env (implementação simples, sem dependências) ----
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  });
}
loadEnv();

const db = require("./lib/db");
const auth = require("./lib/auth");
const infinitepay = require("./lib/infinitepay");

db.ensureFiles();

const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

// -------------------- Helpers --------------------

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), { "Content-Type": "application/json; charset=utf-8" });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, content) => {
    if (err) {
      send(res, 404, "Não encontrado");
      return;
    }
    send(res, 200, content, { "Content-Type": type, "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600" });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    const MAX = 2 * 1024 * 1024; // 2MB
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX) {
        reject(new Error("Corpo da requisição muito grande"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function safeJoin(base, target) {
  const targetPath = path.normalize(path.join(base, target));
  if (!targetPath.startsWith(base)) return null;
  return targetPath;
}

async function getCurrentUser(req) {
  const cookies = auth.parseCookies(req);
  const session = auth.getSession(cookies[auth.SESSION_COOKIE]);
  if (!session) return null;
  const users = await db.all("users");
  const user = users.find((u) => u.id === session.userId);
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function isAdminRequest(req) {
  const cookies = auth.parseCookies(req);
  return Boolean(auth.getAdminSession(cookies[auth.ADMIN_COOKIE]));
}

function centsToBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString("hex")}`;
}

// -------------------- Route handlers --------------------

const routes = [];
function route(method, pattern, handler) {
  routes.push({ method, pattern, handler });
}

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const paramNames = [];
    const regexStr = r.pattern.replace(/:[a-zA-Z0-9_]+/g, (m) => {
      paramNames.push(m.slice(1));
      return "([^/]+)";
    });
    const regex = new RegExp(`^${regexStr}$`);
    const match = pathname.match(regex);
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      return { handler: r.handler, params };
    }
  }
  return null;
}

// ---- Produtos ----

route("GET", "/api/products", async (req, res, params, query) => {
  let products = await db.all("products");
  if (query.categoria) products = products.filter((p) => p.category === query.categoria);
  if (query.busca) {
    const q = query.busca.toLowerCase();
    products = products.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (query.destaque === "1") products = products.filter((p) => p.featured);
  sendJson(res, 200, { products });
});

route("GET", "/api/products/:idOrSlug", async (req, res, { idOrSlug }) => {
  const products = await db.all("products");
  const product = products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
  if (!product) return sendJson(res, 404, { error: "Produto não encontrado" });
  sendJson(res, 200, { product });
});

route("POST", "/api/products", async (req, res) => {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Não autorizado" });
  const body = await readBody(req);
  const { name, category, price, sizes, description, stock, images, featured } = body;
  if (!name || !category || !price) {
    return sendJson(res, 400, { error: "Nome, categoria e preço são obrigatórios" });
  }
  const slug = String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const product = {
    id: genId("p"),
    slug: `${slug}-${crypto.randomBytes(2).toString("hex")}`,
    name,
    category,
    price: Math.round(Number(price)),
    sizes: Array.isArray(sizes) ? sizes : ["Único"],
    images: Array.isArray(images) && images.length ? images : ["/img/products/placeholder.jpg"],
    description: description || "",
    stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
    featured: Boolean(featured),
  };
  await db.insert("products", product);
  sendJson(res, 201, { product });
});

route("PUT", "/api/products/:id", async (req, res, { id }) => {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Não autorizado" });
  const body = await readBody(req);
  const updated = await db.update(
    "products",
    (p) => p.id === id,
    (p) => ({
      ...p,
      ...body,
      price: body.price !== undefined ? Math.round(Number(body.price)) : p.price,
    })
  );
  if (!updated) return sendJson(res, 404, { error: "Produto não encontrado" });
  sendJson(res, 200, { product: updated });
});

route("DELETE", "/api/products/:id", async (req, res, { id }) => {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Não autorizado" });
  const removed = await db.remove("products", (p) => p.id === id);
  if (!removed) return sendJson(res, 404, { error: "Produto não encontrado" });
  sendJson(res, 200, { ok: true });
});

// ---- Autenticação de clientes ----

route("POST", "/api/auth/register", async (req, res) => {
  const body = await readBody(req);
  const { name, email, password, phone } = body;
  if (!name || !isValidEmail(email) || !password || String(password).length < 6) {
    return sendJson(res, 400, {
      error: "Preencha nome, e-mail válido e senha com pelo menos 6 caracteres.",
    });
  }
  const users = await db.all("users");
  if (users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
    return sendJson(res, 409, { error: "Já existe uma conta com este e-mail." });
  }
  const user = {
    id: genId("u"),
    name,
    email: String(email).toLowerCase(),
    phone: phone || "",
    passwordHash: auth.hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await db.insert("users", user);
  const token = auth.createSession(user.id);
  auth.setCookie(res, auth.SESSION_COOKIE, token, { maxAge: 30 * 24 * 60 * 60 });
  const { passwordHash, ...safe } = user;
  sendJson(res, 201, { user: safe });
});

route("POST", "/api/auth/login", async (req, res) => {
  const body = await readBody(req);
  const { email, password } = body;
  const users = await db.all("users");
  const user = users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || !auth.verifyPassword(password || "", user.passwordHash)) {
    return sendJson(res, 401, { error: "E-mail ou senha incorretos." });
  }
  const token = auth.createSession(user.id);
  auth.setCookie(res, auth.SESSION_COOKIE, token, { maxAge: 30 * 24 * 60 * 60 });
  const { passwordHash, ...safe } = user;
  sendJson(res, 200, { user: safe });
});

route("POST", "/api/auth/logout", async (req, res) => {
  const cookies = auth.parseCookies(req);
  auth.destroySession(cookies[auth.SESSION_COOKIE]);
  auth.clearCookie(res, auth.SESSION_COOKIE);
  sendJson(res, 200, { ok: true });
});

route("GET", "/api/auth/me", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return sendJson(res, 401, { error: "Não autenticado" });
  sendJson(res, 200, { user });
});

// ---- Autenticação do admin ----

route("POST", "/api/admin/login", async (req, res) => {
  const body = await readBody(req);
  if (!ADMIN_PASSWORD) {
    return sendJson(res, 500, {
      error: "ADMIN_PASSWORD não configurada no servidor. Defina no arquivo .env.",
    });
  }
  if (body.password !== ADMIN_PASSWORD) {
    return sendJson(res, 401, { error: "Senha incorreta." });
  }
  const token = auth.createAdminSession();
  auth.setCookie(res, auth.ADMIN_COOKIE, token, { maxAge: 7 * 24 * 60 * 60 });
  sendJson(res, 200, { ok: true });
});

route("POST", "/api/admin/logout", async (req, res) => {
  const cookies = auth.parseCookies(req);
  auth.destroyAdminSession(cookies[auth.ADMIN_COOKIE]);
  auth.clearCookie(res, auth.ADMIN_COOKIE);
  sendJson(res, 200, { ok: true });
});

route("GET", "/api/admin/me", async (req, res) => {
  sendJson(res, 200, { isAdmin: isAdminRequest(req) });
});

route("GET", "/api/admin/orders", async (req, res) => {
  if (!isAdminRequest(req)) return sendJson(res, 401, { error: "Não autorizado" });
  const orders = await db.all("orders");
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sendJson(res, 200, { orders });
});

// ---- Pedidos / Checkout ----

route("POST", "/api/orders", async (req, res) => {
  const body = await readBody(req);
  const { items, customer } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return sendJson(res, 400, { error: "Carrinho vazio." });
  }
  if (!customer || !customer.name || !isValidEmail(customer.email) || !customer.phone) {
    return sendJson(res, 400, { error: "Informe nome, e-mail e telefone para continuar." });
  }

  const products = await db.all("products");
  const currentUser = await getCurrentUser(req);

  const resolvedItems = [];
  for (const it of items) {
    const product = products.find((p) => p.id === it.id);
    if (!product) continue;
    const qty = Math.max(1, Math.min(20, Number(it.quantity) || 1));
    resolvedItems.push({
      productId: product.id,
      name: product.name,
      size: it.size || null,
      quantity: qty,
      priceCents: product.price,
    });
  }

  if (resolvedItems.length === 0) {
    return sendJson(res, 400, { error: "Nenhum produto válido no carrinho." });
  }

  const totalCents = resolvedItems.reduce((sum, it) => sum + it.priceCents * it.quantity, 0);

  const order = {
    id: genId("ord"),
    userId: currentUser ? currentUser.id : null,
    items: resolvedItems,
    totalCents,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    address: body.address || null,
    status: "pending", // pending | paid | failed | cancelled
    createdAt: new Date().toISOString(),
    paymentUrl: null,
    paidAt: null,
  };

  await db.insert("orders", order);

  // Se a InfinitePay não estiver configurada ainda, devolve o pedido criado
  // mas sem link de pagamento, para o admin poder testar o resto do fluxo.
  if (!process.env.INFINITEPAY_HANDLE) {
    return sendJson(res, 201, {
      order,
      warning:
        "Pagamento não gerado: configure INFINITEPAY_HANDLE no .env com o seu @ da InfinitePay.",
    });
  }

  try {
    const result = await infinitepay.createCheckoutLink({
      orderId: order.id,
      items: resolvedItems.map((it) => ({
        name: `${it.name}${it.size ? ` (${it.size})` : ""}`,
        quantity: it.quantity,
        priceCents: it.priceCents,
      })),
      redirectUrl: `${SITE_URL}/pedido-confirmado?pedido=${order.id}`,
      webhookUrl: `${SITE_URL}/api/checkout/webhook`,
      customer: {
        name: customer.name,
        email: customer.email,
        phone_number: customer.phone,
      },
    });

    const paymentUrl = result.url || result.checkout_url || result.payment_url || null;

    await db.update("orders", (o) => o.id === order.id, (o) => ({ ...o, paymentUrl }));

    sendJson(res, 201, { order: { ...order, paymentUrl } });
  } catch (err) {
    console.error("[infinitepay] erro ao criar link de pagamento:", err.message);
    const failedOrder = await db.update("orders", (o) => o.id === order.id, (o) => ({ ...o, status: "failed" }));
    sendJson(res, 502, {
      error: "Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.",
      order: failedOrder || order,
    });
  }
});

route("GET", "/api/orders/mine", async (req, res) => {
  const user = await getCurrentUser(req);
  if (!user) return sendJson(res, 401, { error: "Não autenticado" });
  const orders = await db.all("orders");
  const mine = orders.filter((o) => o.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sendJson(res, 200, { orders: mine });
});

route("GET", "/api/orders/:id", async (req, res, { id }) => {
  const orders = await db.all("orders");
  const order = orders.find((o) => o.id === id);
  if (!order) return sendJson(res, 404, { error: "Pedido não encontrado" });
  sendJson(res, 200, { order });
});

// Webhook chamado pela InfinitePay quando o pagamento é confirmado.
route("POST", "/api/checkout/webhook", async (req, res) => {
  const body = await readBody(req);
  try {
    const orderNsu = body.order_nsu || body.orderNsu || (body.data && body.data.order_nsu);
    const paymentStatus = (body.status || (body.data && body.data.status) || "").toLowerCase();

    if (!orderNsu) {
      console.warn("[webhook] payload sem order_nsu:", JSON.stringify(body).slice(0, 500));
      return sendJson(res, 200, { success: true });
    }

    const isPaid = ["paid", "success", "approved", "confirmed"].includes(paymentStatus) || paymentStatus === "";

    await db.update(
      "orders",
      (o) => o.id === orderNsu,
      (o) => ({
        ...o,
        status: isPaid ? "paid" : "failed",
        paidAt: isPaid ? new Date().toISOString() : o.paidAt,
        webhookPayload: body,
      })
    );

    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error("[webhook] erro ao processar:", err);
    // Responde 200 mesmo assim para não gerar retentativas infinitas;
    // o pagamento pode ser conferido manualmente via painel da InfinitePay.
    sendJson(res, 200, { success: true });
  }
});

// -------------------- Views (páginas HTML com URLs limpas) --------------------

const viewRoutes = {
  "/": "index.html",
  "/catalogo": "catalogo.html",
  "/produto": "produto.html",
  "/carrinho": "carrinho.html",
  "/checkout": "checkout.html",
  "/pedido-confirmado": "pedido-confirmado.html",
  "/entrar": "entrar.html",
  "/cadastro": "entrar.html",
  "/minha-conta": "minha-conta.html",
  "/admin": "admin/login.html",
  "/admin/login": "admin/login.html",
  "/admin/dashboard": "admin/dashboard.html",
  "/admin/pedidos": "admin/pedidos.html",
};

// -------------------- HTTP server --------------------

const server = http.createServer(async (req, res) => {
  try {
    const parsed = url.parse(req.url, true);
    const pathname = decodeURIComponent(parsed.pathname);
    const query = parsed.query;

    // 1) API routes
    if (pathname.startsWith("/api/")) {
      const match = matchRoute(req.method, pathname);
      if (match) {
        await match.handler(req, res, match.params, query);
      } else {
        sendJson(res, 404, { error: "Rota não encontrada" });
      }
      return;
    }

    // 2) Static assets
    if (pathname.startsWith("/img/") || pathname.startsWith("/css/") || pathname.startsWith("/js/")) {
      const filePath = safeJoin(PUBLIC_DIR, pathname);
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return serveFile(res, filePath);
      }
      return send(res, 404, "Não encontrado");
    }

    // 3) Clean-URL HTML views
    if (viewRoutes[pathname]) {
      return serveFile(res, path.join(VIEWS_DIR, viewRoutes[pathname]));
    }

    // 4) Fallback: try exact file in /views (allows deep-linking to .html too)
    const directView = safeJoin(VIEWS_DIR, pathname);
    if (directView && fs.existsSync(directView) && fs.statSync(directView).isFile()) {
      return serveFile(res, directView);
    }

    // 5) 404
    const notFoundPath = path.join(VIEWS_DIR, "404.html");
    if (fs.existsSync(notFoundPath)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(notFoundPath).pipe(res);
    } else {
      send(res, 404, "Página não encontrada");
    }
  } catch (err) {
    console.error("[server] erro não tratado:", err);
    sendJson(res, 500, { error: "Erro interno do servidor" });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Drip Imports rodando em ${SITE_URL} (porta ${PORT})\n`);
  if (!process.env.INFINITEPAY_HANDLE) {
    console.log("  ⚠ INFINITEPAY_HANDLE não configurado - o checkout não vai gerar pagamentos reais ainda.");
  }
  if (!ADMIN_PASSWORD) {
    console.log("  ⚠ ADMIN_PASSWORD não configurada - defina no .env para acessar /admin.");
  }
});
