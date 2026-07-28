// public/js/auth.js - Login e cadastro de clientes

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loginPanel = document.getElementById("login-panel");
  const registerPanel = document.getElementById("register-panel");
  const showRegister = document.getElementById("show-register");
  const showLogin = document.getElementById("show-login");

  const params = new URLSearchParams(window.location.search);
  const startOnRegister = window.location.pathname === "/cadastro" || params.get("modo") === "cadastro";

  function toggle(toRegister) {
    if (!loginPanel || !registerPanel) return;
    loginPanel.style.display = toRegister ? "none" : "block";
    registerPanel.style.display = toRegister ? "block" : "none";
  }
  if (startOnRegister) toggle(true);

  showRegister?.addEventListener("click", (e) => {
    e.preventDefault();
    toggle(true);
  });
  showLogin?.addEventListener("click", (e) => {
    e.preventDefault();
    toggle(false);
  });

  function nextUrl() {
    return params.get("next") || "/minha-conta";
  }

  if (loginForm) {
    const alertBox = document.getElementById("login-alert");
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox.className = "alert";
      try {
        await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: loginForm.email.value.trim(),
            password: loginForm.password.value,
          }),
        });
        window.location.href = nextUrl();
      } catch (err) {
        alertBox.textContent = err.data?.error || "Não foi possível entrar.";
        alertBox.className = "alert alert-error show";
      }
    });
  }

  if (registerForm) {
    const alertBox = document.getElementById("register-alert");
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      alertBox.className = "alert";
      if (registerForm.password.value !== registerForm.password2.value) {
        alertBox.textContent = "As senhas não conferem.";
        alertBox.className = "alert alert-error show";
        return;
      }
      try {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: registerForm.name.value.trim(),
            email: registerForm.email.value.trim(),
            phone: registerForm.phone.value.trim(),
            password: registerForm.password.value,
          }),
        });
        window.location.href = nextUrl();
      } catch (err) {
        alertBox.textContent = err.data?.error || "Não foi possível criar a conta.";
        alertBox.className = "alert alert-error show";
      }
    });
  }
});
