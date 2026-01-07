require("dotenv").config();
const express = require("express");
const cors = require("cors");
const weaviate = require("weaviate-client").default;
const OpenAI = require("openai");

async function main() {
  const app = express();
  const port = 3001;

  app.use(cors());
  app.use(express.json());

  console.log("Connecting to Weaviate...");
  try {
    const client = await weaviate.connectToWeaviateCloud(
      process.env.WEAVIATE_ENDPOINT,
      {
        authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
        headers: { "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY },
      }
    );

    await client.isReady();
    console.log("Successfully connected to Weaviate.");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    app.post("/api/ask", async (req, res) => {
      const { question, chatHistory = [] } = req.body;

      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }

      console.log(`Step 1: Get text from user: "${question}"`);
      try {
        const { embedding } = await generateQuestionEmbedding(openai, question);
        const docs = await searchWeaviate(client, embedding);
        console.log(`Step 5: Using all ${docs.length} cases from Weaviate.`);

        if (docs.length === 0) {
          return res.json({
            answer:
              "I couldn't find any information matching your question. Please try rephrasing it.",
            citations: [],
          });
        }

        const context = docs
          .map(
            (d, i) =>
              `Case #${i + 1}:\n- Case Number: ${d.caseNumber}\n- Title: ${
                d.caseTitle
              }\n- Type: ${d.caseType}\n- Description: ${
                d.caseDescription
              }\n- Solution: ${d.solutionDescription}\n- Instance ID: ${
                d.instanceID
              }\n- Relevance Score: ${(d._additional.certainty * 100).toFixed(
                2
              )}%`
          )
          .join("\n\n---\n\n");

        const answer = await generateAnswer(
          openai,
          context,
          question,
          chatHistory
        );

        // Generate Kissflow case data based on user question and Weaviate context
        const kissflowData = await generateKissflowCaseData(
          openai,
          question,
          context,
          answer
        );

        const citations = docs.map((d, i) => ({
          index: i + 1,
          title: d.caseTitle,
          caseNumber: d.caseNumber,
          type: d.caseType,
        }));

        const response = { answer, citations, kissflowData };
        console.log(
          "Step 7: Returning final response:",
          JSON.stringify(response, null, 2)
        );
        res.json(response);
      } catch (err) {
        console.error("Error in askQuestion:", err);
        const errorMessage =
          err instanceof Error ? err.message : "An unknown error occurred.";
        res
          .status(500)
          .json({ error: `Internal server error: ${errorMessage}` });
      }
    });

    // ===== Kissflow Create Item Endpoint (CORS Proxy) =====
    app.post("/api/kissflow/create", async (req, res) => {
      const { caseData } = req.body;

      if (!caseData) {
        return res.status(400).json({ error: "caseData is required" });
      }

      try {
        console.log(
          "[Kissflow API] Creating new item with data:",
          JSON.stringify(caseData, null, 2)
        );
        console.log(
          "[Kissflow API] Using Access Key ID:",
          process.env.KISSFLOW_ACCESS_KEY_ID ? "✓ Present" : "✗ Missing"
        );
        console.log(
          "[Kissflow API] Using Access Key Secret:",
          process.env.KISSFLOW_ACCESS_KEY_SECRET ? "✓ Present" : "✗ Missing"
        );
        console.log(
          "[Kissflow API] Using URL:",
          process.env.REACT_APP_KISSFLOW_CREATE_ITEM_API
        );

        const formUrl = `${process.env.REACT_APP_KISSFLOW_CREATE_ITEM_API}`;

        // Wrap caseData in an array as required by Kissflow API
        const requestBody = JSON.stringify([caseData]);
        console.log("[Kissflow API] Request body:", requestBody);

        const response = await fetch(formUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Access-Key-Id": process.env.KISSFLOW_ACCESS_KEY_ID || "",
            "X-Access-Key-Secret": process.env.KISSFLOW_ACCESS_KEY_SECRET || "",
          },
          body: requestBody,
        });

        const responseText = await response.text();
        console.log(`[Kissflow API] Response status: ${response.status}`);
        console.log(`[Kissflow API] Response body: ${responseText}`);

        if (!response.ok) {
          console.error(
            `[Kissflow API] Error ${response.status}:`,
            responseText
          );
          return res.status(response.status).json({
            error: `Kissflow API error: ${response.statusText}`,
            details: responseText,
          });
        }

        const result = JSON.parse(responseText);
        console.log("[Kissflow API] Item created successfully:", result);
        res.json(result);
      } catch (error) {
        console.error("[Kissflow API] Error creating item:", error);
        res.status(500).json({
          error: "Failed to create Kissflow item",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to connect to Weaviate or start the server:", error);
    process.exit(1);
  }
}

async function generateQuestionEmbedding(openai, question) {
  console.log("Step 2: Embedding text using OpenAI...");
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });
  const embedding = response.data[0].embedding;
  console.log(
    `Step 3: Embedding data: {*embedding data of length ${embedding.length}*}`
  );
  return { embedding };
}

async function searchWeaviate(client, vector) {
  console.log(`Step 4: Searching Weaviate with semantic similarity...`);
  const className = "CaseSolutionKnowledgeBase";
  const topK = parseInt(process.env.TOP_K || "5", 10);

  const query = `
      {
        Get {
          ${className}(
            nearVector: { vector: ${JSON.stringify(vector)} }
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
    `;

  try {
    const result = await client.graphql.raw({ query });
    const documents = result.data.Get[className] || [];
    console.log(`Step 5: Found ${documents.length} documents in Weaviate`);
    return documents;
  } catch (error) {
    console.error("Weaviate search failed:", error);
    throw new Error(`Weaviate search failed: ${error.message}`);
  }
}

async function generateAnswer(openai, context, question, chatHistory) {
  console.log("Step 6: Generating answer with context using OpenAI...");
  const systemPrompt = `You are a helpful AI assistant specializing in case management. Your task is to answer the user's question based on the provided case context and chat history. Synthesize the information from similar cases to provide a comprehensive and natural-sounding answer. If the information is not in the context, say that you couldn't find similar cases. Do not make up information. Maintain a conversational and friendly tone in Thai language, like a human would. If the user's question is a follow-up to a previous question, use the chat history to understand the context of the conversation.`;
  const userPrompt = `Question: ${question}\n\nSimilar Cases Context:\n${context}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
    { role: "user", content: userPrompt },
  ];

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL || "gpt-4o",
    temperature: 0.2,
    messages: messages,
  });

  const answer = response.choices[0].message.content.trim();
  console.log(`Step 7: Generated answer: "${answer}"`);
  return answer;
}

async function generateKissflowCaseData(openai, question, context, answer) {
  console.log("Step 6: Generating Kissflow case data using OpenAI...");

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

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const jsonString = response.choices[0].message.content.trim();
    console.log("Step 6: Generated Kissflow case data:", jsonString);

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
      throw new Error(
        `Invalid Case_Type: ${
          caseData.Case_Type
        }. Must be one of: ${validTypes.join(", ")}`
      );
    }

    return caseData;
  } catch (err) {
    console.error("Error generating Kissflow case data:", err);
    // Return default case data if generation fails
    return {
      Case_Title: question.substring(0, 100),
      Case_Type: "Customer Service",
      Case_Description: question.substring(0, 500),
      AI_Suggestions: answer.substring(0, 300),
      Solution_Description: answer.substring(0, 500),
    };
  }
}

main();
