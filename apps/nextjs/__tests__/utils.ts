import type { SupportedClerkEvents } from "../src/app/api/webhooks/clerk/handler";

// Matches WebhookEventAttributes: requires client_ip and user_agent
const defaultEventAttributes = {
  http_request: {
    client_ip: "127.0.0.1",
    user_agent: "test-agent",
  },
};

export function makeUserCreatedEvent(
  id: string,
  email: string,
  first_name = "John",
  last_name = "Doe",
): SupportedClerkEvents {
  return {
    type: "user.created",
    object: "event",
    event_attributes: defaultEventAttributes,
    data: {
      id,
      object: "user",
      email_addresses: [
        {
          id: "email_1",
          object: "email_address",
          email_address: email,
          verification: null,
          linked_to: [],
        },
      ],
      primary_email_address_id: "email_1",
      first_name,
      last_name,
      image_url: "",
      // No role in metadata — handler will assign based on ownerEmails
      public_metadata: {},
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  } as unknown as SupportedClerkEvents;
}

export function makeUserUpdatedEvent(
  id: string,
  email: string,
  /**
   * The role currently stored in Clerk's public_metadata.
   * Leave undefined to simulate a new/unsynced user (triggers role sync
   * whenever the DB role differs).
   */
  clerkMetadataRole?: string,
): SupportedClerkEvents {
  return {
    type: "user.updated",
    object: "event",
    event_attributes: defaultEventAttributes,
    data: {
      id,
      object: "user",
      email_addresses: [
        {
          id: "email_1",
          object: "email_address",
          email_address: email,
          verification: null,
          linked_to: [],
        },
      ],
      primary_email_address_id: "email_1",
      first_name: "John",
      last_name: "Doe",
      image_url: "",
      public_metadata: clerkMetadataRole ? { role: clerkMetadataRole } : {},
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  } as unknown as SupportedClerkEvents;
}

export function makeUserDeletedEvent(id: string): SupportedClerkEvents {
  return {
    type: "user.deleted",
    object: "event",
    event_attributes: defaultEventAttributes,
    data: {
      id,
      object: "user",
      deleted: true,
    },
  } as unknown as SupportedClerkEvents;
}
