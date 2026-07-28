// public/js/product.js - Página de detalhe do produto

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("product-mount");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) {
    mount.innerHTML = '<p class="empty-state">Produto não informado.</p>';
    return;
  }

  let product;
  try {
    const data = await api(`/api/products/${encodeURIComponent(slug)}`);
    product = data.product;
  } catch {
    mount.innerHTML = '<p class="empty-state">Produto não encontrado.</p>';
    return;
  }

  document.title = `${product.name} - Drip Imports`;

  let selectedSize = product.sizes[0] || "Único";
  let qty = 1;

  function render() {
    mount.innerHTML = `
      <div class="product-detail">
        <div class="gallery">
          <img src="${product.images[0]}" alt="${product.name}" />
        </div>
        <div class="details">
          <h1>${product.name}</h1>
          <div class="price">${formatBRL(product.price)}</div>
          <p class="desc">${product.description}</p>

          <div>
            <label style="font-weight:700; display:block; margin-bottom:10px;">Tamanho</label>
            <div class="size-picker" id="size-picker">
              ${product.sizes
                .map(
                  (s) =>
                    `<div class="size-option ${s === selectedSize ? "selected" : ""}" data-size="${s}">${s}</div>`
                )
                .join("")}
            </div>
          </div>

          <div>
            <label style="font-weight:700; display:block; margin-bottom:10px;">Quantidade</label>
            <div class="qty-picker">
              <button id="qty-minus" type="button">-</button>
              <span id="qty-value">${qty}</span>
              <button id="qty-plus" type="button">+</button>
            </div>
          </div>

          <button class="btn btn-primary btn-block" id="add-to-cart-btn">Adicionar ao carrinho</button>
          <p id="add-feedback" style="color:#4ade80; margin-top:12px; display:none;">Produto adicionado ao carrinho ✓</p>
        </div>
      </div>
    `;

    mount.querySelectorAll(".size-option").forEach((el) => {
      el.addEventListener("click", () => {
        selectedSize = el.dataset.size;
        render();
      });
    });

    document.getElementById("qty-minus").addEventListener("click", () => {
      qty = Math.max(1, qty - 1);
      document.getElementById("qty-value").textContent = qty;
    });
    document.getElementById("qty-plus").addEventListener("click", () => {
      qty = Math.min(20, qty + 1);
      document.getElementById("qty-value").textContent = qty;
    });

    document.getElementById("add-to-cart-btn").addEventListener("click", () => {
      addToCart({
        id: product.id,
        slug: product.slug,
        name: product.name,
        image: product.images[0],
        price: product.price,
        size: selectedSize,
        quantity: qty,
      });
      const fb = document.getElementById("add-feedback");
      fb.style.display = "block";
      setTimeout(() => (fb.style.display = "none"), 2500);
    });
  }

  render();
});
