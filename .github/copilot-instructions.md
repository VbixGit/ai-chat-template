# AI Coding Agent Instructions for Kissflow AI Chat Component

## Architecture Overview

This is a **React-based conversational AI component** embedded in Kissflow low-code platform, supporting multiple business flows (HR, TOR, CRM, Leave Request). The architecture follows a modular, config-driven pattern:

```
Frontend (React) ↔ Backend (Express) ↔ External Services
     ↓                        ↓
Config Layer            API Endpoints
Service Layer           Database Integrations
Utility Layer           Authentication
```

**Key Components:**

- **Frontend**: Single-page chat UI with flow selection, message history, task management
- **Backend**: Express server proxying AI calls and handling Kissflow integrations
- **Services**: OpenAI (chat completion), Weaviate (vector search), Kissflow (workflow), Language Detection
- **Configuration**: Flow-specific settings in `src/config/flows.js`, environment variables in `.env`

## Critical Workflows

### Development Setup

```bash
# Install dependencies
npm install

# Create .env file with required variables (see .env.example)
# REACT_APP_OPENAI_API_KEY=sk-...
# REACT_APP_WEAVIATE_URL=http://localhost:8080
# REACT_APP_KISSFLOW_DOMAIN=your-domain.kissflow.com

# Start development server (webpack dev server on port 5173)
npm start

# Start backend server (Express on port 3001)
node server.js
```

### Build Process

```bash
# Production build (outputs to dist/)
npm run build

# Multiple build outputs exist for different flows:
# - dist_CRM/ for CRM flow
# - dist_LRQ/ for Leave Request flow
```

### Testing

```bash
# Run React test suite
npm test
```

## Project-Specific Patterns

### Flow Configuration

Each flow in `src/config/flows.js` defines:

- **Data sources**: WEAVIATE, KISSFLOW combinations
- **Weaviate classes**: Flow-specific vector collections (e.g., `HRMixlangRAG`, `CaseSolutionKnowledgeBase`)
- **Kissflow process IDs**: Integration points for workflow actions
- **Allowed actions**: ANSWER_ONLY, CREATE, READ, QUERY, UPDATE
- **Response language**: "user-detected" or specific language
- **System prompts**: Flow-specific AI behavior

**Example Flow Config:**

```javascript
CRM: {
  dataSourcesAllowed: ["WEAVIATE", "KISSFLOW"],
  weaviateClasses: ["CaseSolutionKnowledgeBase"],
  kissflowProcessIds: ["CRM_PROCESS"],
  actionsAllowed: ["ANSWER_ONLY", "CREATE", "READ", "QUERY", "UPDATE"],
  responseLanguage: "user-detected",
  systemPrompt: "คุณคือผู้ช่วยสนับสนุน... (Thai support prompt)"
}
```

### Environment Variables

- **Prefix**: `REACT_APP_*` for client-side access
- **Injection**: Webpack DefinePlugin converts to `ENV_*` globals
- **Access**: Use `getEnv()` helper in `src/config/env.js`
- **Validation**: `validateAllConfig()` called at app startup

### Message Handling

Messages include rich metadata:

```javascript
{
  role: "assistant",
  content: "Response text",
  metadata: {
    flow: "CRM",
    language: "th",
    taskState: { status: "completed", id: "task-123" },
    citations: [{ title: "Case #123", caseNumber: "CRM-001" }]
  }
}
```

### Service Integration Patterns

#### OpenAI Service (`src/lib/services/openai.js`)

- **Proxy Pattern**: Frontend calls `/api/chat`, backend calls OpenAI
- **Context Injection**: Weaviate results + chat history
- **Temperature**: 0.2 for deterministic responses

#### Weaviate Service (`src/lib/services/weaviate.js`)

- **Flow-specific queries**: Different classes per flow
- **Hybrid retrieval**: Semantic search with metadata filtering
- **Citation generation**: Results formatted for LLM context

#### Kissflow Service (`src/lib/services/kissflow.js`)

- **SDK Integration**: `@kissflow/lowcode-client-sdk`
- **Page Variables**: Dynamic system prompts and process names
- **User Context**: Account/user info loaded at initialization

### Language Support

- **Detection**: Automatic language detection on user input
- **Translation**: Query translation for English retrieval (TOR/CRM flows)
- **Response**: Language-matched responses based on `responseLanguage` config

### Task State Management

- **Pause/Resume**: Long-running tasks can be interrupted
- **Status Tracking**: `pending`, `running`, `paused`, `completed`, `error`
- **UI Integration**: Task controls in chat interface

## Integration Points

### External Dependencies

- **OpenAI API**: Chat completion and embeddings
- **Weaviate Cloud**: Vector database for knowledge retrieval
- **Kissflow Platform**: Workflow integration and user context
- **Language Detection**: External service for language identification

### API Endpoints (Backend)

- `POST /api/chat`: Main chat completion with context
- `POST /api/kissflow/create`: Create workflow items
- `POST /api/ask`: Legacy endpoint for case retrieval

### Data Flow Patterns

1. **User Input** → Language detection → Translation (if needed)
2. **Query** → Weaviate retrieval → Context formatting
3. **Context + History** → OpenAI completion → Response
4. **Response** → Language matching → Citation attachment
5. **Optional**: Kissflow action creation based on flow permissions

## Development Conventions

### File Organization

```
src/
├── config/          # Flow configs, env vars, types
├── lib/services/    # External service integrations
├── lib/utils/       # Message metadata, task state
├── App.js           # Main component (744 lines - keep modular)
└── App.css          # Styling

server.js            # Express backend
webpack.config.js    # Build configuration
```

### Code Patterns

- **Config-driven**: Avoid hardcoding - use `flows.js` and env vars
- **Service layer**: All external calls through service modules
- **Error handling**: Try/catch with user-friendly messages
- **Logging**: Console logs for debugging, prefixed with emojis
- **Validation**: Config validation at startup

### Common Modifications

- **Add new flow**: Update `src/config/flows.js` with new flow config
- **Change AI behavior**: Modify system prompts in flow config
- **Add service**: Create new module in `src/lib/services/`
- **Update UI**: Modify `App.js` and `App.css`

## Deployment Notes

- **Static hosting**: Frontend can deploy to Netlify/Vercel
- **Full-stack**: Backend required for API proxying
- **Environment**: Separate `.env` files per environment
- **Build variants**: Multiple dist folders for different flows</content>
  <parameter name="filePath">c:\Users\vbix\Desktop\CODE\Process-ai-chat\ai-chat\.github\copilot-instructions.md
