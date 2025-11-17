import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import KFSDK from "@kissflow/lowcode-client-sdk";

const WEAVIATE_ENDPOINT = process.env.REACT_APP_WEAVIATE_ENDPOINT;
const WEAVIATE_API_KEY = process.env.REACT_APP_WEAVIATE_API_KEY;
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

// ===== Kissflow integration config =====
const KF_POPUP_ID = "Popup_kMvLNHW_ys";

// ===== Suggested Questions (Case-based) =====
const SUGGESTED_QUESTIONS = ["อุปกรณ์พัง", "ระบบล่ม", "ปัญหาการเชื่อมต่อ"];

// ===== Case Solution JSON Schema (MANDATORY) =====
const CASE_SOLUTION_SCHEMA = {
  title: "CaseSolutionResponse",
  type: "object",
  properties: {
    hasSimilarCase: { type: "boolean" },
    solution: { type: "string" },
    referenceCaseTitle: {
      type: "array",
      items: {
        type: "object",
        properties: {
          caseNumber: { type: "string" },
          caseTitle: { type: "string" },
        },
        required: ["caseNumber", "caseTitle"],
        additionalProperties: false,
      },
    },
  },
  required: ["hasSimilarCase", "solution", "referenceCaseTitle"],
  additionalProperties: false,
};

// ===== System Prompt (LLM MUST OUTPUT THAI) =====
const SYSTEM_PROMPT = `คุณคือผู้ช่วยสนับสนุน (Support Assistant) สำหรับองค์กร
หน้าที่: วิเคราะห์ปัญหาของผู้ใช้และให้คำแนะนำการแก้ปัญหาโดยอ้างอิงจากฐานความรู้

【วิธีการตอบ】
1. อ่านประวัติการสนทนา (conversation history) เพื่อเข้าใจ context
2. ตรวจสอบ Knowledge Base - หากมีเคสคล้ายกัน ให้ใช้เป็นอ้างอิง
3. เขียน solution ที่เป็นคำแนะนำเชิงปฏิบัติ (actionable advice)
4. ห้ามเดา - ทั้งหมดต้องเป็นไทยเท่านั้น

【เงื่อนไข】
- Respond naturally like a human support agent
- Use conversation context to provide relevant solutions
- If similar cases exist → hasSimilarCase = true
- If no similar cases → hasSimilarCase = false, solution = "ยังไม่เคยพบเคสนี้ ไม่สามารถให้คำตอบได้"
- Never start with: "พบเคสที่คล้ายกัน", "จากข้อมูลใน KB", "อ้างอิงจากเคส"
- Output MUST be valid JSON immediately`;

// ===== Weaviate Collection Configuration =====
const WEAVIATE_COLLECTION = "CaseSolutionKnowledgeBase";
const WEAVIATE_FIELDS = `
  caseNumber
  caseTitle
  caseType
  caseDescription
  solutionDescription
  instanceID
  _additional {
    certainty
  }
`;

// ===== Helpers =====
const safeJson = (x) => {
  try {
    return JSON.stringify(x);
  } catch {
    return "[]";
  }
};

/**
 * Transform Weaviate results into cleanedKnowledgeBase format
 * Structure: { caseNumber, caseTitle, caseType, caseDescription, solutionDescription, instanceID, certainty }
 */
const transformToCleanedKB = (results = []) => {
  return results.map((item) => ({
    caseNumber: item.caseNumber || "",
    caseTitle: item.caseTitle || "",
    caseType: item.caseType || "",
    caseDescription: item.caseDescription || "",
    solutionDescription: item.solutionDescription || "",
    instanceID: item.instanceID || "",
    certainty: item._additional?.certainty || 0,
  }));
};

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const messagesEndRef = useRef(null);
  const kfRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDarkMode]);

  async function getKf() {
    if (!kfRef.current) {
      try {
        kfRef.current = await KFSDK.initialize();
      } catch (err) {
        console.warn("KFSDK initialize failed:", err);
        kfRef.current = null;
      }
    }
    return kfRef.current;
  }

  /**
   * Send message handler with short memory (session-only)
   * - Messages stored in React state only (not persistent)
   * - Full conversation history passed to LLM for context
   * - Auto-clears on page refresh or browser close
   */
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user", role: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Pass full conversation history for LLM context
    const aiResponse = await handleQuestion(input, [...messages]);
    setMessages((prev) => [...prev, aiResponse]);
    setIsTyping(false);
  };

  const selectSuggestedQuestion = (question) => {
    setInput(question);
  };

  /**
   * Main Case Solver Flow with Conversation Context:
   * - Takes full conversation history for LLM reasoning
   * - LLM can understand context from previous messages
   * - Step 1: Receive user message (e.g., "อุปกรณ์พัง", "ระบบล่ม")
   * - Step 2: Generate embedding vector from user input
   * - Step 3: Query Weaviate with nearVector search (topK=5)
   * - Step 4: Transform results into cleanedKnowledgeBase
   * - Step 5: Build instruction prompt with case info + knowledge base
   * - Step 6: Call LLM with systemPrompt & instructionPrompt & full history
   * - Step 7: Return structured CaseSolutionResponse (JSON schema)
   */
  async function handleQuestion(question, chatHistory) {
    try {
      console.log("[Case Solver] Processing:", question.substring(0, 40));

      // Step 1: Generate embedding from user input
      const embedding = await generateEmbeddingForCase(question);

      // Step 2: Query Weaviate with nearVector search (topK=5)
      const weaviateResults = await searchWeaviateForCases(embedding);

      // Step 3: Transform results into cleanedKnowledgeBase
      const cleanedKB = transformToCleanedKB(weaviateResults);
      console.log(`[Case Solver] Found ${cleanedKB.length} similar cases`);

      // Step 4: Build optimized instruction prompt with context awareness
      // Use recent user questions for better context understanding (faster response)
      const recentQuestions = chatHistory
        .filter((m) => m.sender === "user")
        .slice(-2)
        .map((m) => m.text)
        .join(" -> ");

      const instructionPrompt = `【User Question】
${question}${
        recentQuestions ? `\n【Context from previous】: ${recentQuestions}` : ""
      }

【Available Similar Cases】
${
  cleanedKB.length > 0
    ? cleanedKB
        .map(
          (c, i) =>
            `${i + 1}. Case ${c.caseNumber}: ${c.caseTitle}\n   Solution: ${
              c.solutionDescription
            }\n   Match: ${(c.certainty * 100).toFixed(0)}%`
        )
        .join("\n\n")
    : "No matching cases found"
}

【Respond with】
Analyze using conversation context. Return JSON with hasSimilarCase (bool), solution (Thai), referenceCaseTitle (cases)`;

      // Step 5: Call LLM for case solution
      const caseSolution = await generateCaseSolution(
        instructionPrompt,
        chatHistory
      );

      // Step 6: Validate and return response
      console.log("[Case Solver] Response ready");
      return {
        text: caseSolution.solution,
        sender: "ai",
        role: "assistant",
        caseSolution: caseSolution,
        knowledgeBase: cleanedKB,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Case Solver Error]", msg);
      return {
        text: `เกิดข้อผิดพลาด: ${msg}`,
        sender: "ai",
        role: "assistant",
        caseSolution: null,
        knowledgeBase: [],
      };
    }
  }

  /**
   * Step 1: Generate embedding from user input using OpenAI API
   * Uses text-embedding-3-small model
   */
  async function generateEmbeddingForCase(text) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (err) {
      throw new Error(`Embedding failed: ${err.message}`);
    }
  }

  /**
   * Step 2: Query Weaviate using semantic search (nearVector)
   * Returns topK=5 results with fields from WEAVIATE_FIELDS
   */
  async function searchWeaviateForCases(embedding) {
    const gql = `
      query {
        Get {
          ${WEAVIATE_COLLECTION}(
            nearVector: {
              vector: ${safeJson(embedding)}
            }
            limit: 5
          ) {
            ${WEAVIATE_FIELDS}
          }
        }
      }
    `;

    try {
      const response = await fetch(`${WEAVIATE_ENDPOINT}/v1/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${WEAVIATE_API_KEY}`,
        },
        body: JSON.stringify({ query: gql }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Weaviate error: ${response.status}`);
      }

      const json = await response.json();
      if (json.errors) {
        throw new Error(
          `Weaviate GraphQL errors: ${JSON.stringify(json.errors)}`
        );
      }

      const results = json?.data?.Get?.[WEAVIATE_COLLECTION] || [];
      return results;
    } catch (err) {
      throw new Error(`Weaviate search failed: ${err.message}`);
    }
  }

  /**
   * Call LLM for case solution with optimized context
   * - Uses recent conversation history (last 2 exchanges) for faster response
   * - System prompt + optimized instruction + context for fluent conversation
   * - LLM MUST return JSON matching CaseSolutionResponse schema
   * - ALL LLM-generated content MUST be Thai
   */
  async function generateCaseSolution(instructionPrompt, chatHistory) {
    // Optimize: Use only recent conversation (last 2 user messages) to reduce tokens
    const recentHistory = (chatHistory || [])
      .slice(-4) // Last 2 exchanges (user + assistant pairs)
      .map((m) => ({
        role: m.role,
        content: m.text,
      }));

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini", // Use faster model for better response time
            temperature: 0.2, // Lower temperature for more consistent output
            max_tokens: 500, // Limit output length for faster response
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...recentHistory, // Only recent context (not full history)
              { role: "user", content: instructionPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "case_solution_response",
                schema: CASE_SOLUTION_SCHEMA,
                strict: true,
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      const jsonString = data.choices[0].message.content;
      const parsedResponse = JSON.parse(jsonString);

      // Validate required schema fields
      if (
        !parsedResponse.hasOwnProperty("hasSimilarCase") ||
        !parsedResponse.hasOwnProperty("solution") ||
        !parsedResponse.hasOwnProperty("referenceCaseTitle")
      ) {
        throw new Error("LLM response missing required fields");
      }

      return parsedResponse;
    } catch (err) {
      throw new Error(`LLM generation failed: ${err.message}`);
    }
  }

  // ===== Kissflow opener =====
  async function openInKissflow(instanceIdsArray) {
    const ids = (instanceIdsArray || [])
      .map((s) => (s || "").trim())
      .filter(Boolean);
    if (!ids.length) {
      alert("ไม่พบ instanceID สำหรับส่งไป Kissflow");
      return;
    }
    const joined = ids.join(",");

    const kf = await getKf();
    if (!kf) {
      alert(
        "ไม่สามารถเชื่อมต่อ Kissflow SDK ได้ (ต้องเปิดจาก Custom Page ภายใน Kissflow)"
      );
      return;
    }

    try {
      console.log("instanceidreport:", joined);
      await kf.app.page.openPopup(KF_POPUP_ID, { instanceidreport: joined });
    } catch (err) {
      console.error("Open popup failed:", err);
      alert("เปิด popup ไม่สำเร็จ: " + (err?.message || "unknown error"));
    }
  }

  // ===== UI =====
  return (
    <div className="App">
      <div className="chat-header">
        <div className="header-title">Nong Cassy AI Assistant</div>
        <button
          className="theme-toggle-btn"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          )}
        </button>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.sender}-row`}>
              <div className="message-avatar">
                {msg.sender === "user" ? (
                  <div className="avatar user-avatar">U</div>
                ) : (
                  <div className="avatar ai-avatar">AI</div>
                )}
              </div>
              <div className={`message-bubble ${msg.sender}-message`}>
                <div className="message-text">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>

                {msg.sender === "ai" &&
                  msg.knowledgeBase &&
                  msg.knowledgeBase.length > 0 && (
                    <div className="refs-inline">
                      <div className="refs-inline-header">
                        <strong>Related Cases</strong>
                        <button
                          type="button"
                          className="refs-open-all"
                          onClick={() =>
                            openInKissflow(
                              msg.knowledgeBase.map((r) => r.instanceID)
                            )
                          }
                          title="Open all in Kissflow"
                        >
                          Open all ({msg.knowledgeBase.length})
                        </button>
                      </div>

                      <ul className="refs-inline-list">
                        {msg.knowledgeBase.map((r, i) => (
                          <li
                            key={`${r.instanceID}-${i}`}
                            className="refs-inline-item"
                          >
                            <div className="refs-inline-meta">
                              <div className="refs-inline-title">
                                Case {i + 1} • {r.caseTitle || "Untitled"}
                              </div>
                              <div className="refs-inline-sub">
                                ID: {r.caseNumber} • Certainty:{" "}
                                {(r.certainty * 100).toFixed(1)}%
                              </div>
                            </div>
                            <button
                              type="button"
                              className="refs-open-one"
                              onClick={() => openInKissflow([r.instanceID])}
                              title="Open in Kissflow"
                            >
                              Open
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="chat-input-form">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            placeholder="พิมพ์คำถามของคุณที่นี่... (Shift+Enter สำหรับบรรทัดใหม่)"
            disabled={isTyping}
            rows="3"
            className="chat-input-textarea"
          />
          <button type="submit" disabled={isTyping} aria-label="Send">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>

        <div className="suggested-questions-wrapper">
          <p className="suggested-questions-label">แนะนำคำถาม</p>
          <div className="suggested-questions-grid">
            {SUGGESTED_QUESTIONS.map((question, idx) => (
              <button
                key={idx}
                type="button"
                className="suggested-question-btn"
                onClick={() => selectSuggestedQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
