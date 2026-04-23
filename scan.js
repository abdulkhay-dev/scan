document.querySelectorAll("[data-nav]").forEach((link) => {
  const href = link.getAttribute("href");

  if (href === window.location.pathname) {
    link.classList.add("active");
  }
});

const yearNode = document.querySelector("[data-year]");

if (yearNode) {
  yearNode.textContent = String(new Date().getFullYear());
}

const usersPaginationRoot = document.querySelector("[data-users-pagination]");
if (usersPaginationRoot) {
  setupUsersPagination(usersPaginationRoot);
}

const adminKeyRegistrationForm = document.querySelector("[data-admin-key-registration-form]");
if (adminKeyRegistrationForm) {
  setupAdminKeyRegistration(adminKeyRegistrationForm);
}

const adminLoginForm = document.querySelector("[data-admin-login-form]");
if (adminLoginForm) {
  setupAdminLogin(adminLoginForm);
}

document.querySelectorAll("[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    const message = form.getAttribute("data-confirm") || "Подтвердите действие";

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
});

function setupAdminLogin(form) {
  const status = document.querySelector("[data-admin-login-status]");
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const login = String(formData.get("login") || "").trim().toLowerCase();

    if (!login) {
      setStatusMessage(status, "Укажите login.", true);
      return;
    }

    if (!window.PublicKeyCredential || !navigator.credentials?.get) {
      setStatusMessage(status, "Этот браузер не поддерживает WebAuthn/FIDO2.", true);
      return;
    }

    submitButton.disabled = true;
    setStatusMessage(status, "Готовим вход по ключу...");

    try {
      const optionsResponse = await fetch("/api/admin/login/options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ login }),
      });

      if (!optionsResponse.ok) {
        throw new Error("Неверный login или ключ.");
      }

      const { options } = await optionsResponse.json();
      setStatusMessage(status, "Подтвердите вход ключом или биометрией.");

      const credential = await navigator.credentials.get({
        publicKey: parseCredentialRequestOptions(options),
      });

      if (!credential) {
        throw new Error("Браузер не вернул данные ключа.");
      }

      const verifyResponse = await fetch("/api/admin/login/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          login,
          credential: serializeAuthenticationCredential(credential),
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error("Неверный login или ключ.");
      }

      const payload = await verifyResponse.json();
      window.location.href = payload.redirectTo || "/api/admin/dashboard";
    } catch (error) {
      console.error(error);
      setStatusMessage(status, error.message || "Не удалось войти.", true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

function setupAdminKeyRegistration(form) {
  const status = document.querySelector("[data-admin-key-registration-status]");
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const login = String(formData.get("login") || "").trim().toLowerCase();
    const setupCode = String(formData.get("setupCode") || "").trim();

    if (!login || !setupCode) {
      setStatusMessage(status, "Укажите login и setup-code.", true);
      return;
    }

    if (!window.PublicKeyCredential || !navigator.credentials?.create) {
      setStatusMessage(status, "Этот браузер не поддерживает WebAuthn/FIDO2.", true);
      return;
    }

    submitButton.disabled = true;
    setStatusMessage(status, "Готовим регистрацию ключа...");

    try {
      const optionsResponse = await fetch("/api/admin/webauthn/register/options", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ login, setupCode }),
      });

      if (!optionsResponse.ok) {
        throw new Error("Не удалось создать challenge для ключа.");
      }

      const { options } = await optionsResponse.json();
      setStatusMessage(status, "Подтвердите регистрацию в системном окне браузера.");

      const credential = await navigator.credentials.create({
        publicKey: parseCredentialCreationOptions(options),
      });

      if (!credential) {
        throw new Error("Браузер не вернул данные ключа.");
      }

      const verifyResponse = await fetch("/api/admin/webauthn/register/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          login,
          setupCode,
          credential: serializeRegistrationCredential(credential),
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error("Не удалось подтвердить ключ.");
      }

      setStatusMessage(status, "Ключ успешно зарегистрирован. Теперь пользователь active.");
      form.reset();
    } catch (error) {
      console.error(error);
      setStatusMessage(status, error.message || "Не удалось зарегистрировать ключ.", true);
    } finally {
      submitButton.disabled = false;
    }
  });
}

function parseCredentialRequestOptions(options) {
  return {
    ...options,
    challenge: base64UrlToArrayBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToArrayBuffer(credential.id),
    })),
  };
}

function parseCredentialCreationOptions(options) {
  return {
    ...options,
    challenge: base64UrlToArrayBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64UrlToArrayBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((credential) => ({
      ...credential,
      id: base64UrlToArrayBuffer(credential.id),
    })),
  };
}

function serializeRegistrationCredential(credential) {
  const response = credential.response;
  const transports = typeof response.getTransports === "function" ? response.getTransports() : [];

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      transports,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function serializeAuthenticationCredential(credential) {
  const response = credential.response;

  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : undefined,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function base64UrlToArrayBuffer(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function setStatusMessage(node, message, isError = false) {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.classList.toggle("danger-text", isError);
}

function setupUsersPagination(root) {
  const endpoint = root.getAttribute("data-endpoint");
  const tbody = root.querySelector("[data-users-table-body]");
  const status = root.querySelector("[data-users-pagination-status]");
  const prevButton = root.querySelector('[data-page-direction="prev"]');
  const nextButton = root.querySelector('[data-page-direction="next"]');
  const filterForm = root.querySelector("[data-users-filters]");
  const cityInput = root.querySelector("[data-users-filter-city]");
  const dateInput = root.querySelector("[data-users-filter-date]");
  const resetButton = root.querySelector("[data-users-filter-reset]");

  if (!endpoint || !tbody || !status || !prevButton || !nextButton || !cityInput || !dateInput || !resetButton) {
    return;
  }

  const loadPage = async (page, { pushState = true } = {}) => {
    if (root.classList.contains("is-loading")) {
      return;
    }

    root.classList.add("is-loading");

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("ajax", "1");
      applyUserFiltersToUrl(url, cityInput.value, dateInput.value);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load page ${page}`);
      }

      const payload = await response.json();

      renderUsersTableBody(tbody, payload.users || []);
      updatePaginationState(root, status, prevButton, nextButton, payload.pagination);
      syncFilterInputs(cityInput, dateInput, payload.filters);

      if (pushState) {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("page", String(payload.pagination.currentPage));
        applyUserFiltersToUrl(nextUrl, payload.filters?.city || "", payload.filters?.date || "");
        window.history.pushState({ usersPage: payload.pagination.currentPage }, "", nextUrl);
      }
    } catch (error) {
      console.error(error);
    } finally {
      root.classList.remove("is-loading");
    }
  };

  prevButton.addEventListener("click", () => {
    const currentPage = Number.parseInt(root.getAttribute("data-current-page") || "1", 10);

    if (currentPage > 1) {
      loadPage(currentPage - 1);
    }
  });

  nextButton.addEventListener("click", () => {
    const currentPage = Number.parseInt(root.getAttribute("data-current-page") || "1", 10);
    const totalPages = Number.parseInt(root.getAttribute("data-total-pages") || "1", 10);

    if (currentPage < totalPages) {
      loadPage(currentPage + 1);
    }
  });

  if (filterForm) {
    filterForm.addEventListener("change", () => {
      loadPage(1);
    });
  }

  resetButton.addEventListener("click", () => {
    cityInput.value = "";
    dateInput.value = "";
    loadPage(1);
  });

  window.addEventListener("popstate", () => {
    const url = new URL(window.location.href);
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10);
    cityInput.value = url.searchParams.get("city") || "";
    dateInput.value = url.searchParams.get("date") || "";

    loadPage(Number.isFinite(page) && page > 0 ? page : 1, { pushState: false });
  });
}

function renderUsersTableBody(tbody, users) {
  tbody.innerHTML = "";

  if (!users.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 4;
    cell.className = "table-empty";
    cell.textContent = "Пользователи пока не зарегистрированы";
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const nameLink = document.createElement("a");
    const idCell = document.createElement("td");
    const cityCell = document.createElement("td");
    const updatedCell = document.createElement("td");

    nameLink.href = `/api/admin/users/${user.id}`;
    nameLink.textContent = user.displayName;
    nameCell.appendChild(nameLink);
    idCell.textContent = String(user.id);
    cityCell.textContent = user.city;
    updatedCell.textContent = user.createdAt;

    row.append(nameCell, idCell, cityCell, updatedCell);
    tbody.appendChild(row);
  });
}

function updatePaginationState(root, status, prevButton, nextButton, pagination) {
  root.setAttribute("data-current-page", String(pagination.currentPage));
  root.setAttribute("data-total-pages", String(pagination.totalPages));
  status.textContent = `Страница ${pagination.currentPage} из ${pagination.totalPages}`;
  prevButton.disabled = !pagination.hasPreviousPage;
  nextButton.disabled = !pagination.hasNextPage;
}

function applyUserFiltersToUrl(url, city, date) {
  if (city) {
    url.searchParams.set("city", city);
  } else {
    url.searchParams.delete("city");
  }

  if (date) {
    url.searchParams.set("date", date);
  } else {
    url.searchParams.delete("date");
  }
}

function syncFilterInputs(cityInput, dateInput, filters) {
  if (!filters) {
    return;
  }

  cityInput.value = filters.city || "";
  dateInput.value = filters.date || "";
}
