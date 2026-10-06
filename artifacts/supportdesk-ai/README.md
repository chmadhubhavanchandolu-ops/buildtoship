# SupportDesk AI

SupportDesk AI is a responsive customer-support demo with a customer chat, human-agent ticket queue, editable knowledge base, analytics, role-aware demo accounts, and adjustable AI confidence thresholds.

## Run locally in Replit

The workspace has two managed workflows:

- **API Server** runs the Express API.
- **web** runs the SupportDesk AI frontend.

The API seeds demo accounts, support conversations, knowledge articles, and default settings when it starts. PostgreSQL is used for conversations, messages, users, articles, internal notes, and settings.

## Demo access

Open the app and choose a role on the sign-in page:

- **Customer** opens a customer chat and conversation history.
- **Agent** opens the support dashboard and ticket queue.
- **Admin** has agent access plus user-role and AI-settings management.

This role picker is intentionally a demo sign-in flow, not production identity verification. For a real deployment, replace it with an identity provider and invite-based account provisioning.

## AI answers and escalation

The assistant searches the stored knowledge articles and includes a confidence score with each reply. It escalates when the best answer is below the configured threshold, the customer asks for an agent, or a sensitive/high-risk request is detected. If an AI provider is unavailable or not configured, the app can still return high-confidence answers directly from the approved knowledge base.

To use OpenAI for answer generation, add `AI_API_KEY` through Replit Secrets. The key is read only by the API server. Prompts are limited to the customer question and the best matching knowledge article; email addresses and long number sequences are redacted before the provider call. The knowledge-base-only path remains available without the provider.

`SESSION_SECRET` is required by the API server to sign the HTTP-only demo session cookie.

## Workspace checks

From the workspace root:

```sh
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/supportdesk-ai run typecheck
pnpm --filter @workspace/db run push
```

The API contract lives in `lib/api-spec/openapi.yaml`; generated React Query hooks and request/response validators are in `lib/api-client-react` and `lib/api-zod`.
