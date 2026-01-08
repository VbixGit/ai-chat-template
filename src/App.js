import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import KFSDK from "@kissflow/lowcode-client-sdk";

// ===== Environment Variables =====
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || "";

// ===== Leave Dataset Configuration =====
// TODO: Replace with your actual Dataset ID and View ID from Kissflow
const LEAVE_DATASET_ID = "Process_With_AI_Chat_Leave_Request_Balan";
const LEAVE_VIEW_ID = "leave_quota";
// TODO: Replace with actual Field IDs in your Dataset
const LEAVE_FIELDS = {
  Vacation: "Vacation_Leave_Balance", // Field ID for Vacation Leave
  Personal: "Personal_Leave_Balance", // Field ID for Personal Leave
  Sick: "Sick_Leave_Balance", // Field ID for Sick Leave
  Email: "Employee_Email", // Field ID for Email (used for search)
};

// ===== Kissflow integration config =====
const KF_POPUP_ID = "Popup_ifoiwDki9p";
const KISSFLOW_PROCESS_NAME = "Leave_Request_A57";
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
const SUGGESTED_QUESTIONS = [
  "เช็ควันลาคงเหลือ",
  "วันลาพักร้อนเหลือเท่าไหร่",
  "ลากิจเหลือกี่วัน",
  "ลาป่วยเหลือเท่าไหร่",
  "ขอทราบสิทธิ์วันลา",
];

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

// ===== MERGED API FUNCTIONS FROM SERVER.JS =====

/**
 * Generate answer from OpenAI using case context and chat history
 */
async function generateAnswerFromOpenAI(context, question, chatHistory) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const systemPrompt = `คุณคือผู้ช่วย AI สำหรับตรวจสอบวันลาคงเหลือของพนักงาน
หน้าที่: ตอบคำถามเกี่ยวกับวันลาคงเหลือ โดยใช้ข้อมูลจาก Context ที่ได้รับ

ข้อกำหนดการตอบ:
1. ตอบเป็นภาษาไทยเท่านั้น
2. ใช้ข้อมูลตัวเลขจาก Context เท่านั้น ห้ามกุตัวเลขขึ้นมาเอง
3. ตอบให้ตรงกับสิ่งที่ผู้ใช้งานถาม:
   - หากถามเจาะจงประเภทวันลา (เช่น "เหลือลาป่วยเท่าไหร่") ให้ตอบเฉพาะประเภทนั้น
   - หากถามภาพรวม (เช่น "วันลาคงเหลือ", "เหลือวันลาอะไรบ้าง") ให้ตอบทั้งหมด
4. หากคำถามไม่เกี่ยวข้องกับวันลาคงเหลือ ให้แจ้งกลับอย่างสุภาพว่า "ขออภัย ฉันสามารถให้ข้อมูลได้เฉพาะเรื่องวันลาคงเหลือเท่านั้น"
5. ตอบสั้น กระชับ ตรงประเด็น`;

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
 * Send Kissflow case data to create new item using native SDK API
 * Uses kf.api() method instead of HTTP REST API
 * IMPORTANT: Update KISSFLOW_FIELD_MAPPING with your actual Kissflow field IDs
 */
async function sendKissflowCreateRequest(getKfFunc, getUserInfoFunc) {
  try {
    // Get Kissflow SDK instance and user info using passed functions
    const kf = await getKfFunc();
    if (!kf) {
      throw new Error("Kissflow SDK not initialized");
    }

    const userInfo = await getUserInfoFunc();
    const { accountId } = userInfo;

    // Format: /process/{processVersion}/{accountId}/{processName}/batch/create/submit
    const apiEndpoint = `/process/2/${accountId}/${KISSFLOW_PROCESS_NAME}/create/submit`;
    const options = {
      method: "POST",
      body: "{}",
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
   * Fetch user leave data from Kissflow Dataset
   */
  async function fetchUserLeaveData(email) {
    try {
      const kf = await getKf();
      if (!kf) throw new Error("KF SDK not initialized");

      const { accountId } = await getKissflowUserInfo();

      // API: /dataset/2/:account_id/:dataset_id/view/:view_id/list
      const endpoint = `/dataset/2/${accountId}/${LEAVE_DATASET_ID}/view/${LEAVE_VIEW_ID}/list?q=${email}&page_number=1&page_size=10&search_field=${LEAVE_FIELDS.Email}`;

      console.log("Fetching leave data from:", endpoint);
      const response = await kf.api(endpoint, { method: "GET" });

      // Assuming response is the list of items or contains it
      // Adjust based on actual API response structure if needed
      return response.Data || response || [];
    } catch (err) {
      console.error("Error fetching leave data:", err);
      throw err;
    }
  }

  /**
   * Main Case Solver Flow with Conversation Context:
   * - Step 1: Get User Email
   * - Step 2: Fetch Leave Data from Kissflow Dataset
   * - Step 3: Format Response
   */
  async function handleQuestion(question, chatHistory) {
    try {
      // Get current user info
      const userInfo = await getKissflowUserInfo();
      if (!userInfo.email) {
        return {
          text: "ไม่สามารถดึงข้อมูล Email ของคุณได้ กรุณาตรวจสอบการเข้าสู่ระบบ Kissflow",
          sender: "ai",
          role: "assistant",
          knowledgeBase: [],
          kissflowData: null,
        };
      }

      // Fetch leave data
      const leaveDataList = await fetchUserLeaveData(userInfo.email);

      // Find the record that matches the email exactly (double check)
      const userRecord =
        leaveDataList.find(
          (item) => item[LEAVE_FIELDS.Email] === userInfo.email
        ) || leaveDataList[0]; // Fallback to first item if search was exact

      if (!userRecord) {
        return {
          text: `ไม่พบข้อมูลวันลาสำหรับ Email: ${userInfo.email}`,
          sender: "ai",
          role: "assistant",
          knowledgeBase: [],
          kissflowData: null,
        };
      }

      // Extract balances
      const vacation = userRecord[LEAVE_FIELDS.Vacation] || 0;
      const personal = userRecord[LEAVE_FIELDS.Personal] || 0;
      const sick = userRecord[LEAVE_FIELDS.Sick] || 0;

      // Build context for AI
      const context = `ข้อมูลวันลาคงเหลือของพนักงาน:
- ลาพักร้อน: ${vacation} วัน
- ลากิจ: ${personal} วัน
- ลาป่วย: ${sick} วัน`;

      // Generate answer using AI
      const answer = await generateAnswerFromOpenAI(
        context,
        question,
        chatHistory
      );

      return {
        text: answer,
        sender: "ai",
        role: "assistant",
        knowledgeBase: [],
        showCreateButton: true, // Always show button for AI responses
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return {
        text: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${msg}`,
        sender: "ai",
        role: "assistant",
        knowledgeBase: [],
        showCreateButton: false,
      };
    }
  }
  // ===== Kissflow opener =====
  async function openInKissflow(instanceData) {
    // instanceData: Object with _id and _activity_instance_id from creation response
    // Maps to Kissflow popup parameters: leavereqpopupinsid and leavereqpopupatvid

    let popupParameters = {};

    if (typeof instanceData === "object" && instanceData !== null) {
      // Map response fields to Kissflow popup parameter names
      if (instanceData._id) {
        popupParameters.leavereqpopupinsid = instanceData._id;
      }
      if (instanceData._activity_instance_id) {
        popupParameters.leavereqpopupatvid = instanceData._activity_instance_id;
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
  async function createNewItemInKissflow() {
    try {
      setIsTyping(true);

      // Verify Kissflow SDK is available
      const kf = await getKf();
      if (!kf) {
        setIsTyping(false);
        alert(
          "Kissflow SDK not available. This feature must be accessed from within Kissflow."
        );
        return null;
      }

      // Create item using native Kissflow SDK API
      const result = await sendKissflowCreateRequest(
        getKf,
        getKissflowUserInfo
      );

      // Store created item data for future use
      setCreatedItemData(result);

      // Unlock chat immediately
      setIsTyping(false);

      // Open Kissflow popup directly (no browser alert on success)
      if (result._id || result._activity_instance_id) {
        // Use setTimeout to ensure UI updates before opening popup
        setTimeout(() => {
          openInKissflow(result).catch(() => {});
        }, 100);
      }

      return result;
    } catch (err) {
      // Show error alert only on failure
      setIsTyping(false);
      alert(`❌ ไม่สามารถสร้าง New Item ได้:\n${err.message}`);
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

                {msg.sender === "ai" && msg.showCreateButton && (
                  <div className="refs-inline">
                    <div className="refs-inline-header">
                      <strong>ต้องการสร้าง Request ใน Kissflow หรือไม่?</strong>
                      <button
                        type="button"
                        className="refs-create-new"
                        onClick={() =>
                          createNewItemInKissflow({
                            Case_Title: "New Case from AI Chat",
                            Case_Type: "Customer Service",
                            Case_Description: "Created via AI Chat",
                            AI_Suggestions: "",
                            Solution_Description: "",
                          })
                        }
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
