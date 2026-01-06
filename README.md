# AI Chat Template

A lightweight, front-end focused template for building conversational AI web apps. This repository provides a simple chat UI, basic client-side logic, and integration points for connecting to AI model providers (e.g. OpenAI, Anthropic, or a self-hosted model). It's intended as a starting point for developers who want to quickly prototype or deploy a chat-based interface.

Built with:
- JavaScript (frontend application logic)
- HTML (markup)
- CSS (styles)

## Key features
- Minimal, responsive chat UI
- Message rendering with support for user & assistant roles
- Hooks / integration points for server or direct API calls to AI providers
- Easy to customize prompts, UI layout, and styles

## Who is this for?
- Developers building chatbots, virtual assistants, or conversational demos
- Teams who want a quick UI to test prompts and models
- Educators and students learning how to integrate LLMs into web apps

---

## Getting started

Prerequisites
- Node.js (>=16) and npm or yarn
- An account and API key with your chosen AI provider (if using hosted APIs)

Basic local setup (assumes an npm-based project)

1. Clone the repository
```bash
git clone https://github.com/VbixGit/ai-chat-template.git
cd ai-chat-template
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Create environment variables
- Create a `.env` (or `.env.local`) file in the project root or configure your server environment.
- Typical variables:
```
# Example environment variables
VITE_API_BASE_URL=http://localhost:3000        # if a backend proxy is used
AI_PROVIDER=openai                             # name of provider (optional)
OPENAI_API_KEY=sk-...                           # if calling provider from client (not recommended)
```
Note: For security, avoid putting secret keys in client-side code. Prefer using a backend relay/proxy that stores secrets server-side.

4. Run the development server
```bash
npm run dev
# or
yarn dev
```
Open the local URL shown in your console (commonly http://localhost:5173 or http://localhost:3000 depending on the bundler).

5. Build for production
```bash
npm run build
# or
yarn build
```

6. Start the production server (if applicable)
```bash
npm run start
# or
yarn start
```

---

## How the project is organized
(Adjust these to match the actual repository structure)
- /index.html — main HTML page
- /src/
  - /assets — static assets (icons, images)
  - /styles — CSS files
  - /components — UI components (chat bubble, input box)
  - /app.js or /main.js — application entry and chat logic
- /server (optional) — example server to proxy AI requests and keep API keys secret

---

## Integrating an AI model (recommended pattern)
1. Backend proxy (recommended)
   - Create a small API endpoint (e.g., Express, Fastify) that accepts chat messages from the frontend, calls the AI provider with the secret API key, and returns the response.
   - This keeps secrets off the client, and allows you to add rate limiting, logging, and usage monitoring.

Sample Express handler (conceptual)
```js
// server/index.js (concept)
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  // call your provider SDK or HTTP API with server-side secret key
  const response = await callAIProvider(messages);
  res.json(response);
});
```

2. Client call
```js
// src/app.js (concept)
async function sendMessage(messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  return res.json();
}
```

3. Direct client calls (not recommended)
- If you must call provider APIs from the client, use short-lived keys or other protections and understand the security risks.

---

## Customization / Modifications

General approach:
- UI: Edit HTML / components and CSS in `/src` or `/styles`. Change layout, colors, spacing, and accessibility attributes.
- Prompts & conversation logic: Find the part of the code that constructs messages (often an array like [{role: 'system', content: '...'}, ...]) and edit the `system` or assistant instructions.
- Model & provider: Modify the integration code to use your preferred provider's API, SDK, or endpoint.
- Message rendering: Update the component that renders messages to support additional message types (e.g., images, code blocks, attachments).

Examples:

1. Changing the system prompt
```js
const initialSystemMessage = {
  role: 'system',
  content: 'You are a helpful assistant that responds concisely and uses friendly tone.'
};
```
Update `content` to change assistant behavior.

2. Adding a new button or quick-prompt
- Add a new button element in the UI
- Hook its click handler to append a prebuilt message to the conversation and call the send flow

3. Supporting streaming responses
- If your provider supports streaming (SSE, WebSockets), adapt the client code to consume partial responses and render them incrementally.

4. Adding authentication
- Add an auth layer to your backend (JWT, OAuth) to restrict access to the AI proxy endpoint.
- On the client, manage login state and pass tokens in `Authorization` headers.

---

## Environment-specific tips

- Development:
  - Use local proxies or mock responses if you want to test UI without hitting provider quotas.
  - Keep debug logging enabled.

- Production:
  - Ensure API keys are stored securely (server env vars, managed secrets).
  - Add request throttling and monitoring to avoid unexpected costs.
  - Use sanitized logging to avoid storing sensitive user messages.

---

## Deployment
- Static-hosting: If your app is purely static (front-end only), deploy to Netlify, Vercel, GitHub Pages, or any static host.
- Full-stack: For apps with a backend proxy, deploy the server and client parts together (Heroku, Render, Railway, DigitalOcean App Platform, etc.).
- Containerization: Create a Dockerfile for reproducible deployments.

---

## Contributing
- Fork the repo and open a pull request with clear description of changes.
- Create issues for new features or bugs and label them appropriately.
- Follow the coding style used in the repo (JS formatting, CSS conventions).

---

## Security & Privacy
- Do not commit API keys, secrets, or user-sensitive data to the repo.
- Consider anonymizing or filtering personally identifiable information before sending it to third-party AI providers.
- Add user consent and an explanation of how conversation data is used and stored.

---

## Troubleshooting
- Errors when calling the API:
  - Check network requests in the browser DevTools.
  - If using a backend, verify env vars and provider credentials on the server.
- UI issues:
  - Inspect elements and CSS rules to find style conflicts.
  - Ensure JavaScript is loading without runtime errors (check console).

---

## License
Specify a license (e.g., MIT) in a LICENSE file. If none exists, add one appropriate for your project.

---

If you'd like, I can:
- Tailor the README to match the repository's actual file structure (I can inspect files if you allow),
- Add example server code for a specific provider (OpenAI, Anthropic, etc.),
- Produce a shorter or localized README.
