import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import KFSDK from "@kissflow/lowcode-client-sdk";

// ===== Environment Variables =====
const WEAVIATE_ENDPOINT = process.env.REACT_APP_WEAVIATE_ENDPOINT || "";
const WEAVIATE_API_KEY = process.env.REACT_APP_WEAVIATE_API_KEY || "";
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || "";

// ===== Kissflow integration config =====
const KF_POPUP_ID = "Popup_Hk6UKl1HO-";
const KISSFLOW_PROCESS_NAME = "Case_Management_A02";
const KISSFLOW_CREATE_ITEM_API =
  process.env.REACT_APP_KISSFLOW_CREATE_ITEM_API || "";
const KISSFLOW_FORM_ID = process.env.REACT_APP_KISSFLOW_FORM_ID || "";
const KISSFLOW_ACCESS_KEY_ID = process.env.KISSFLOW_ACCESS_KEY_ID || "";
const KISSFLOW_ACCESS_KEY_SECRET = process.env.KISSFLOW_ACCESS_KEY_SECRET || "";

// ===== Kissflow Field ID Mappings =====
// TODO: Replace these with actual field IDs from your Kissflow process
// Go to your process form in Kissflow and get the field IDs by inspecting the form
const KISSFLOW_FIELD_MAPPING = {
  Case_Title: "Case_Title", // Replace with actual field ID
  Case_Type: "Case_Type", // Replace with actual field ID
  Case_Description: "Case_Description", // Replace with actual field ID
  AI_Suggestions: "AI_Suggestions", // Replace with actual field ID
  Solution_Description: "Solution_Description", // Replace with actual field ID
  Requester_Email: "Requester_Email", // Replace with actual field ID
};

// ===== Suggested Questions =====
const SUGGESTED_QUESTIONS = ["อุปกรณ์พัง", "ระบบล่ม", "ปัญหาการเชื่อมต่อ"];

// ===== Case Solution JSON Schema =====
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

// ===== System Prompt =====
const SYSTEM_PROMPT = `คุณคือผู้เชี่ยวชาญด้าน Case Management
หน้าที่: วิเคราะห์ปัญหา และให้คำแนะนำการจัดการเพื่อแก้ไข

【หลักการตอบ】
1. ตอบแบบตรงไปตรงมา ไม่ต้องมีคำชำรุดหรือ personality
2. มุ่งเน้นคำแนะนำเชิงปฏิบัติ (actionable steps) เพื่อแก้ปัญหาในเบื้องต้น
3. อ้างอิงจากเคสที่คล้ายกัน (ถ้ามี) เพื่อให้การแนะนำมีความน่าเชื่อถือ
4. ตอบเป็นภาษาไทยเท่านั้น
5. ไม่ต้องการคำว่า "ยินดี", "ช่วยเหลือ", "ค่อนข้าง", "ประมาณ", ฯลฯ

【รูปแบบคำตอบ】
ประเมินสถานการณ์ → บ่งชี้สาเหตุเบื้องต้น → แนะนำวิธีแก้ไขขั้นแรก → ระบุขั้นตอนปฏิบัติ

【ข้อห้าม】
- ห้ามใส่คำลักษณะนาม ความรู้สึก หรือการสื่อสารแบบมนุษย์
- ห้ามพูดถึงตัวเองหรือบทบาท
- ห้ามใส่ emoji หรือสัญลักษณ์พิเศษ
- ห้ามพูดว่า "พบเคสที่คล้ายกัน" ให้เอ่ยถึง "เคส" อย่างตรงไปตรงมา`;

// ===== Weaviate Configuration =====
const WEAVIATE_COLLECTION = "CaseSolutionKnowledgeBase";

// ===== Helpers =====
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

// ===== MERGED API FUNCTIONS FROM SERVER.JS =====

/**
 * Generate embedding from question using OpenAI API
 */
async function generateQuestionEmbedding(question) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: question,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Embedding API error: ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;
  return embedding;
}

/**
 * Search Weaviate for similar cases using semantic similarity
 */
async function searchWeaviateForCases(embedding) {
  const topK = 5;
  const query = {
    query: `
      {
        Get {
          ${WEAVIATE_COLLECTION}(
            nearVector: { vector: ${JSON.stringify(embedding)} }
            limit: ${topK}
          ) {
            caseNumber
            caseTitle
            caseType
            caseDescription
            solutionDescription
            instanceID
            _additional { certainty }
          }
        }
      }
    `,
  };

  const response = await fetch(`${WEAVIATE_ENDPOINT}/v1/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WEAVIATE_API_KEY}`,
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Weaviate search failed: ${
        errorData.errors?.[0]?.message || response.statusText
      }`
    );
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(`Weaviate error: ${JSON.stringify(data.errors)}`);
  }

  const documents = data.data?.Get?.[WEAVIATE_COLLECTION] || [];
  return documents;
}

/**
 * Generate answer from OpenAI using case context and chat history
 */
async function generateAnswerFromOpenAI(context, question, chatHistory) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const systemPrompt = `คุณคือผู้เชี่ยวชาญด้าน Case Management ตอบแบบตรงไปตรงมา

หลักเกณฑ์:
- ตอบโดยแนะนำขั้นตอนแก้ไขปัญหาที่เจาะจง
- ใช้ข้อมูลจากเคสที่คล้ายกันในฐานความรู้ (ถ้ามี)
- ไม่ต้องมีคำชำรุด ความสุภาพ หรือ personality
- ตอบเป็นภาษาไทยเท่านั้น ไม่ต้องแปล
- ถ้าไม่มีข้อมูลเพียงพอ ให้ระบุชัดว่า "ข้อมูลไม่เพียงพอ" หรือ "ต้องการข้อมูลเพิ่มเติม"
- ไม่ต้องมี greeting, closing, หรือการสื่อสารแบบสังคม`;

  // Filter chatHistory to only include valid messages with role property
  const validHistory = chatHistory.filter(
    (msg) => msg && msg.role && msg.content
  );
  const recentHistory = validHistory.slice(-4); // Keep last 4 messages

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: `Q: ${question}\n${context}` },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `LLM API error: ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const answer = data.choices[0].message.content.trim();
  return answer;
}

/**
 * Generate structured case data for Kissflow from question, context, and answer
 */
async function generateKissflowCaseData(question, context, answer) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const systemPrompt = `You are a case management expert. Your task is to generate structured case data for the Kissflow system based on the user's question and similar cases from the knowledge base.

Generate a JSON object with the following fields:
- Case_Title: A concise title for the case (max 100 characters)
- Case_Type: The type of case - must be one of: "Customer Service", "HR", "Legal", "Technical Support"
- Case_Description: Detailed description of the case issue (max 500 characters)
- AI_Suggestions: AI recommendations for solving the issue based on similar cases (max 300 characters)
- Solution_Description: Detailed explanation of how to resolve the case (max 500 characters)

Return ONLY valid JSON, no additional text or explanation.`;

  const userPrompt = `User's Question/Issue: ${question}

Similar Cases from Knowledge Base:
${context}

AI Generated Answer/Solution:
${answer}

Based on the above information, generate the Kissflow case data in JSON format.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    // Return default case data if generation fails
    return {
      Case_Title: question.substring(0, 100),
      Case_Type: "Customer Service",
      Case_Description: question.substring(0, 500),
      AI_Suggestions: answer.substring(0, 300),
      Solution_Description: answer.substring(0, 500),
    };
  }

  const data = await response.json();
  const jsonString = data.choices[0].message.content.trim();

  try {
    const caseData = JSON.parse(jsonString);

    // Validate required fields
    const requiredFields = [
      "Case_Title",
      "Case_Type",
      "Case_Description",
      "AI_Suggestions",
      "Solution_Description",
    ];
    for (const field of requiredFields) {
      if (!caseData.hasOwnProperty(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate Case_Type
    const validTypes = ["Customer Service", "HR", "Legal", "Technical Support"];
    if (!validTypes.includes(caseData.Case_Type)) {
      caseData.Case_Type = "Customer Service"; // Default to Customer Service
    }

    return caseData;
  } catch (err) {
    // Return default case data on parse error
    return {
      Case_Title: question.substring(0, 100),
      Case_Type: "Customer Service",
      Case_Description: question.substring(0, 500),
      AI_Suggestions: answer.substring(0, 300),
      Solution_Description: answer.substring(0, 500),
    };
  }
}

/**
 * Send Kissflow case data to create new item using native SDK API
 * Uses kf.api() method instead of HTTP REST API
 * IMPORTANT: Update KISSFLOW_FIELD_MAPPING with your actual Kissflow field IDs
 */
async function sendKissflowCreateRequest(caseData, getKfFunc, getUserInfoFunc) {
  try {
    // Get Kissflow SDK instance and user info using passed functions
    const kf = await getKfFunc();
    if (!kf) {
      throw new Error("Kissflow SDK not initialized");
    }

    const userInfo = await getUserInfoFunc();
    const { accountId } = userInfo;

    // Map case data to Kissflow field IDs using the configured mapping
    const payload = {
      [KISSFLOW_FIELD_MAPPING.Case_Title]: caseData.Case_Title || "",
      [KISSFLOW_FIELD_MAPPING.Case_Type]: caseData.Case_Type || "",
      [KISSFLOW_FIELD_MAPPING.Case_Description]:
        caseData.Case_Description || "",
      [KISSFLOW_FIELD_MAPPING.AI_Suggestions]: caseData.AI_Suggestions || "",
      [KISSFLOW_FIELD_MAPPING.Solution_Description]:
        caseData.Solution_Description || "",
      [KISSFLOW_FIELD_MAPPING.Requester_Email]: userInfo.email || "",
    };

    // Format: /process/{processVersion}/{accountId}/{processName}/batch/create/submit
    const apiEndpoint = `/process/2/${accountId}/${KISSFLOW_PROCESS_NAME}/create/submit`;
    const options = {
      method: "POST",
      body: JSON.stringify(payload),
    };

    const result = await kf.api(apiEndpoint, options);
    return result;
  } catch (err) {
    throw new Error(`Failed to create Kissflow item: ${err.message}`);
  }
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [createdItemData, setCreatedItemData] = useState(null);
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
        kfRef.current = null;
      }
    }
    return kfRef.current;
  }

  /**
   * Extract Kissflow user information from SDK
   * Returns: { userId, accountId, name, email }
   */
  async function getKissflowUserInfo() {
    try {
      const kf = await getKf();
      if (!kf || !kf.account || !kf.user) {
        throw new Error("Kissflow SDK not properly initialized");
      }

      const userId = kf.user._id;
      const accountId = kf.account._id;
      const name = kf.user.Name || "";
      const email = kf.user.Email || "";

      return { userId, accountId, name, email };
    } catch (err) {
      throw new Error(`Failed to get user info: ${err.message}`);
    }
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
   * - Step 1: Generate embedding from user question
   * - Step 2: Search Weaviate for similar cases
   * - Step 3: Generate answer from OpenAI with context
   * - Step 4: Generate Kissflow case data
   * - Step 5: Return structured response
   */
  async function handleQuestion(question, chatHistory) {
    try {
      // Step 1: Generate embedding
      const embedding = await generateQuestionEmbedding(question);

      // Step 2: Search Weaviate
      const docs = await searchWeaviateForCases(embedding);

      if (docs.length === 0) {
        return {
          text: "ไม่พบเคสที่คล้ายกัน กรุณาลองค้นหาด้วยคำศัพท์อื่น",
          sender: "ai",
          role: "assistant",
          knowledgeBase: [],
          kissflowData: null,
        };
      }

      // Step 3: Build context
      const context = docs
        .map(
          (d, i) =>
            `Case #${i + 1}:\n- Case Number: ${d.caseNumber}\n- Title: ${
              d.caseTitle
            }\n- Type: ${d.caseType}\n- Description: ${
              d.caseDescription
            }\n- Solution: ${d.solutionDescription}\n- Relevance: ${(
              d._additional.certainty * 100
            ).toFixed(2)}%`
        )
        .join("\n\n---\n\n");

      // Step 4: Generate answer
      const answer = await generateAnswerFromOpenAI(
        context,
        question,
        chatHistory
      );

      // Step 5: Generate Kissflow case data
      const kissflowData = await generateKissflowCaseData(
        question,
        context,
        answer
      );

      // Step 6: Build citations
      const citations = docs.map((d, i) => ({
        index: i + 1,
        title: d.caseTitle,
        caseNumber: d.caseNumber,
        type: d.caseType,
      }));

      return {
        text: answer,
        sender: "ai",
        role: "assistant",
        knowledgeBase: citations,
        kissflowData: kissflowData,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return {
        text: `เกิดข้อผิดพลาด: ${msg}`,
        sender: "ai",
        role: "assistant",
        knowledgeBase: [],
        kissflowData: null,
      };
    }
  }
  // ===== Kissflow opener =====
  async function openInKissflow(instanceData) {
    // instanceData: Object with _id and _activity_instance_id from creation response
    // Maps to Kissflow popup parameters: crmpopupinsid and crmpopupatvid

    let popupParameters = {};

    if (typeof instanceData === "object" && instanceData !== null) {
      // Map response fields to Kissflow popup parameter names
      if (instanceData._id) {
        popupParameters.crmpopupinsid = instanceData._id;
      }
      if (instanceData._activity_instance_id) {
        popupParameters.crmpopupatvid = instanceData._activity_instance_id;
      }
    }

    // Check if we have any parameters
    if (Object.keys(popupParameters).length === 0) {
      alert("ไม่พบข้อมูล instanceID สำหรับส่งไป Kissflow");
      return;
    }

    const kf = await getKf();
    if (!kf) {
      alert(
        "ไม่สามารถเชื่อมต่อ Kissflow SDK ได้ (ต้องเปิดจาก Custom Page ภายใน Kissflow)"
      );
      return;
    }

    try {
      await kf.app.page.openPopup(KF_POPUP_ID, popupParameters);
    } catch (err) {
      alert("เปิด popup ไม่สำเร็จ: " + (err?.message || "unknown error"));
    }
  }

  // ===== Kissflow Create New Item =====
  async function createNewItemInKissflow(kissflowCaseData) {
    try {
      setIsTyping(true);

      // Verify Kissflow SDK is available
      const kf = await getKf();
      if (!kf) {
        throw new Error(
          "Kissflow SDK not available. This feature must be accessed from within Kissflow."
        );
      }

      // Create item using native Kissflow SDK API
      // Pass getKf and getKissflowUserInfo as parameters
      const result = await sendKissflowCreateRequest(
        kissflowCaseData,
        getKf,
        getKissflowUserInfo
      );

      // Store created item data for future use
      setCreatedItemData(result);

      // Extract instance ID from result - Kissflow returns _id as the instance identifier
      const instanceId = result._id || result.id || result.instanceID || null;
      const successMessage = `✅ สร้าง New Item สำเร็จ\nID: ${
        instanceId || "N/A"
      }`;
      alert(successMessage);

      // Unlock chat immediately, open popup in background without waiting
      setIsTyping(false);

      // Open popup asynchronously without blocking chat
      if (result._id || result._activity_instance_id) {
        // Use setTimeout to open popup after UI updates
        setTimeout(() => {
          openInKissflow(result).catch(() => {});
        }, 100);
      }

      return result;
    } catch (err) {
      alert(`❌ ไม่สามารถสร้าง New Item ได้:\n${err.message}`);
      setIsTyping(false);
      return null;
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

                {msg.sender === "ai" && msg.kissflowData && (
                  <div className="refs-inline">
                    <div className="refs-inline-header">
                      <strong>ต้องการสร้าง Request ใน Kissflow หรือไม่?</strong>
                      <button
                        type="button"
                        className="refs-create-new"
                        onClick={() => {
                          if (msg.kissflowData) {
                            createNewItemInKissflow(msg.kissflowData);
                          } else {
                            alert("❌ ข้อมูล case ไม่พร้อม กรุณาลองใหม่");
                          }
                        }}
                        title="Create new case from this response"
                      >
                        ➕ New Item
                      </button>
                    </div>
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
