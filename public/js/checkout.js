// public/js/checkout.js - Página de checkout (revisão + dados + pagamento)

document.addEventListener("DOMContentLoaded", async () => {
  const summaryMount = document.getElementById("checkout-summary");
  const form = document.getElementById("checkout-form");
  if (!form) return;

  const cart = getCart();
  if (cart.length === 0) {
    window.location.href = "/carrinho";
    return;
  }

  function renderSummary() {
    const total = cart.reduce((sum, it) => sum + it.price * it.quantity, 0);
    summaryMount.innerHTML = `
      ${cart
        .map(
          (it) => `
        <div class="summary-row">
          <span>${it.quantity}x ${it.name} (${it.size})</span>
          <span>${formatBRL(it.price * it.quantity)}</span>
        </div>`
        )
        .join("")}
      <div class="summary-row total">
        <span>Total</span>
        <span>${formatBRL(total)}</span>
      </div>
    `;
  }
  renderSummary();

  // Pré-preenche com dados do usuário logado, se houver
  try {
    const { user } = await api("/api/auth/me");
    if (user) {
      form.name.value = user.name || "";
      form.email.value = user.email || "";
      form.phone.value = user.phone || "";
    }
  } catch {
    // não logado, tudo bem - checkout permite convidado
  }

  const alertBox = document.getElementById("checkout-alert");
  const submitBtn = document.getElementById("checkout-submit");

  function showError(msg) {
    alertBox.textContent = msg;
    alertBox.className = "alert alert-error show";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.className = "alert";
    submitBtn.disabled = true;
    submitBtn.textContent = "Gerando pagamento...";

    const payload = {
      items: cart.map((it) => ({ id: it.id, size: it.size, quantity: it.quantity })),
      customer: {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
      },
      address: {
        cep: form.cep.value.trim(),
        street: form.street.value.trim(),
        number: form.number.value.trim(),
        complement: form.complement.value.trim(),
        city: form.city.value.trim(),
        state: form.state.value.trim(),
      },
    };

    try {
      const { order, warning } = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (order.paymentUrl) {
        clearCart();
        window.location.href = order.paymentUrl;
      } else {
        clearCart();
        window.location.href = `/pedido-confirmado?pedido=${order.id}`;
        if (warning) console.warn(warning);
      }
    } catch (err) {
      showError(err.data?.error || "Não foi possível finalizar o pedido. Tente novamente.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Ir para pagamento";
    }
  });
});
