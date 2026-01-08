// api/chat.js - Vercel Serverless Function
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      systemPrompt,
      userMessage,
      context,
      chatHistory,
      temperature,
      maxTokens,
    } = req.body;

    // Get API key from environment variables
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    // Build messages array
    const messages = [{ role: "system", content: systemPrompt }];

    // Add recent chat history
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.slice(-5).forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

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

    // Call OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 1000,
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

    res.status(200).json({
      content,
      tokensUsed: data.usage,
      model: data.model,
    });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
