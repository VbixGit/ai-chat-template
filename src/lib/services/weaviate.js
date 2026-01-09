/**
 * WEAVIATE SERVICE MODULE
 * RAG retrieval from Weaviate knowledge base
 *
 * DECISION: REFACTOR from server.js searchWeaviate()
 * Made flow-aware and generalized for all flows
 */

import { WEAVIATE_CONFIG } from "../../config/env";
import {
  getWeaviateClassesForFlow,
  getWeaviateFieldsForFlow,
} from "../../config/flows";
import { generateEmbedding } from "./openai";

export async function queryWeaviate(retrieval) {
  const {
    flowKey,
    query,
    limit = WEAVIATE_CONFIG.topK,
    scoreThreshold = WEAVIATE_CONFIG.scoreThreshold,
  } = retrieval;

  if (!WEAVIATE_CONFIG.url) {
    throw new Error("Weaviate URL not configured");
  }

  try {
    console.log(`🔍 Querying Weaviate for ${flowKey} flow...`);

    // Get embedding for query
    const embeddingResult = await generateEmbedding({ text: query });
    const embedding = embeddingResult.embedding;

    // Get Weaviate class for this flow
    const classes = getWeaviateClassesForFlow(flowKey);
    const className = classes[0]; // Use first class

    if (!className) {
      throw new Error(`No Weaviate class configured for ${flowKey} flow`);
    }

    // Get Weaviate fields for this flow
    const fields = getWeaviateFieldsForFlow(flowKey);

    // Build GraphQL query
    const graphqlQuery = buildWeaviateGraphQLQuery(
      className,
      embedding,
      limit,
      fields
    );

    // Execute query
    const response = await fetch(`${WEAVIATE_CONFIG.url}/v1/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WEAVIATE_CONFIG.apiKey && {
          Authorization: `Bearer ${WEAVIATE_CONFIG.apiKey}`,
        }),
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!response.ok) {
      throw new Error(`Weaviate query failed: ${response.statusText}`);
    }

    const data = await response.json();
    const documents = processWeaviateResults(data, scoreThreshold, className);
    const formatted = formatContextFromDocuments(documents);

    console.log(`✅ Retrieved ${documents.length} documents from Weaviate`);

    return {
      documents,
      formattedContext: formatted.context,
      citations: formatted.citations,
      totalRetrieved: documents.length,
    };
  } catch (error) {
    console.error("❌ Weaviate query failed:", error);
    throw error;
  }
}

function buildWeaviateGraphQLQuery(className, embedding, limit, fields) {
  return `
    {
      Get {
        ${className}(
          nearVector: {
            vector: [${embedding.join(", ")}]
          }
          limit: ${limit}
        ) {
          ${fields}
        }
      }
    }
  `;
}

function processWeaviateResults(data, scoreThreshold, className) {
  const results = data.data?.Get?.[Object.keys(data.data.Get)[0]] || [];

  if (className === "HRMixlangRAG") {
    return results
      .filter((item) => item._additional?.certainty >= scoreThreshold)
      .map((item, idx) => ({
        id: item.instanceID || `doc_${idx}`,
        content: item.documentDetail || "",
        title: item.requesterName || "Untitled",
        metadata: {
          description: item.documentDescription,
          email: item.requesterEmail,
          topic: item.documentTopic,
        },
        score: item._additional?.certainty || 0,
      }));
  } else {
    return results
      .filter((item) => 1 - item._additional.distance >= scoreThreshold)
      .map((item, idx) => ({
        id: `doc_${idx}`,
        content: item.content || "",
        title: item.title || "Untitled",
        metadata: item.metadata || {},
        score: 1 - item._additional.distance,
      }));
  }
}

function formatContextFromDocuments(documents) {
  const citations = [];
  const context = documents
    .map((doc, idx) => {
      citations.push({
        index: idx + 1,
        title: doc.title,
        source: "Weaviate",
        relevanceScore: doc.score,
      });
      return `[${idx + 1}] ${doc.content.substring(0, 500)}...`;
    })
    .join("\n\n");

  return {
    context: context.substring(0, 3000),
    citations,
  };
}
