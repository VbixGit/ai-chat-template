/**
 * DECISION: Configuration-driven flow registry
 * Single source of truth for which flows exist and their capabilities
 * All flow-specific logic reads from this config
 */

export const FLOWS = {
  HR: {
    key: "HR",
    category: "HR",
    name: "Human Resources",
    description: "Organization and HR policy questions",
    dataSourcesAllowed: ["WEAVIATE"],
    weaviateClasses: ["HRMixlangRAG"],
    weaviateFields: `
      instanceID
      documentDetail
      requesterName
      documentDescription
      requesterEmail
      documentTopic
      _additional {
        certainty
      }
    `,
    kissflowProcessIds: [],
    actionsAllowed: ["ANSWER_ONLY"],
    requiresSystemPrompt: true,
    responseLanguage: "user-detected",
    suggestedQuestions: [
      "What is our company vacation policy?",
      "How many sick days do employees get?",
    ],
  },
  TOR: {
    key: "TOR",
    category: "TOR",
    name: "Terms of Reference",
    description: "Terms of Reference and document search",
    dataSourcesAllowed: ["WEAVIATE"],
    weaviateClasses: ["TORForPOC"],
    weaviateFields: `
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
    `,
    translateQueryToThai: true,
    kissflowProcessIds: [],
    actionsAllowed: ["ANSWER_ONLY"],
    requiresSystemPrompt: true,
    responseLanguage: "user-detected",
    suggestedQuestions: [
      "What are the project deliverables?",
      "What is the project timeline?",
    ],
  },
  CRM: {
    key: "CRM",
    category: "CRM",
    name: "Case Management",
    description: "Case management system with knowledge base",
    dataSourcesAllowed: ["WEAVIATE", "KISSFLOW"],
    weaviateClasses: ["CRM_Cases"],
    kissflowProcessIds: ["CRM_PROCESS"],
    actionsAllowed: ["ANSWER_ONLY", "CREATE", "READ", "QUERY", "UPDATE"],
    requiresSystemPrompt: true,
    responseLanguage: "user-detected",
    suggestedQuestions: [
      "Create a new case for me",
      "What cases are assigned to me?",
    ],
  },
  LEAVE: {
    key: "LEAVE",
    category: "Leave Request",
    name: "Leave Request",
    description: "Leave request handling and policy Q&A",
    dataSourcesAllowed: ["WEAVIATE", "KISSFLOW"],
    weaviateClasses: ["LeavePolicy"],
    kissflowProcessIds: ["LEAVE_PROCESS"],
    actionsAllowed: ["ANSWER_ONLY", "CREATE", "READ", "QUERY"],
    requiresSystemPrompt: true,
    responseLanguage: "user-detected",
    suggestedQuestions: [
      "How much leave do I have left?",
      "How do I request leave?",
      "What is the leave policy?",
    ],
  },
};

export function getFlowConfig(flowKey) {
  const flow = FLOWS[flowKey];
  if (!flow) {
    throw new Error(`Unknown flow: ${flowKey}`);
  }
  return flow;
}

export function isActionAllowedForFlow(flowKey, action) {
  try {
    const flow = getFlowConfig(flowKey);
    return flow.actionsAllowed.includes(action);
  } catch {
    return false;
  }
}

export function getWeaviateClassesForFlow(flowKey) {
  const flow = getFlowConfig(flowKey);
  return flow.weaviateClasses;
}

export function getWeaviateFieldsForFlow(flowKey) {
  const flow = getFlowConfig(flowKey);
  return (
    flow.weaviateFields ||
    `
    _additional {
      distance
    }
    content
    title
    metadata
  `
  );
}

export function getTranslateQueryToThaiForFlow(flowKey) {
  const flow = getFlowConfig(flowKey);
  return flow.translateQueryToThai || false;
}

export function getKissflowProcessIdsForFlow(flowKey) {
  const flow = getFlowConfig(flowKey);
  return flow.kissflowProcessIds.filter((id) => id);
}

export function listAvailableFlows() {
  return Object.values(FLOWS);
}

export function getSuggestedQuestionsForFlow(flowKey) {
  const flow = getFlowConfig(flowKey);
  return flow.suggestedQuestions || [];
}
