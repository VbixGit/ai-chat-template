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
  } = request;

  try {
    console.log("🤖 Calling chat API...");

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

    // Call our API endpoint instead of OpenAI directly
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt,
        userMessage,
        context,
        chatHistory,
        temperature,
        maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API error: ${error.error || response.statusText}`);
    }

    const data = await response.json();

    console.log("✅ API response received");

    return {
      content: data.content,
      tokensUsed: data.tokensUsed,
      model: data.model,
    };
  } catch (error) {
    console.error("❌ API call failed:", error);
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
