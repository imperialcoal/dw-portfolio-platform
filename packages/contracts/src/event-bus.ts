import type { CiJobPayload, SentryJobPayload } from "./queue";

// ─────────────────────────────────────────────
// Platform event map
//
// Maps event type literals to their payload types.
// Adding a new event type here propagates type safety
// to all publishers and handlers automatically.
// ─────────────────────────────────────────────

export interface PlatformEventMap {
  "ci.failure": CiJobPayload;
  "sentry.incident": SentryJobPayload;
}

export type PlatformEventType = keyof PlatformEventMap;

// ─────────────────────────────────────────────
// Handler type
// ─────────────────────────────────────────────

export type EventHandler<T extends PlatformEventType> = (
  payload: PlatformEventMap[T],
) => Promise<void>;

// ─────────────────────────────────────────────
// Event bus — typed handler registry
//
// Usage:
//   const bus = createEventBus();
//   bus.on("ci.failure", async (payload) => { ... });
//   await bus.emit("ci.failure", payload);
// ─────────────────────────────────────────────

export interface EventBus {
  on<T extends PlatformEventType>(event: T, handler: EventHandler<T>): void;

  emit<T extends PlatformEventType>(
    event: T,
    payload: PlatformEventMap[T],
  ): Promise<void>;

  handlers: Partial<{
    [K in PlatformEventType]: EventHandler<K>[];
  }>;
}

export function createEventBus(): EventBus {
  const handlers: Partial<{
    [K in PlatformEventType]: EventHandler<K>[];
  }> = {};

  return {
    handlers,

    on<T extends PlatformEventType>(event: T, handler: EventHandler<T>) {
      // Initialize the array if it doesn't exist yet, then push to the
      // local reference — avoids the non-null assertion on handlers[event]
      const existing = handlers[event];
      if (existing) {
        existing.push(handler);
      } else {
        (handlers as Record<string, EventHandler<T>[]>)[event] = [handler];
      }
    },

    async emit<T extends PlatformEventType>(
      event: T,
      payload: PlatformEventMap[T],
    ) {
      const eventHandlers = handlers[event];
      if (!eventHandlers?.length) return;
      await Promise.all(eventHandlers.map((h) => h(payload)));
    },
  };
}
