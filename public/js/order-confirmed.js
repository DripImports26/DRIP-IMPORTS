// public/js/order-confirmed.js - Página de confirmação após retorno do pagamento

const STATUS_LABEL = {
  pending: "Aguardando confirmação do pagamento",
  paid: "Pagamento confirmado",
  failed: "Pagamento não foi concluído",
  cancelled: "Pedido cancelado",
};

document.addEventListener("DOMContentLoaded", async () => {
  const mount = document.getElementById("confirm-mount");
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("pedido");
  if (!orderId) {
    mount.innerHTML = '<p class="empty-state">Pedido não informado.</p>';
    return;
  }

  async function load() {
    try {
      const { order } = await api(`/api/orders/${encodeURIComponent(orderId)}`);
      mount.innerHTML = `
        <div style="text-align:center; padding: 40px 0;">
          <h1>${order.status === "paid" ? "Pedido confirmado! 🎉" : "Pedido recebido"}</h1>
          <p style="color:var(--muted); margin-bottom: 26px;">Número do pedido: <strong>#${order.id.slice(-8)}</strong></p>
          <span class="status-pill status-${order.status}" style="font-size:1rem; padding:8px 18px;">
            ${STATUS_LABEL[order.status] || order.status}
          </span>
          <p style="margin-top:30px; color:var(--muted);">
            ${
              order.status === "paid"
                ? "Enviamos os detalhes para o seu e-mail. Obrigado por comprar na Drip Imports!"
                : "Assim que a InfinitePay confirmar o pagamento (Pix ou cartão), esta página é atualizada automaticamente."
            }
          </p>
          <a href="/catalogo" class="btn btn-primary" style="margin-top:24px;">Continuar comprando</a>
        </div>
      `;

      if (order.status === "pending") {
        setTimeout(load, 4000);
      }
    } catch {
      mount.innerHTML = '<p class="empty-state">Não foi possível carregar o status do pedido.</p>';
    }
  }

  load();
});
