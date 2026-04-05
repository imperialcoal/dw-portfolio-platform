// ─────────────────────────────────────────────
// Clerk user activity tracking types
//
// Stored in Redis under:
//   platform:user-activity:{id}    → UserActivityRecord (individual)
//   platform:user-activity:index   → list of ids, newest first (30d TTL)
// ─────────────────────────────────────────────

export type UserActivityEventType =
  | "user.created"
  | "user.deleted"
  | "user.updated"
  | "session.created"
  | "session.ended"
  | "oauth.connected"
  | "oauth.disconnected";

export interface UserActivityRecord {
  id: string; // nanoid or clerk event ID
  eventType: UserActivityEventType;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  timestamp: string;
  metadata: {
    /** For session events: IP address */
    ipAddress?: string;
    /** For session events: user agent */
    userAgent?: string;
    /** For oauth events: provider name (google, github, etc.) */
    oauthProvider?: string;
    /** Previous role if role changed on user.updated */
    previousRole?: string;
    /** New role if role changed on user.updated */
    newRole?: string;
    /** Whether the user is flagged as admin/owner */
    isOwner?: boolean;
  };
}

// ─────────────────────────────────────────────
// Auth security signal: burst of failed sessions
// Stored as a count in Redis with 1h TTL
// platform:auth:failed-sessions:{userId} → number
// ─────────────────────────────────────────────

export interface AuthSecuritySignal {
  userId: string;
  userEmail: string | null;
  failedSessionCount: number;
  windowMinutes: number;
  detectedAt: string;
}
