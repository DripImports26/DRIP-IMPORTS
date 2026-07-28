// public/js/catalog.js
// Página inicial (destaques) e página de catálogo (listagem + filtros).

function productCardHtml(p) {
  return `
    <a class="product-card" href="/produto?slug=${encodeURIComponent(p.slug)}">
      <div class="thumb-wrap">
        ${p.featured ? '<span class="badge-featured">Destaque</span>' : ""}
        <div class="thumb"><img src="${p.images[0]}" alt="${p.name}" loading="lazy" /></div>
      </div>
      <div class="info">
        <span class="cat-tag">${categoryLabel(p.category)}</span>
        <h4>${p.name}</h4>
        <span class="price">${formatBRL(p.price)}</span>
      </div>
    </a>`;
}

function categoryLabel(cat) {
  return { roupas: "Roupas", tenis: "Tênis", acessorios: "Acessórios" }[cat] || cat;
}

async function renderHomeFeatured() {
  const mount = document.getElementById("featured-grid");
  if (!mount) return;
  try {
    const { products } = await api("/api/products?destaque=1");
    mount.innerHTML = products.length
      ? products.map(productCardHtml).join("")
      : '<p class="empty-state">Em breve novos produtos.</p>';
  } catch {
    mount.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos agora.</p>';
  }
}

async function renderCatalog() {
  const mount = document.getElementById("catalog-grid");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  let categoria = params.get("categoria") || "";
  let busca = params.get("busca") || "";

  const searchInput = document.getElementById("catalog-search");
  if (searchInput) searchInput.value = busca;

  function setActivePill() {
    document.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.categoria === categoria);
    });
  }
  setActivePill();

  async function load() {
    mount.innerHTML = '<div class="spinner"></div>';
    const qs = new URLSearchParams();
    if (categoria) qs.set("categoria", categoria);
    if (busca) qs.set("busca", busca);
    try {
      const { products } = await api(`/api/products?${qs.toString()}`);
      mount.innerHTML = products.length
        ? products.map(productCardHtml).join("")
        : '<p class="empty-state">Nenhum produto encontrado.</p>';
    } catch {
      mount.innerHTML = '<p class="empty-state">Não foi possível carregar os produtos agora.</p>';
    }
  }

  document.querySelectorAll(".filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      categoria = btn.dataset.categoria || "";
      const url = new URL(window.location);
      if (categoria) url.searchParams.set("categoria", categoria);
      else url.searchParams.delete("categoria");
      window.history.replaceState({}, "", url);
      setActivePill();
      load();
    });
  });

  if (searchInput) {
    let t;
    searchInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        busca = searchInput.value.trim();
        const url = new URL(window.location);
        if (busca) url.searchParams.set("busca", busca);
        else url.searchParams.delete("busca");
        window.history.replaceState({}, "", url);
        load();
      }, 300);
    });
  }

  load();
}

document.addEventListener("DOMContentLoaded", () => {
  renderHomeFeatured();
  renderCatalog();
});
