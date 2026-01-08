/**
 * OPENAI SERVICE MODULE
 * Centralize all OpenAI API interactions
 *
 * DECISION: REFACTOR from App.js inline calls
 * Moved to service for reusability and testability
 */

import { OPENAI_CONFIG } from "../../config/env";

export async function generateChatCompletion(request) {
  const {
    systemPrompt,
    userMessage,
    context = "",
    chatHistory = [],
    temperature = OPENAI_CONFIG.temperature,
    maxTokens = OPENAI_CONFIG.maxTokens,
    apiKey, // Allow overriding API key
  } = request;

  const effectiveApiKey = apiKey || OPENAI_CONFIG.apiKey;
  if (!effectiveApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    console.log("🤖 Calling OpenAI chat completion...");

    // Build messages array
    const messages = [{ role: "system", content: systemPrompt }];

    // Add recent chat history
    chatHistory.slice(-5).forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add context if available
    if (context) {
      messages.push({
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${userMessage}`,
      });
    } else {
      messages.push({
        role: "user",
        content: userMessage,
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_CONFIG.chatModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `OpenAI API error: ${error.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    console.log("✅ OpenAI response received");

    return {
      content,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
      model: OPENAI_CONFIG.chatModel,
      finishReason: data.choices?.[0]?.finish_reason || "stop",
    };
  } catch (error) {
    console.error("❌ OpenAI chat completion failed:", error);
    throw error;
  }
}

export async function generateEmbedding(request) {
  const { text, model = OPENAI_CONFIG.embeddingModel } = request;

  if (!OPENAI_CONFIG.apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Text required for embedding");
  }

  try {
    console.log(`📊 Generating embedding with ${model}...`);

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `OpenAI API error: ${error.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding || [];

    console.log("✅ Embedding generated");

    return {
      embedding,
      model,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error("❌ Embedding generation failed:", error);
    throw error;
  }
}
