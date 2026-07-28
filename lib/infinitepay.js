// lib/infinitepay.js
// Integração com o Checkout Integrado da InfinitePay (Pix + cartão de crédito).
// Documentação: https://ajuda.infinitepay.io -> "Como usar o Checkout Integrado da InfinitePay?"
// Sem dependências externas: usa o módulo "https" nativo do Node.

const https = require("https");

const API_HOST = "api.checkout.infinitepay.io";
const API_PATH = "/links";

function postJson(hostname, pathName, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname,
        path: pathName,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch {
            parsed = { raw: data };
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(
              Object.assign(new Error(`InfinitePay respondeu ${res.statusCode}`), {
                statusCode: res.statusCode,
                body: parsed,
              })
            );
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Timeout ao chamar a InfinitePay")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Cria um link de checkout na InfinitePay para um pedido.
 * @param {Object} params
 * @param {string} params.orderId - ID do pedido no seu sistema (order_nsu)
 * @param {Array<{name:string, quantity:number, priceCents:number}>} params.items
 * @param {string} params.redirectUrl - Para onde o cliente volta após pagar
 * @param {string} [params.webhookUrl] - URL que recebe a confirmação de pagamento
 * @param {Object} [params.customer] - { name, email, phone_number }
 */
async function createCheckoutLink({ orderId, items, redirectUrl, webhookUrl, customer }) {
  const handle = process.env.INFINITEPAY_HANDLE;
  if (!handle) {
    throw new Error(
      "INFINITEPAY_HANDLE não configurado. Defina a variável de ambiente com o seu @ da InfinitePay (sem o $)."
    );
  }

  const payload = {
    handle,
    order_nsu: String(orderId),
    redirect_url: redirectUrl,
    items: items.map((it) => ({
      quantity: it.quantity,
      price: it.priceCents, // em centavos
      description: it.name,
    })),
  };

  if (webhookUrl) payload.webhook_url = webhookUrl;
  if (customer) payload.customer = customer;

  return postJson(API_HOST, API_PATH, payload);
}

module.exports = { createCheckoutLink };
