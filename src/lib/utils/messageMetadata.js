/**
 * MESSAGE METADATA UTILITIES
 * Ensure consistent message structure with required metadata
 *
 * DECISION: Every message includes full metadata
 * Enables audit trail and task pause/resume
 */

export function createMessageMetadata(
  flowKey,
  category,
  systemPromptId,
  step,
  language
) {
  return {
    flowKey,
    category,
    systemPromptId,
    step,
    timestamp: Date.now(),
    detectedLanguage: language,
  };
}

export function createUserMessage(
  content,
  flowKey,
  category,
  systemPromptId,
  language
) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: "user",
    content,
    meta: createMessageMetadata(
      flowKey,
      category,
      systemPromptId,
      "retrieve",
      language
    ),
  };
}

export function createAssistantMessage(
  content,
  flowKey,
  category,
  systemPromptId,
  citations = []
) {
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: "assistant",
    content,
    meta: createMessageMetadata(
      flowKey,
      category,
      systemPromptId,
      "respond",
      null
    ),
  };

  if (citations && citations.length > 0) {
    message.citations = citations;
  }

  return message;
}

export function createToolMessage(content, actionType, actionStatus) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role: "tool",
    content,
    meta: {
      flowKey: null,
      category: "Action",
      step: "action",
      timestamp: Date.now(),
      actionType,
      actionStatus,
    },
  };
}

export function attachCitationsToMessage(message, citations) {
  return {
    ...message,
    citations: citations || [],
  };
}

export function getRecentMessages(messages, limit = 10) {
  return messages.slice(-limit);
}

export function filterMessagesByFlow(messages, flowKey) {
  return messages.filter((msg) => msg.meta?.flowKey === flowKey);
}

export function filterMessagesByStep(messages, step) {
  return messages.filter((msg) => msg.meta?.step === step);
}

export function formatMessageForOpenAI(message) {
  return {
    role: message.role,
    content: message.content,
  };
}

export function validateMessageMetadata(message) {
  const { meta } = message;

  if (!meta) {
    throw new Error("Message missing metadata");
  }

  const required = ["step", "timestamp"];
  for (const field of required) {
    if (!(field in meta)) {
      throw new Error(`Message metadata missing required field: ${field}`);
    }
  }

  return true;
}

export function logMessage(message, prefix = "📝") {
  console.log(
    `${prefix} [${message.role.toUpperCase()}] ${message.content.substring(
      0,
      100
    )}...`
  );
}
