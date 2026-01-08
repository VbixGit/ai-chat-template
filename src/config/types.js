/**
 * TYPES MODULE - Type definitions as JSDoc comments
 * Central types for type safety across the application
 *
 * DECISION: CREATE - Required for configuration validation
 * Uses JSDoc instead of TypeScript for JavaScript compatibility
 */

// Type definitions (for IDE support via JSDoc)
/**
 * @typedef {'HR' | 'TOR' | 'CRM' | 'LEAVE'} FlowKey
 */

/**
 * @typedef {'HR' | 'TOR' | 'CRM' | 'Leave Request'} FlowCategory
 */

/**
 * @typedef {'CREATE' | 'READ' | 'QUERY' | 'UPDATE' | 'ANSWER_ONLY'} ActionType
 */

/**
 * @typedef {Object} FlowConfig
 * @property {FlowKey} key
 * @property {FlowCategory} category
 * @property {string} name
 * @property {string} description
 * @property {string[]} dataSourcesAllowed
 * @property {string[]} weaviateClasses
 * @property {string[]} kissflowProcessIds
 * @property {ActionType[]} actionsAllowed
 * @property {boolean} requiresSystemPrompt
 * @property {string} responseLanguage
 */

// ===== CHAT MESSAGE TYPES =====
/**
 * @typedef {'user' | 'assistant' | 'tool' | 'system'} MessageRole
 */

/**
 * @typedef {'retrieve' | 'analyze' | 'action' | 'respond'} MessageStep
 */

/**
 * @typedef {Object} MessageMetadata
 * @property {FlowKey} flowKey
 * @property {FlowCategory} category
 * @property {string} systemPromptId
 * @property {MessageStep} step
 * @property {number} timestamp
 * @property {string} [detectedLanguage] - Language of user input (detected)
 * @property {ActionType} [actionType] - For tool/action messages
 */
  actionStatus?: "pending" | "success" | "failed";
}

/**
 * @typedef {Object} ChatMessage
 * @property {MessageRole} role
 * @property {string} content
 * @property {MessageMetadata} meta
 * @property {Citation[]} [citations] - Optional: citations or references from Weaviate
 */

/**
 * @typedef {Object} Citation
 * @property {number} index
 * @property {string} title
 * @property {string} source - e.g., "Weaviate", "Kissflow"
 * @property {number} [relevanceScore]
 */

// ===== USER INFO =====
/**
 * @typedef {Object} UserInfo
 * @property {string} userId
 * @property {string} accountId
 * @property {string} name
 * @property {string} email
 * @property {number} loadedAt
 */

// ===== TASK STATE (PAUSE/RESUME) =====
/**
 * @typedef {'IDLE' | 'RUNNING' | 'PAUSED' | 'WAITING_INPUT' | 'FAILED' | 'COMPLETED'} TaskStatus
 */

/**
 * @typedef {'analysis' | 'workflow' | 'action'} TaskType
 */

/**
 * @typedef {Object} TaskState
 * @property {string} taskId
 * @property {TaskStatus} status
 * @property {TaskType} type
 * @property {FlowKey} flowKey
 * @property {MessageStep} currentStep
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {Object} savedContext - Context to resume from (serialized message chain + state)
 * @property {number} savedContext.messageCount
 * @property {string} [savedContext.lastMessageId]
 * @property {Record<string, any>} [savedContext.customData]
 * @property {string} [error] - Error details if failed
 */

// ===== RAG / WEAVIATE TYPES =====
/**
 * @typedef {Object} WeaviateDocument
 * @property {string} id
 * @property {string} className
 * @property {string} [title]
 * @property {string} content
 * @property {number} relevanceScore
 * @property {Record<string, any>} [metadata]
 */

/**
 * @typedef {Object} RetrievalQuery
 * @property {string} query
 * @property {FlowKey} flowKey
 * @property {number} topK
 * @property {number} [scoreThreshold]
 * @property {('WEAVIATE' | 'KISSFLOW' | 'EXTERNAL_DB')[]} [sources] - For multi-source retrieval
 */

/**
 * @typedef {Object} RetrievalResult
 * @property {WeaviateDocument[]} documents
 * @property {string} query
 * @property {number} retrievedAt
 * @property {string} sourceUsed
 */

// ===== KISSFLOW TYPES =====
/**
 * @typedef {Object} KissflowWorkflowAction
 * @property {ActionType} type
 * @property {string} processId
 * @property {string} [formId]
 * @property {Record<string, any>} fields
 * @property {boolean} validateBeforeExecute - Validate this action against flow config before execution
 */

/**
 * @typedef {Object} KissflowCreateRequest
 * @property {Record<string, any>} data
 * @property {string} processId
 */

/**
 * @typedef {Object} KissflowCreateResponse
 * @property {string} _id
 * @property {string} _activity_instance_id
 */

/**
 * @typedef {Object} KissflowReadQuery
 * @property {string} datasetId
 * @property {string} viewId
 * @property {Record<string, any>} [filters]
 * @property {number} [limit]
 */

// ===== EXTERNAL DB ALLOW-LIST TYPES =====
/**
 * @typedef {Object} ExternalDbConnection
 * @property {string} key
 * @property {string} baseUrl
 * @property {'none' | 'bearer' | 'apikey'} authType
 * @property {string} [authValue]
 * @property {string[]} allowedPaths - e.g., ['/api/v1/*', '/search/*']
 */

/**
 * @typedef {Object} ExternalDbAllowlist
 * @property {Record<string, ExternalDbConnection>} connections
 */

/**
 * @typedef {Object} ExternalDbRequest
 * @property {string} connectionKey
 * @property {string} path
 * @property {'GET' | 'POST' | 'PUT' | 'DELETE'} method
 * @property {Record<string, any>} [body]
 */

// ===== LANGUAGE DETECTION TYPES =====
/**
 * @typedef {Object} LanguageDetectionResult
 * @property {string} mainLanguage - ISO 639-1 code, e.g., 'en', 'th', 'fr'
 * @property {number} confidence - 0-1
 * @property {Array<{code: string, confidence: number}>} allLanguages
 */

// ===== AI/LLM TYPES =====
/**
 * @typedef {Object} ChatCompletionRequest
 * @property {string} systemPrompt
 * @property {string} userMessage
 * @property {ChatMessage[]} [chatHistory]
 * @property {string} [context]
 * @property {number} [temperature]
 * @property {number} [topK]
 */

/**
 * @typedef {Object} ChatCompletionResponse
 * @property {string} content
 * @property {string} model
 * @property {Object} usage
 * @property {number} usage.promptTokens
 * @property {number} usage.completionTokens
 * @property {number} usage.totalTokens
 */

/**
 * @typedef {Object} EmbeddingRequest
 * @property {string} text
 */

/**
 * @typedef {Object} EmbeddingResponse
 * @property {number[]} embedding
 * @property {string} model
 */
