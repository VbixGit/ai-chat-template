/**
 * LANGUAGE DETECTION SERVICE
 * Detect user language and provide translation stubs
 *
 * DECISION: Pattern-based detection for speed, not ML
 * Can be upgraded to ML model later
 */

const LANGUAGE_PATTERNS = {
  th: { name: "Thai", pattern: /[\u0E00-\u0E7F]/g },
  en: { name: "English", pattern: /[a-zA-Z]/g },
  ja: { name: "Japanese", pattern: /[\u3040-\u309F\u30A0-\u30FF]/g },
  zh: { name: "Chinese", pattern: /[\u4E00-\u9FFF]/g },
  es: { name: "Spanish", pattern: /[á-úñ]/g },
  fr: { name: "French", pattern: /[à-ûœæ]/g },
  vi: { name: "Vietnamese", pattern: /[ă-ữ]/g },
};

export function detectLanguage(text) {
  const scores = {};

  Object.entries(LANGUAGE_PATTERNS).forEach(([lang, { pattern }]) => {
    const matches = (text.match(pattern) || []).length;
    const confidence = text.length > 0 ? matches / text.length : 0;
    scores[lang] = confidence;
  });

  const [mainLanguage, mainScore] = Object.entries(scores).sort(
    ([, a], [, b]) => b - a
  )[0] || ["en", 0];

  return {
    mainLanguage,
    confidence: mainScore,
    allDetected: scores,
    isReliable: mainScore > 0.4,
  };
}

export function getLanguageName(langCode) {
  return LANGUAGE_PATTERNS[langCode]?.name || "Unknown";
}

export async function translateToEnglishForRetrieval(text, sourceLanguage) {
  if (sourceLanguage === "en") {
    return text;
  }

  console.warn(
    "⚠️ Translation to English not yet implemented. Using original text."
  );
  // TODO: Implement OpenAI-based translation
  // const translated = await generateChatCompletion({
  //   systemPrompt: 'You are a translator. Translate the text to English only.',
  //   userMessage: text,
  // });
  return text;
}

export async function translateFromEnglishToUserLanguage(text, targetLanguage) {
  if (targetLanguage === "en") {
    return text;
  }

  console.warn(
    "⚠️ Translation from English not yet implemented. Using original text."
  );
  // TODO: Implement OpenAI-based translation
  // const translated = await generateChatCompletion({
  //   systemPrompt: `You are a translator. Translate the text to ${getLanguageName(targetLanguage)}.`,
  //   userMessage: text,
  // });
  return text;
}
