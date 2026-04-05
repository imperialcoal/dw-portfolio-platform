import { createClient } from "@supabase/supabase-js";

import { isSupabaseStorageConfigured } from "@dw/validators";

import { env } from "~/env";
import { createAdminClient } from "./admin";

export const STORAGE_BUCKETS = {
  PORTFOLIO: "portfolio-assets",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

function createPublicClient() {
  if (!isSupabaseStorageConfigured()) {
    throw new Error(
      "Supabase storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY to enable storage reads.",
    );
  }

  const url = String(env.NEXT_PUBLIC_SUPABASE_URL);
  const key = String(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY);

  return createClient(url, key);
}

// --- Read operations (public, no auth required) ---

export function getPublicUrl(bucket: StorageBucket, path: string): string {
  const supabase = createPublicClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function listFiles(
  bucket: StorageBucket,
  folder?: string,
): Promise<string[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder ?? "");

  if (error) {
    throw new Error(`Storage list failed: ${error.message}`);
  }

  return data.map((file) =>
    getPublicUrl(bucket, folder ? `${folder}/${file.name}` : file.name),
  );
}

// --- Write operations (admin only) ---

export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    throw new Error(
      `File type ${file.type} not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return getPublicUrl(bucket, path);
}

export async function deleteFile(
  bucket: StorageBucket,
  path: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

export async function moveFile(
  bucket: StorageBucket,
  fromPath: string,
  toPath: string,
): Promise<string> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).move(fromPath, toPath);

  if (error) {
    throw new Error(`Storage move failed: ${error.message}`);
  }

  return getPublicUrl(bucket, toPath);
}
