# @dw/messaging

Transactional email package using Resend. Handles two distinct email flows: the public contact form submission and the AI agent incident alert notification.

## Purpose

Decouples email delivery from the API and AI agent layers. Provides typed, testable functions with graceful degradation — both functions are no-ops when Resend is not configured (local dev without cloud credentials).

## Architecture

```
src/
├── resend-client.ts    # Resend singleton — getResend()
├── contact-email.ts    # sendContactEmail() — public contact form
├── incident-email.ts   # sendIncidentEmail() — AI agent notifications
└── index.ts            # Re-exports
```

## Key Exports

```typescript
// Contact form email (from portfolio website)
export async function sendContactEmail(params: {
  name: string;
  email: string;
  message: string;
}): Promise<void>;

// Incident notification email (sent by AI agents after analysis)
export async function sendIncidentEmail(params: {
  event: PlatformEvent;
  analysis: AnalysisResult;
  incidentDocPath?: string;
  issueUrl?: string;
}): Promise<void>;
```

### Configuration Guards

Both functions check `isMessagingConfigured()` / `isAgentEmailConfigured()` before sending. They log a warning and return early if Resend is not configured, preventing crashes in local development.

- `RESEND_FROM_EMAIL` — sender for contact form emails
- `RESEND_AGENT_FROM_EMAIL` — sender for incident notifications (separate domain address)
- `RESEND_TO_EMAIL` — destination for both email types

## Dependencies

Consumes: `@dw/config`, `@dw/validators`

Consumed by: `@dw/ai`
