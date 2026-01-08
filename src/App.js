/**
 * KISSFLOW AI CHAT COMPONENT - REBUILT
 *
 * DECISION: MAJOR REFACTOR
 * Removed: Hardcoded system prompts, credentials, field mappings, Thai-only support
 * Added: Multi-flow support (HR, TOR, CRM, Leave), config-driven, language detection
 *
 * Architecture:
 * - useEffect: Initialize user info once
 * - useState: messages (with metadata), userInfo, selectedFlow, taskState, systemPrompt
 * - Service modules: openai, weaviate, kissflow, languageDetection
 * - Config layer: flows, env, types
 */

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

// ===== CONFIG & TYPES =====
import { validateAllConfig } from "./config/env";
import { FLOWS, listAvailableFlows } from "./config/flows";

// ===== SERVICES =====
import {
  getUserInfoFromKissflow,
  validateKissflowAvailability,
  getFlowFromPageVariables,
  getSystemPromptFromPageVariables,
  getProcessNameFromPageVariables,
  isOpenedInKissflow,
} from "./lib/services/kissflow";
import { generateChatCompletion } from "./lib/services/openai";
import { queryWeaviate } from "./lib/services/weaviate";
import {
  detectLanguage,
  getLanguageName,
} from "./lib/services/languageDetection";
import {
  createUserMessage,
  createAssistantMessage,
  getRecentMessages,
  logMessage,
  filterMessagesByFlow,
} from "./lib/utils/messageMetadata";
import {
  createTaskState,
  updateTaskStatus,
  pauseTask,
  resumeTask,
  formatTaskStatus,
  getTaskDescription,
} from "./lib/utils/taskState";

// ===== MAIN APP COMPONENT =====
// DECISION: COMPLETE REBUILD - Multi-flow, config-driven, language-aware

function App() {
  // ===== STATE =====
  // DECISION: KEEP from original, ADD metadata and task state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const messagesEndRef = useRef(null);

  // DECISION: ADD - User info (loaded once at init)
  const [userInfo, setUserInfo] = useState(null);
  const [userInfoError, setUserInfoError] = useState(null);

  // DECISION: ADD - Track if opened in Kissflow or regular browser
  const [isKissflowContext, setIsKissflowContext] = useState(false);

  // DECISION: ADD - Flow selection
  const [selectedFlow, setSelectedFlow] = useState("LEAVE");
  const [availableFlows, setAvailableFlows] = useState([]);

  // DECISION: ADD - Process name (from Kissflow page parameters)
  const [processName, setProcessName] = useState("");

  // DECISION: ADD - System prompt (loaded from Kissflow Page variables)
  const [systemPrompt, setSystemPrompt] = useState("");
  const [systemPromptId, setSystemPromptId] = useState("");

  // DECISION: ADD - Language detection
  const [detectedLanguage, setDetectedLanguage] = useState("en");

  // DECISION: ADD - Task state for pause/resume
  const [taskState, setTaskState] = useState(null);

  // DECISION: ADD - Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ===== INITIALIZATION =====
  // DECISION: KEEP useEffect pattern, REFACTOR:
  // Check if opened in Kissflow or regular browser, load data accordingly
  useEffect(() => {
    const initializeApp = async () => {
      console.log("🚀 Initializing app...");

      try {
        // Validate configuration
        validateAllConfig();

        // Check if opened in Kissflow or regular browser
        const inKissflow = await isOpenedInKissflow();
        setIsKissflowContext(inKissflow);

        if (inKissflow) {
          // ===== KISSFLOW CONTEXT =====
          console.log("📍 Running in Kissflow context");

          // Check Kissflow availability
          const kfCheck = await validateKissflowAvailability();
          if (!kfCheck.available) {
            throw new Error(kfCheck.error || "Kissflow SDK not available");
          }

          // Load user info (Kissflow only)
          const user = await getUserInfoFromKissflow();
          setUserInfo(user);
          console.log("✅ User info loaded:", user);

          // Load available flows
          const flows = listAvailableFlows();
          setAvailableFlows(flows);
          console.log("✅ Available flows loaded:", flows.length);

          // Get flow from page variables (primary source)
          const flowFromPageVars = await getFlowFromPageVariables();
          setSelectedFlow(flowFromPageVars);
          setSystemPromptId(flowFromPageVars);
          console.log("📋 Flow from page variables:", flowFromPageVars);

          // Get process name from page variables
          const processNameFromPageVars =
            await getProcessNameFromPageVariables();
          if (processNameFromPageVars) {
            setProcessName(processNameFromPageVars);
            console.log(
              "🏷️ Process name from page variables:",
              processNameFromPageVars
            );
          }

          // Get system prompt from page variables (if available)
          const promptFromPageVars = await getSystemPromptFromPageVariables();
          if (promptFromPageVars) {
            setSystemPrompt(promptFromPageVars);
            console.log("📝 System prompt from page variables loaded");
          } else {
            // Use default system prompt for Kissflow
            setSystemPrompt(
              "You are a helpful AI assistant for Kissflow case management and leave requests. Provide clear, concise answers."
            );
          }

          setUserInfoError(null);
        } else {
          // ===== REGULAR BROWSER CONTEXT (Testing/Demo) =====
          console.log("🌐 Running in regular browser context (Demo mode)");

          // Set demo user info
          const demoUser = {
            userId: "demo-user-123",
            accountId: "demo-account",
            name: "Demo User",
            email: "demo@example.com",
            loadedAt: Date.now(),
          };
          setUserInfo(demoUser);
          console.log("✅ Demo user loaded (Browser mode)");

          // Set default flow
          setSelectedFlow("LEAVE");
          setSystemPromptId("LEAVE");

          // Set default process name
          setProcessName("Demo Process");

          // Set default system prompt for testing
          setSystemPrompt(
            "You are a helpful AI assistant. You can answer questions about human resources, leave policies, case management, and general topics. Provide clear, helpful, and concise responses."
          );

          setUserInfoError(null);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("❌ Initialization failed:", errorMsg);
        setUserInfoError(errorMsg);
      }
    };

    initializeApp();
  }, []);

  // ===== AUTO-SCROLL =====
  // DECISION: KEEP from original
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ===== DARK MODE =====
  // DECISION: KEEP from original
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [isDarkMode]);
  // ===== SEND MESSAGE =====
  // DECISION: REFACTOR - Add language detection, flow support, metadata
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    if (!userInfo) {
      setError("User not initialized");
      return;
    }
    if (!selectedFlow) {
      setError("Flow not selected");
      return;
    }

    setError(null);
    setIsLoading(true);
    let assistantMsgId = null;

    try {
      // Step 1: Validate input
      const userInput = input.trim();
      if (userInput.length === 0 || userInput.length > 5000) {
        throw new Error("Input must be between 1 and 5000 characters");
      }

      // Step 1.5: Refresh page parameters from Kissflow (flow, system_prompt, process_name)
      console.log("📝 Refreshing page parameters from Kissflow...");
      let effectiveFlow = selectedFlow;
      let effectiveSystemPrompt = systemPrompt;
      let effectiveProcessName = processName;

      try {
        // Get fresh flow
        const flowFromPageVars = await getFlowFromPageVariables();
        if (flowFromPageVars && flowFromPageVars !== selectedFlow) {
          console.log("✅ Updated flow from page variables:", flowFromPageVars);
          effectiveFlow = flowFromPageVars;
          setSelectedFlow(flowFromPageVars);
          setSystemPromptId(flowFromPageVars);
        }

        // Get fresh system prompt
        const promptFromPageVars = await getSystemPromptFromPageVariables();
        if (promptFromPageVars && promptFromPageVars !== systemPrompt) {
          console.log("✅ Updated system_prompt from page variables");
          effectiveSystemPrompt = promptFromPageVars;
          setSystemPrompt(promptFromPageVars);
        }

        // Get fresh process name
        const nameFromPageVars = await getProcessNameFromPageVariables();
        if (nameFromPageVars && nameFromPageVars !== processName) {
          console.log(
            "✅ Updated process_name from page variables:",
            nameFromPageVars
          );
          effectiveProcessName = nameFromPageVars;
          setProcessName(nameFromPageVars);
        }

        console.log("📋 Fresh parameters:", {
          flow: effectiveFlow,
          systemPrompt: effectiveSystemPrompt ? "loaded" : "null",
          processName: effectiveProcessName ? "loaded" : "null",
        });
      } catch (paramErr) {
        console.warn("⚠️ Could not refresh page parameters:", paramErr.message);
      }

      // Step 2: Detect language
      const langResult = detectLanguage(userInput);
      const userLanguage = langResult.mainLanguage;
      setDetectedLanguage(userLanguage);

      // Step 3: Create user message with metadata
      const userMsg = createUserMessage(
        userInput,
        selectedFlow,
        FLOWS[selectedFlow].category,
        systemPromptId,
        userLanguage
      );

      logMessage(userMsg);
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      // Step 4: Create placeholder assistant message
      const assistantMsg = createAssistantMessage(
        `Processing your message...`,
        selectedFlow,
        FLOWS[selectedFlow].category,
        systemPromptId
      );
      assistantMsgId = assistantMsg.id;

      logMessage(assistantMsg);
      setMessages((prev) => [...prev, assistantMsg]);

      // Step 5: Query Weaviate for context
      console.log("🔍 Querying Weaviate for context...");
      console.log("📋 Using flow for Weaviate query:", selectedFlow);
      const flowConfig = FLOWS[selectedFlow];

      let context = "";
      let citations = [];
      if (
        flowConfig &&
        flowConfig.weaviateClasses &&
        flowConfig.weaviateClasses.length > 0
      ) {
        try {
          const weaviateResult = await queryWeaviate({
            flowKey: selectedFlow,
            query: userInput,
            limit: 5,
          });
          if (
            weaviateResult &&
            weaviateResult.documents &&
            weaviateResult.documents.length > 0
          ) {
            console.log(
              `✅ Retrieved ${weaviateResult.documents.length} documents from Weaviate`
            );
            context = weaviateResult.formattedContext || "";
            citations = weaviateResult.citations || [];
          } else {
            console.log("ℹ️ No Weaviate results found");
          }
        } catch (weaviateErr) {
          console.warn("⚠️ Weaviate query failed:", weaviateErr.message);
          // Continue without Weaviate context
        }
      }

      // Step 6: Get recent messages for context
      const recentMsgs = getRecentMessages(messages, 10);

      // Step 7: Format chat history for OpenAI
      const chatHistory = recentMsgs.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      // Step 8: Call OpenAI with system prompt and context
      console.log("🤖 Calling OpenAI...");
      const finalSystemPrompt =
        systemPrompt ||
        "You are a helpful AI assistant. Provide clear, concise, and helpful responses.";

      console.log("💬 Using system prompt:", finalSystemPrompt);
      console.log("📊 Using flow:", selectedFlow);

      const response = await generateChatCompletion({
        systemPrompt: finalSystemPrompt,
        userMessage: userInput,
        chatHistory: chatHistory,
        context: context,
      });

      if (!response || !response.content) {
        throw new Error("Empty response from OpenAI");
      }

      console.log("✅ OpenAI response received");

      // Step 9: Format response with citations if available
      let responseContent = response.content;
      if (citations && citations.length > 0) {
        responseContent += "\n\n**References:**\n";
        citations.forEach((cite) => {
          responseContent += `[${cite.index}] ${
            cite.title
          } (Score: ${cite.relevanceScore?.toFixed(3)})\n`;
        });
      }

      // Step 10: Update assistant message with actual response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: responseContent,
                metadata: {
                  ...msg.metadata,
                  tokens: response.tokensUsed?.total || 0,
                  model: response.model || "gpt-3.5-turbo",
                  citations: citations,
                },
              }
            : msg
        )
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("❌ Error sending message:", errorMsg);
      setError(errorMsg);

      // Update assistant message with error
      if (assistantMsgId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `❌ Error: ${errorMsg}`,
                }
              : msg
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ===== PAUSE/RESUME TASK =====
  // DECISION: ADD - Task state management
  const handlePauseTask = () => {
    if (taskState && taskState.status === "RUNNING") {
      const paused = pauseTask(taskState, messages.length);
      setTaskState(paused);
      console.log("⏸ Task paused:", paused);
    }
  };

  const handleResumeTask = () => {
    if (taskState && taskState.status === "PAUSED") {
      const resumed = resumeTask(taskState);
      setTaskState(resumed);
      console.log("▶️ Task resumed:", resumed);
    }
  };

  // ===== RENDER =====
  // DECISION: REBUILD UI with flow selector, system prompt info, task state display
  return (
    <div className="App">
      {/* HEADER */}
      <div className="chat-header">
        <div className="header-title">
          {processName ? `${processName} - AI Chat` : "Kissflow AI Chat"}
        </div>
        <button
          className="theme-toggle-btn"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle theme"
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

      {/* INITIALIZATION STATE */}
      {!userInfo && !userInfoError && (
        <div className="initialization-banner">
          ⏳ Initializing application...
        </div>
      )}

      {/* ERRORS */}
      {userInfoError && <div className="error-banner">⚠️ {userInfoError}</div>}

      {userInfo && (
        <div className="user-info">
          <span>
            👤 {userInfo.name} ({userInfo.email}){" "}
            {isKissflowContext ? "🔗 Kissflow" : "🌐 Demo"}
          </span>
        </div>
      )}

      {/* TASK STATE DISPLAY */}
      {taskState && (
        <div className="task-state">
          <span>{formatTaskStatus(taskState)}</span>
          <span>{getTaskDescription(taskState)}</span>
          {taskState.status === "RUNNING" && (
            <button onClick={handlePauseTask} disabled={isLoading}>
              Pause
            </button>
          )}
          {taskState.status === "PAUSED" && (
            <button onClick={handleResumeTask} disabled={isLoading}>
              Resume
            </button>
          )}
        </div>
      )}

      {/* CHAT CONTAINER */}
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.role}-row`}>
              <div className="message-avatar">
                <div className={`avatar ${msg.role}-avatar`}>
                  {msg.role === "user" ? "U" : "AI"}
                </div>
              </div>
              <div className={`message-bubble ${msg.role}-message`}>
                <div className="message-text">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="citations">
                    <strong>Sources:</strong>
                    <ul className="refs-inline-list">
                      {msg.citations.map((cite, idx) => (
                        <li key={idx} className="refs-inline-item">
                          <span className="refs-inline-title">
                            #{cite.index}: {cite.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ERROR DISPLAY */}
        {error && <div className="error-banner">❌ {error}</div>}

        {/* INPUT FORM */}
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
            placeholder="Ask your question here... (Shift+Enter for new line)"
            disabled={isLoading || !userInfo}
            rows={3}
            className="chat-input-textarea"
          />
          <button
            type="submit"
            disabled={isLoading || !userInfo}
            aria-label="Send"
          >
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

        {/* SUGGESTED QUESTIONS (flow-specific - TODO) */}
        <div className="suggested-questions-wrapper">
          <p className="suggested-questions-label">Suggested Questions</p>
          <div className="suggested-questions-grid">
            {/* TODO: Load suggestions from flow config */}
            <button type="button" className="suggested-question-btn" disabled>
              [Questions loading...]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("🔴 React Error Caught:", error);
    console.error("Error Info:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            fontFamily: "sans-serif",
            backgroundColor: "#fee",
            color: "#c33",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <h1>⚠️ Application Error</h1>
          <p>{this.state.error?.message || "An unexpected error occurred"}</p>
          <pre
            style={{
              backgroundColor: "#f0f0f0",
              padding: "1rem",
              borderRadius: "0.5rem",
              textAlign: "left",
              maxWidth: "600px",
              overflow: "auto",
            }}
          >
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
export default App;
