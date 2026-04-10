const tg = window.Telegram?.WebApp;
const startButton = document.getElementById("startButton");
const closeButton = document.getElementById("closeButton");
const manualSubmit = document.getElementById("manualSubmit");
const manualInput = document.getElementById("manualInput");
const statusNode = document.getElementById("status");
const titleNode = document.getElementById("title");
const descriptionNode = document.getElementById("description");
const manualLabelNode = document.getElementById("manualLabel");

const dictionary = {
  ru: {
    title: "Сканируйте QR код",
    description:
      "Откройте встроенный сканер Telegram или вставьте ссылку на чек вручную.",
    start: "Открыть сканер Telegram",
    close: "Закрыть",
    manualLabel: "Вставьте QR ссылку вручную",
    manualSubmit: "Отправить",
    ready: "Готово к запуску встроенного сканера.",
    opening: "Открываем встроенный сканер Telegram...",
    unsupported:
      "В этом клиенте встроенный сканер Telegram недоступен. Можно вставить ссылку вручную.",
    processing: "Чек обрабатывается...",
    success: "QR отправлен. Возвращаем вас в бот...",
    failure: "Не удалось отправить QR. Попробуйте ещё раз.",
    invalid: "Нужна ссылка вида https://ofd.soliq.uz/check?...",
    sendUnavailable:
      "Не удалось вернуть данные боту через sendData. Откройте Mini App из клавиатуры Telegram.",
    closed: "Сканер закрыт. Можно открыть его снова или вставить ссылку вручную.",
  },
  uz: {
    title: "QR kodni skaner qiling",
    description:
      "Telegram ichidagi skanerni oching yoki chek havolasini qo'lda joylang.",
    start: "Telegram skanerini ochish",
    close: "Yopish",
    manualLabel: "QR havolani qo'lda kiriting",
    manualSubmit: "Yuborish",
    ready: "Ichki skanerni ishga tushirishga tayyor.",
    opening: "Telegram ichki skaneri ochilmoqda...",
    unsupported:
      "Bu Telegram klientida ichki skaner ishlamayapti. Havolani qo'lda yuborish mumkin.",
    processing: "Chek qayta ishlanmoqda...",
    success: "QR yuborildi. Sizni botga qaytaryapmiz...",
    failure: "QR yuborilmadi. Qayta urinib ko'ring.",
    invalid: "https://ofd.soliq.uz/check?... ko'rinishidagi havola kerak.",
    sendUnavailable:
      "sendData orqali botga ma'lumot yuborib bo'lmadi. Mini App ni Telegram klaviaturasidan oching.",
    closed: "Skaner yopildi. Uni qayta ochish yoki havolani qo'lda yuborish mumkin.",
  },
};

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
closeButton.addEventListener("click", () => tg?.close());
manualSubmit.addEventListener("click", () => {
  void submitQr(manualInput.value.trim());
});

async function startScanner() {
  setStatus(copy.opening);

  try {
    if (typeof tg?.showScanQrPopup === "function") {
      tg.showScanQrPopup({ text: copy.description.slice(0, 64) }, (data) => {
        if (!data) {
          return false;
        }

        if (!data.startsWith("https://ofd.soliq.uz/check")) {
          setStatus(copy.invalid, true);
          return false;
        }

        void submitQr(data);
        return true;
      });

      tg.onEvent?.("scanQrPopupClosed", handleScanClosed);
      return;
    }

    setStatus(copy.unsupported);
  } catch (error) {
    console.error(error);
    setStatus(copy.unsupported, true);
  }
}

async function submitQr(rawValue) {
  if (isSubmitting) {
    return;
  }

  if (!rawValue.startsWith("https://ofd.soliq.uz/check")) {
    setStatus(copy.invalid, true);
    return;
  }

  isSubmitting = true;
  tg?.closeScanQrPopup?.();
  setStatus(copy.processing);

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

    setStatus(copy.success);
    tg?.HapticFeedback?.notificationOccurred("success");
    setTimeout(() => tg?.close(), 1200);
  } catch (error) {
    console.error(error);
    isSubmitting = false;
    setStatus(copy.sendUnavailable, true);
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
  closeButton.textContent = copy.close;
  manualInput.placeholder = "https://ofd.soliq.uz/check?t=...";
}

function handleScanClosed() {
  if (!isSubmitting) {
    setStatus(copy.closed);
  }
}
