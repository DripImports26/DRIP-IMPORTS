// public/js/account.js - "Minha conta": dados + histórico de pedidos

const STATUS_LABEL = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
};

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("account-mount");
  if (!mount) return;

  let user;
  try {
    const data = await api("/api/auth/me");
    user = data.user;
  } catch {
    window.location.href = "/entrar?next=/minha-conta";
    return;
  }

  let orders = [];
  try {
    const data = await api("/api/orders/mine");
    orders = data.orders;
  } catch {
    orders = [];
  }

  mount.innerHTML = `
    <div style="margin-bottom:36px;">
      <h2>Olá, ${user.name.split(" ")[0]}</h2>
      <p style="color:var(--muted);">${user.email}</p>
      <button class="btn btn-outline btn-sm" id="logout-btn">Sair da conta</button>
    </div>
    <h3 style="margin-bottom:16px;">Meus pedidos</h3>
    ${
      orders.length === 0
        ? '<p class="empty-state">Você ainda não fez nenhum pedido.</p>'
        : `<table>
        <thead><tr><th>Pedido</th><th>Data</th><th>Itens</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          ${orders
            .map(
              (o) => `
            <tr>
              <td>#${o.id.slice(-8)}</td>
              <td>${new Date(o.createdAt).toLocaleDateString("pt-BR")}</td>
              <td>${o.items.reduce((s, it) => s + it.quantity, 0)} item(ns)</td>
              <td>${formatBRL(o.totalCents)}</td>
              <td><span class="status-pill status-${o.status}">${STATUS_LABEL[o.status] || o.status}</span></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    }
  `;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  });
});
