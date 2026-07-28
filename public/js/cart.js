// public/js/cart.js - Página do carrinho

function cartItemHtml(item) {
  return `
    <div class="cart-item" data-id="${item.id}" data-size="${item.size}">
      <img src="${item.image}" alt="${item.name}" />
      <div class="meta">
        <h4>${item.name}</h4>
        <span>Tamanho: ${item.size}</span>
        <span>${formatBRL(item.price)} cada</span>
        <div class="qty-row">
          <button class="qty-minus" type="button">-</button>
          <span>${item.quantity}</span>
          <button class="qty-plus" type="button">+</button>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:800; margin-bottom:10px;">${formatBRL(item.price * item.quantity)}</div>
        <span class="remove-link">Remover</span>
      </div>
    </div>`;
}

function renderCartPage() {
  const mount = document.getElementById("cart-items");
  const summaryMount = document.getElementById("cart-summary");
  if (!mount) return;

  const cart = getCart();

  if (cart.length === 0) {
    mount.innerHTML = `<div class="empty-state">
      <p>Seu carrinho está vazio.</p>
      <a class="btn btn-primary" href="/catalogo">Ver produtos</a>
    </div>`;
    if (summaryMount) summaryMount.style.display = "none";
    return;
  }

  if (summaryMount) summaryMount.style.display = "block";
  mount.innerHTML = cart.map(cartItemHtml).join("");

  const total = cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const totalMount = document.getElementById("cart-total");
  if (totalMount) totalMount.textContent = formatBRL(total);

  mount.querySelectorAll(".cart-item").forEach((el) => {
    const id = el.dataset.id;
    const size = el.dataset.size;
    const item = cart.find((it) => it.id === id && it.size === size);

    el.querySelector(".qty-plus").addEventListener("click", () => {
      updateCartItem(id, size, item.quantity + 1);
      renderCartPage();
    });
    el.querySelector(".qty-minus").addEventListener("click", () => {
      updateCartItem(id, size, item.quantity - 1);
      renderCartPage();
    });
    el.querySelector(".remove-link").addEventListener("click", () => {
      removeFromCart(id, size);
      renderCartPage();
    });
  });
}

document.addEventListener("DOMContentLoaded", renderCartPage);
