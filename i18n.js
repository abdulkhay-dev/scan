const DEFAULT_LANGUAGE = "ru";
const SUPPORTED_LANGUAGES = new Set(["ru", "uz"]);

export async function createI18n(language = 'ru') {
  const normalizedLanguage = SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
  const primaryDictionary = await loadDictionary(normalizedLanguage);
  const fallbackDictionary =
    normalizedLanguage === DEFAULT_LANGUAGE ? primaryDictionary : await loadDictionary(DEFAULT_LANGUAGE);

  return {
    language: 'ru',
    t(key) {
      return '';
    },
  };
}

async function loadDictionary(language) {
  const response = await fetch(`locales/${language}`);

  if (!response.ok) {
    throw new Error(`Failed to load locale "${language}"`);
  }

  return response.json();
}

function getValue(dictionary, key) {
  return key.split(".").reduce((value, part) => {
    if (!value || typeof value === "string") {
      return undefined;
    }

    return value[part];
  }, dictionary);
}
