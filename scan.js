const tg = window.Telegram?.WebApp;
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const manualSubmit = document.getElementById("manualSubmit");
const manualInput = document.getElementById("manualInput");
const statusNode = document.getElementById("status");
const titleNode = document.getElementById("title");
const descriptionNode = document.getElementById("description");
const manualLabelNode = document.getElementById("manualLabel");
const video = document.getElementById("video");

const dictionary = {
  ru: {
    title: "Сканируйте QR код",
    description: "Наведите камеру на QR код фискального чека или вставьте ссылку вручную.",
    start: "Включить камеру",
    stop: "Остановить камеру",
    manualLabel: "Вставьте QR ссылку вручную",
    manualSubmit: "Отправить",
    ready: "Готово к запуску камеры.",
    opening: "Запрашиваем доступ к камере...",
    unsupported:
      "В этом WebView автоматическое распознавание QR может быть недоступно. Можно вставить ссылку вручную.",
    active: "Камера включена. Наведите её на QR код чека.",
    processing: "Чек обрабатывается...",
    success: "QR отправлен. Возвращаем вас в бот...",
    failure: "Не удалось отправить QR. Попробуйте ещё раз.",
    invalid: "Нужна ссылка вида https://ofd.soliq.uz/check?...",
    noUser: "Не удалось определить пользователя Telegram.",
    noCamera: "Не удалось получить доступ к камере.",
  },
  uz: {
    title: "QR kodni skaner qiling",
    description:
      "Kamerani fiskal chekdagi QR kodga tuting yoki havolani qo'lda joylang.",
    start: "Kamerani yoqish",
    stop: "Kamerani to'xtatish",
    manualLabel: "QR havolani qo'lda kiriting",
    manualSubmit: "Yuborish",
    ready: "Kamerani ishga tushirishga tayyor.",
    opening: "Kameraga ruxsat so'ralmoqda...",
    unsupported:
      "Bu WebView ichida avtomatik QR o'qish ishlamasligi mumkin. Havolani qo'lda yuborish mumkin.",
    active: "Kamera yoqildi. Uni chekdagi QR kodga qarating.",
    processing: "Chek qayta ishlanmoqda...",
    success: "QR yuborildi. Sizni botga qaytaryapmiz...",
    failure: "QR yuborilmadi. Qayta urinib ko'ring.",
    invalid: "https://ofd.soliq.uz/check?... ko'rinishidagi havola kerak.",
    noUser: "Telegram foydalanuvchisini aniqlab bo'lmadi.",
    noCamera: "Kameraga kirish olinmadi.",
  },
};

let stream = null;
let detector = null;
let animationFrameId = null;
let isSubmitting = false;

const language = tg?.initDataUnsafe?.user?.language_code?.toLowerCase().startsWith("uz")
  ? "uz"
  : "ru";
const copy = dictionary[language];

applyLanguage();
setStatus(copy.ready);

tg?.ready();
tg?.expand();

startButton.addEventListener("click", startScanner);
stopButton.addEventListener("click", stopScanner);
manualSubmit.addEventListener("click", () => {
  void submitQr(manualInput.value.trim());
});

async function startScanner() {
  setStatus(copy.opening);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });

    video.srcObject = stream;
    startButton.disabled = true;
    stopButton.disabled = false;

    if ("BarcodeDetector" in window) {
      detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setStatus(copy.active);
      tick();
      return;
    }

    setStatus(copy.unsupported);
  } catch (error) {
    console.error(error);
    setStatus(copy.noCamera, true);
  }
}

function stopScanner() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  video.srcObject = null;
  startButton.disabled = false;
  stopButton.disabled = true;
  setStatus(copy.ready);
}

async function tick() {
  if (!detector || !video.videoWidth || isSubmitting) {
    animationFrameId = requestAnimationFrame(tick);
    return;
  }

  try {
    const barcodes = await detector.detect(video);
    const qr = barcodes.find((item) => typeof item.rawValue === "string" && item.rawValue);

    if (qr?.rawValue) {
      void submitQr(qr.rawValue);
      return;
    }
  } catch (error) {
    console.error(error);
  }

  animationFrameId = requestAnimationFrame(tick);
}

async function submitQr(rawValue) {
  if (isSubmitting) {
    return;
  }

  if (!rawValue.startsWith("https://ofd.soliq.uz/check")) {
    setStatus(copy.invalid, true);
    return;
  }

  const telegramId = tg?.initDataUnsafe?.user?.id;

  if (!telegramId) {
    setStatus(copy.noUser, true);
    return;
  }

  isSubmitting = true;
  stopScanner();
  setStatus(copy.processing);

  try {
    const response = await fetch(`${window.location.origin}/api/scan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        qrUrl: rawValue,
        telegramId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Scan request failed with status ${response.status}`);
    }

    setStatus(copy.success);
    tg?.HapticFeedback?.notificationOccurred("success");
    setTimeout(() => tg?.close(), 1200);
  } catch (error) {
    console.error(error);
    isSubmitting = false;
    setStatus(copy.failure, true);
  }
}

function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.style.color = isError ? "#a93e2f" : "";
}

function applyLanguage() {
  titleNode.textContent = copy.title;
  descriptionNode.textContent = copy.description;
  manualLabelNode.textContent = copy.manualLabel;
  manualSubmit.textContent = copy.manualSubmit;
  startButton.textContent = copy.start;
  stopButton.textContent = copy.stop;
  manualInput.placeholder = "https://ofd.soliq.uz/check?t=...";
}
