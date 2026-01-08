/**
 * DECISION: Centralized environment variable loading with validation
 * Webpack DefinePlugin replaces ENV_* with actual values at compile time
 * Uses safe wrapper to handle undefined variables gracefully
 */

// Safe getter for environment variables - handles undefined gracefully
const getEnv = (key, defaultValue = '') => {
  // Webpack DefinePlugin replaces ENV_* identifiers with JSON strings
  // Use eval to safely access potentially undefined variables
  try {
    // This will be replaced by webpack at compile time
    const varName = `ENV_${key}`;
    const value = typeof globalThis[varName] !== 'undefined' ? globalThis[varName] : undefined;
    return value !== undefined ? value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const OPENAI_CONFIG = {
  apiKey: getEnv('REACT_APP_OPENAI_API_KEY', ''),
  chatModel: getEnv('REACT_APP_OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
  embeddingModel: getEnv('REACT_APP_OPENAI_EMBED_MODEL', 'text-embedding-3-large'),
  temperature: parseFloat(getEnv('REACT_APP_OPENAI_TEMPERATURE', '0.2')),
  maxTokens: parseInt(getEnv('REACT_APP_OPENAI_MAX_TOKENS', '2048'), 10),
};

export const WEAVIATE_CONFIG = {
  url: getEnv('REACT_APP_WEAVIATE_URL', 'http://localhost:8080'),
  apiKey: getEnv('REACT_APP_WEAVIATE_API_KEY', ''),
  classes: {
    HR: getEnv('REACT_APP_WEAVIATE_CLASS_HR', 'HR_Knowledge'),
    TOR: getEnv('REACT_APP_WEAVIATE_CLASS_TOR', 'TOR_Documents'),
    CRM: getEnv('REACT_APP_WEAVIATE_CLASS_CRM', 'CRM_Cases'),
    LEAVE: getEnv('REACT_APP_WEAVIATE_CLASS_LEAVE', 'LeavePolicy'),
  },
  topK: parseInt(getEnv('REACT_APP_WEAVIATE_TOP_K', '8'), 10),
  scoreThreshold: parseFloat(getEnv('REACT_APP_WEAVIATE_SCORE_THRESHOLD', '0')),
};

export const KISSFLOW_CONFIG = {
  domain: getEnv('REACT_APP_KISSFLOW_DOMAIN', ''),
  accountId: getEnv('REACT_APP_KISSFLOW_ACCOUNT_ID', ''),
  appId: getEnv('REACT_APP_KISSFLOW_APP_ID', ''),
  authKey: getEnv('REACT_APP_KISSFLOW_AUTH_KEY', ''),
  authSecret: getEnv('REACT_APP_KISSFLOW_AUTH_SECRET', ''),
  processIds: {
    HR: getEnv('REACT_APP_KISSFLOW_PROCESS_HR', ''),
    TOR: getEnv('REACT_APP_KISSFLOW_PROCESS_TOR', ''),
    CRM: getEnv('REACT_APP_KISSFLOW_PROCESS_CRM', ''),
    LEAVE: getEnv('REACT_APP_KISSFLOW_PROCESS_LEAVE', ''),
  },
};

export const EXTERNAL_DB_CONFIG = {
  connectionKeys: getEnv('REACT_APP_EXTERNAL_DB_CONN_KEYS', '')
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k),
};

export function validateAllConfig() {
  console.log("🔍 Validating all configuration...");
  let valid = true;

  if (!OPENAI_CONFIG.apiKey) {
    console.warn("⚠️ OpenAI API key not configured");
    valid = false;
  } else {
    console.log("✅ OpenAI configuration valid");
  }

  if (!WEAVIATE_CONFIG.url) {
    console.warn("⚠️ Weaviate URL not configured");
    valid = false;
  } else {
    console.log("✅ Weaviate configuration valid");
  }

  if (!KISSFLOW_CONFIG.domain) {
    console.warn("⚠️ Kissflow domain not configured");
    valid = false;
  } else {
    console.log("✅ Kissflow configuration valid");
  }

  return valid;
}
