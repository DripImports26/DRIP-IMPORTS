// public/js/main.js
// Layout compartilhado (header/footer), estado do carrinho e utilidades gerais.

const CART_KEY = "drip_cart_v1";

function formatBRL(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce((sum, it) => sum + it.quantity, 0);
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((it) => it.id === item.id && it.size === item.size);
  if (existing) {
    existing.quantity = Math.min(20, existing.quantity + item.quantity);
  } else {
    cart.push(item);
  }
  saveCart(cart);
}

function updateCartItem(id, size, quantity) {
  let cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter((it) => !(it.id === id && it.size === size));
  } else {
    cart = cart.map((it) => (it.id === id && it.size === size ? { ...it, quantity } : it));
  }
  saveCart(cart);
}

function removeFromCart(id, size) {
  updateCartItem(id, size, 0);
}

function clearCart() {
  saveCart([]);
}

function updateCartBadge() {
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    const n = cartCount();
    el.textContent = n;
    el.style.display = n > 0 ? "inline-flex" : "none";
  });
}

async function api(pathName, options = {}) {
  const res = await fetch(pathName, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.error || "Erro na requisição");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const LOGO_SRC = "/img/logo.png";

function layoutHeader(active) {
  const links = [
    { href: "/", label: "Início", key: "inicio" },
    { href: "/catalogo", label: "Todos os produtos", key: "catalogo" },
    { href: "/catalogo?categoria=roupas", label: "Roupas", key: "roupas" },
    { href: "/catalogo?categoria=tenis", label: "Tênis", key: "tenis" },
    { href: "/catalogo?categoria=acessorios", label: "Acessórios", key: "acessorios" },
  ];
  const navHtml = links
    .map((l) => `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`)
    .join("");

  return `
  <header class="site-header">
    <div class="header-inner">
      <a href="/" class="brand">
        <img src="${LOGO_SRC}" alt="Drip Imports" />
      </a>
      <nav class="main-nav">${navHtml}</nav>
      <div class="header-actions">
        <a href="/minha-conta" class="icon-link" title="Minha conta">👤 <span class="account-label">Conta</span></a>
        <a href="/carrinho" class="icon-link" title="Carrinho">
          🛒 <span data-cart-count class="cart-badge">0</span>
        </a>
      </div>
    </div>
  </header>`;
}

function layoutFooter() {
  const year = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="container footer-inner">
      <div>
        <img src="${LOGO_SRC}" alt="Drip Imports" />
        <p>Roupas, tênis e acessórios.</p>
      </div>
      <div>
        <p><strong>Atendimento</strong></p>
        <p>dripimports1@outlook.com</p>
      </div>
      <div>
        <p>&copy; ${year} Drip Imports. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>`;
}

function mountLayout(active) {
  const headerMount = document.getElementById("app-header");
  const footerMount = document.getElementById("app-footer");
  if (headerMount) headerMount.outerHTML = layoutHeader(active);
  if (footerMount) footerMount.outerHTML = layoutFooter();
  updateCartBadge();
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
});
