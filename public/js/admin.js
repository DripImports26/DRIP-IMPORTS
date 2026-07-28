// public/js/admin.js - Painel administrativo (login + CRUD de produtos + pedidos)

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) {
    const alertBox = document.getElementById("admin-login-alert");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox.className = "alert";
      try {
        await api("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ password: loginForm.password.value }),
        });
        window.location.href = "/admin/dashboard";
      } catch (err) {
        alertBox.textContent = err.data?.error || "Senha incorreta.";
        alertBox.className = "alert alert-error show";
      }
    });
    return;
  }

  // Páginas protegidas do admin
  const protectedMount = document.getElementById("admin-products-mount") || document.getElementById("admin-orders-mount");
  if (!protectedMount) return;

  try {
    const { isAdmin } = await api("/api/admin/me");
    if (!isAdmin) throw new Error("not admin");
  } catch {
    window.location.href = "/admin/login";
    return;
  }

  document.getElementById("admin-logout-btn")?.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  });

  if (document.getElementById("admin-products-mount")) {
    initProductsAdmin();
  }
  if (document.getElementById("admin-orders-mount")) {
    initOrdersAdmin();
  }
});

async function initProductsAdmin() {
  const mount = document.getElementById("admin-products-mount");
  const modal = document.getElementById("product-modal");
  const modalTitle = document.getElementById("product-modal-title");
  const form = document.getElementById("product-form");
  const newBtn = document.getElementById("new-product-btn");
  const cancelBtn = document.getElementById("cancel-product-btn");

  let products = [];

  function openModal(product) {
    form.reset();
    form.dataset.id = product ? product.id : "";
    modalTitle.textContent = product ? "Editar produto" : "Novo produto";
    if (product) {
      form.name.value = product.name;
      form.category.value = product.category;
      form.price.value = (product.price / 100).toFixed(2);
      form.sizes.value = product.sizes.join(", ");
      form.stock.value = product.stock;
      form.description.value = product.description;
      form.image.value = product.images[0] || "";
      form.featured.checked = Boolean(product.featured);
    }
    modal.classList.add("show");
  }

  function closeModal() {
    modal.classList.remove("show");
  }

  newBtn.addEventListener("click", () => openModal(null));
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = form.dataset.id;
    const payload = {
      name: form.name.value.trim(),
      category: form.category.value,
      price: Math.round(parseFloat(form.price.value.replace(",", ".")) * 100),
      sizes: form.sizes.value.split(",").map((s) => s.trim()).filter(Boolean),
      stock: Number(form.stock.value) || 0,
      description: form.description.value.trim(),
      images: form.image.value.trim() ? [form.image.value.trim()] : undefined,
      featured: form.featured.checked,
    };
    try {
      if (id) {
        await api(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/api/products", { method: "POST", body: JSON.stringify(payload) });
      }
      closeModal();
      load();
    } catch (err) {
      alert(err.data?.error || "Erro ao salvar produto.");
    }
  });

  async function load() {
    mount.innerHTML = '<div class="spinner"></div>';
    const { products: list } = await api("/api/products");
    products = list;
    if (products.length === 0) {
      mount.innerHTML = '<p class="empty-state">Nenhum produto cadastrado ainda.</p>';
      return;
    }
    mount.innerHTML = `
      <table>
        <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th></th></tr></thead>
        <tbody>
          ${products
            .map(
              (p) => `
            <tr>
              <td>${p.name}</td>
              <td>${p.category}</td>
              <td>${formatBRL(p.price)}</td>
              <td>${p.stock}</td>
              <td style="text-align:right; white-space:nowrap;">
                <button class="btn btn-outline btn-sm" data-edit="${p.id}">Editar</button>
                <button class="btn btn-danger btn-sm" data-delete="${p.id}">Excluir</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;

    mount.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = products.find((pr) => pr.id === btn.dataset.edit);
        openModal(p);
      });
    });
    mount.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir este produto?")) return;
        await api(`/api/products/${btn.dataset.delete}`, { method: "DELETE" });
        load();
      });
    });
  }

  load();
}

async function initOrdersAdmin() {
  const mount = document.getElementById("admin-orders-mount");
  const STATUS_LABEL = {
    pending: "Aguardando pagamento",
    paid: "Pago",
    failed: "Falhou",
    cancelled: "Cancelado",
  };
  mount.innerHTML = '<div class="spinner"></div>';
  const { orders } = await api("/api/admin/orders");
  if (orders.length === 0) {
    mount.innerHTML = '<p class="empty-state">Nenhum pedido ainda.</p>';
    return;
  }
  mount.innerHTML = `
    <table>
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>
        ${orders
          .map(
            (o) => `
          <tr>
            <td>#${o.id.slice(-8)}</td>
            <td>${o.customer?.name || "-"}<br/><span style="color:var(--muted); font-size:0.8rem;">${o.customer?.email || ""}</span></td>
            <td>${new Date(o.createdAt).toLocaleString("pt-BR")}</td>
            <td>${formatBRL(o.totalCents)}</td>
            <td><span class="status-pill status-${o.status}">${STATUS_LABEL[o.status] || o.status}</span></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}
