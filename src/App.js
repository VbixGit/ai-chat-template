import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";
import KFSDK from "@kissflow/lowcode-client-sdk";

const WEAVIATE_ENDPOINT = process.env.REACT_APP_WEAVIATE_ENDPOINT;
const WEAVIATE_API_KEY = process.env.REACT_APP_WEAVIATE_API_KEY;
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

// ===== Kissflow integration config =====
const KF_POPUP_ID = "Popup_kMvLNHW_ys"; // Popup ID/slug

// ===== Helpers =====
const trim = (s = "", n = 2000) =>
  s && s.length > n ? s.slice(0, n) + " …" : s;
const safeJson = (x) => {
  try {
    return JSON.stringify(x);
  } catch {
    return "[]";
  }
};

// ===== Deduper: คงไว้ทีละ instanceID เดียว (เลือกตัวที่ score สูงสุด) =====
function dedupeByInstanceID(items = []) {
  const map = new Map();
  for (const it of items) {
    const key = it.instanceID?.trim();
    if (!key) continue; // ข้ามรายการที่ไม่มี instanceID
    const prev = map.get(key);
    if (!prev || (it.score ?? 0) > (prev.score ?? 0)) {
      map.set(key, it);
    }
  }
  return Array.from(map.values());
}

// ====== Retrieval config ======
const COLLECTION = "TORForPOC";
const SEARCH_PROPERTIES = [
  "documentTopic^3",
  "documentDescription^2",
  "documentDetail",
];
const RETURN_FIELDS = `
  instanceID
  documentTopic
  documentDescription
  documentDetail
  documentPage
  documentPageStart
  documentPageEnd
  totalPages
  source
  gdriveFileId
  createdAt
  _additional { score id }
`;

// ===== Answer Prompt =====
const ANSWER_SYSTEM_PROMPT = `
You are a helpful assistant with deep expertise in Thai government procurement and TOR (Terms of Reference) documents.
Your job is to answer the user's question in a natural, conversational way as if you are a knowledgeable human expert.

You will receive:
- The user's question (Thai or English).
- Excerpts from TOR documents (Thai, possibly containing OCR errors).

Tasks:
1) Understand the user's true intent.
2) Clean/normalize the context: fix Thai OCR issues (diacritics, broken words, misread digits), standardize dates and numbers, remove duplicates.
3) Extract only the relevant facts and synthesize a clear, reliable answer.
4) Respond in Thai by default (unless the user explicitly asks for English). Sound like a human expert, not an AI summarizer.
5) If information is missing, uncertain, or contradictory, state that clearly rather than guessing.
6) When helpful, refer concisely to the TOR sections.

Tone: professional yet approachable, concise, trustworthy, and natural.
`.trim();

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const kfRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user", role: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const aiResponse = await handleQuestion(input, [...messages]);
    setMessages((prev) => [...prev, aiResponse]);
    setIsTyping(false);
  };

  /**
   * Flow (BM25 only):
   * 1) BM25 GraphQL search
   * 2) LLM สรุปคำตอบ
   * 3) แนบ refs แบบ dedupe ภายในบับเบิล AI
   */
  async function handleQuestion(question, chatHistory) {
    try {
      // 1) BM25
      const docs = await searchWeaviateBM25({
        query: question,
        limit: 18,
        autocut: 3,
      });
      if (!docs.length) {
        return {
          text: "ไม่พบข้อมูลที่เกี่ยวข้อง ลองเพิ่มคำหลัก (เช่น “จัดซื้อ”, “จัดจ้าง”, “procurement”, “workflow อนุมัติ”).",
          sender: "ai",
          role: "assistant",
          refs: [], // ไม่มี refs
        };
      }

      // จัด compact
      const compact = docs.slice(0, 10).map((d, i) => ({
        docNo: i + 1,
        id: d._additional?.id || "",
        instanceID: d.instanceID || "",
        score: d._additional?.score ?? null,
        topic: d.documentTopic || "",
        description: d.documentDescription || "",
        page: d.documentPage,
        pageStart: d.documentPageStart,
        pageEnd: d.documentPageEnd,
        source: d.source || "",
        gdriveFileId: d.gdriveFileId || "",
        text: trim(d.documentDetail, 3500),
      }));

      // 2) ตอบ
      const answer = await generateFinalAnswer(question, compact, chatHistory);

      // 3) refs (dedupe by instanceID)
      const uniqueRefs = dedupeByInstanceID(compact);

      return {
        text: answer,
        sender: "ai",
        role: "assistant",
        refs: uniqueRefs, // แนบไปกับข้อความ AI เพื่อเรนเดอร์ปุ่มภายในบับเบิล
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error.";
      return {
        text: `เกิดข้อผิดพลาดระหว่างค้นข้อมูล: ${msg}`,
        sender: "ai",
        role: "assistant",
        refs: [],
      };
    }
  }

  // ===== Weaviate BM25 Search =====
  async function searchWeaviateBM25({ query, limit = 18, autocut = 3 }) {
    const gql = `
      query {
        Get {
          ${COLLECTION}(
            bm25: { query: ${safeJson(query)}, properties: ${safeJson(
      SEARCH_PROPERTIES
    )} }
            limit: ${limit}
            autocut: ${autocut}
          ) { ${RETURN_FIELDS} }
        }
      }
    `;
    const res = await fetch(`${WEAVIATE_ENDPOINT}/v1/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WEAVIATE_API_KEY}`,
      },
      body: JSON.stringify({ query: gql }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Weaviate error: ${res.status} ${res.statusText} - ${body}`
      );
    }
    const json = await res.json();
    if (json.errors)
      throw new Error(
        `Weaviate GraphQL errors: ${JSON.stringify(json.errors)}`
      );
    return json?.data?.Get?.[COLLECTION] || [];
  }

  // ===== Final Answer =====
  async function generateFinalAnswer(question, compactExcerpts, chatHistory) {
    const history = (chatHistory || []).map((m) => ({
      role: m.role,
      content: m.text,
    }));
    const userContent = `
User Question:
${question}

TOR Excerpts (compact, for answering):
${JSON.stringify(compactExcerpts, null, 2)}
`.trim();

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          { role: "system", content: ANSWER_SYSTEM_PROMPT },
          ...history,
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `OpenAI answer failed: ${res.status} ${res.statusText} - ${body}`
      );
    }
    const data = await res.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("Invalid OpenAI answer");
    return answer;
  }

  // ===== Kissflow opener (รับรายการ instanceID เป็นอาร์เรย์) =====
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
      const INSTANCE_REPORT = "instanceidreport"; // Page variable ที่รับค่าคอมม่า instanceIDs
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
      <div className="chat-header">AI Assistant</div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-bubble ${msg.sender}-message`}>
              <div className="message-text">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>

              {/* Inline References: แสดงเฉพาะในบับเบิลของ AI */}
              {msg.sender === "ai" &&
                Array.isArray(msg.refs) &&
                msg.refs.length > 0 && (
                  <div className="refs-inline">
                    <div className="refs-inline-header">
                      <strong>References</strong>
                      <button
                        type="button"
                        className="refs-open-all"
                        onClick={() =>
                          openInKissflow(msg.refs.map((r) => r.instanceID))
                        }
                        title="Open all in Kissflow"
                      >
                        Open all ({msg.refs.length})
                      </button>
                    </div>

                    <ul className="refs-inline-list">
                      {msg.refs.map((r) => {
                        const pages = r.pageStart
                          ? `${r.pageStart}${r.pageEnd ? "-" + r.pageEnd : ""}`
                          : r.page || "?";
                        return (
                          <li
                            key={`${r.instanceID}-${r.id}`}
                            className="refs-inline-item"
                          >
                            <div className="refs-inline-meta">
                              <div className="refs-inline-title">
                                Doc{r.docNo} • {r.topic || "Untitled"}
                              </div>
                              <div className="refs-inline-sub">
                                instanceID: {r.instanceID} • pages: {pages} •
                                score: {r.score?.toFixed?.(3) ?? "-"}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="refs-open-one"
                              onClick={() => openInKissflow([r.instanceID])}
                              title="Open this in Kissflow"
                            >
                              Open
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
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
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คำถามเกี่ยวกับ TOR ที่นี่…"
            disabled={isTyping}
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
      </div>
    </div>
  );
}

export default App;
