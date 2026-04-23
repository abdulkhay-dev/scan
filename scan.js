import { createI18n } from "./i18n.js";

const tg = window.Telegram?.WebApp;
const startButton = document.getElementById("startButton");
const closeButton = document.getElementById("closeButton");
const manualSubmit = document.getElementById("manualSubmit");
const manualInput = document.getElementById("manualInput");
const statusNode = document.getElementById("status");
const titleNode = document.getElementById("title");
const descriptionNode = document.getElementById("description");
const manualLabelNode = document.getElementById("manualLabel");

let isSubmitting = false;
let scannerStarted = false;
const language = tg?.initDataUnsafe?.user?.language_code?.toLowerCase().startsWith("uz")
  ? "uz"
  : "ru";
let t = (key) => key;

void init();

async function init() {
  const i18n = await createI18n(language);
  t = i18n.t;

  applyLanguage();
  setStatus(t("webapp.scan.ready"));

  tg?.ready();
  tg?.expand();
  tg?.onEvent?.("scanQrPopupClosed", handleScanClosed);

  startButton.addEventListener("click", startScanner);
  closeButton.addEventListener("click", () => tg?.close());
  manualSubmit.addEventListener("click", () => {
    void submitQr(manualInput.value.trim());
  });
  document.body.addEventListener("click", handleFirstInteraction, { once: true });

  window.addEventListener("load", () => {
    void startScanner();
  });
  setTimeout(() => {
    void startScanner();
  }, 700);
}

async function startScanner() {
  if (scannerStarted || isSubmitting) {
    return;
  }

  scannerStarted = true;
  startButton.disabled = true;
  setStatus(t("webapp.scan.opening"));

  try {
    if (typeof tg?.showScanQrPopup === "function") {
      tg.showScanQrPopup({ text: t("webapp.scan.description").slice(0, 64) }, (data) => {
        if (!data) {
          return false;
        }

        if (!data.startsWith("https://ofd.soliq.uz/check")) {
          setStatus(t("webapp.scan.invalid"), true);
          return false;
        }

        void submitQr(data);
        return true;
      });

      setTimeout(() => {
        if (!isSubmitting) {
          scannerStarted = false;
          startButton.disabled = false;
        }
      }, 1000);
      return;
    }

    scannerStarted = false;
    startButton.disabled = false;
    setStatus(t("webapp.scan.unsupported"));
  } catch (error) {
    console.error(error);
    scannerStarted = false;
    startButton.disabled = false;
    setStatus(t("webapp.scan.unsupported"), true);
  }
}

function handleFirstInteraction(event) {
  if (
    event.target === startButton ||
    event.target === closeButton ||
    event.target === manualSubmit ||
    event.target === manualInput
  ) {
    return;
  }

  void startScanner();
}

async function submitQr(rawValue) {
  if (isSubmitting) {
    return;
  }

  if (!rawValue.startsWith("https://ofd.soliq.uz/check")) {
    setStatus(t("webapp.scan.invalid"), true);
    return;
  }

  isSubmitting = true;
  tg?.closeScanQrPopup?.();
  setStatus(t("webapp.scan.processing"));

  try {
    if (typeof tg?.sendData !== "function") {
      throw new Error("sendData is not available");
    }

    tg.sendData(
      JSON.stringify({
        type: "scan_qr",
        qrUrl: rawValue,
      }),
    );

    setStatus(t("webapp.scan.success"));
    tg?.HapticFeedback?.notificationOccurred("success");
    setTimeout(() => tg?.close(), 1200);
  } catch (error) {
    console.error(error);
    isSubmitting = false;
    setStatus(t("webapp.scan.sendUnavailable"), true);
  }
}

function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#a93e2f" : "";
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t("webapp.scan.pageTitle");
  document.getElementById("eyebrow").textContent = t("webapp.scan.eyebrow");
  titleNode.textContent = t("webapp.scan.title");
  descriptionNode.textContent = t("webapp.scan.description");
  manualLabelNode.textContent = t("webapp.scan.manualLabel");
  manualSubmit.textContent = t("webapp.scan.manualSubmit");
  startButton.textContent = t("webapp.scan.start");
  closeButton.textContent = t("webapp.scan.close");
  manualInput.placeholder = t("webapp.scan.manualPlaceholder");
}

function handleScanClosed() {
  scannerStarted = false;
  startButton.disabled = false;

  if (!isSubmitting) {
    setStatus(t("webapp.scan.closed"));
  }
}
