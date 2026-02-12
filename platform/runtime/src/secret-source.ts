import { getPlatformIdentity } from "./platform-identity";

export type SecretSource = "local-env" | "vercel-env" | "terraform-env";

export function resolveSecretSource(): SecretSource {
  const identity = getPlatformIdentity();

  // CI always uses Terraform
  if (identity.isCI) return "terraform-env";

  // Map VERCEL_ENV to secret source
  if (identity.vercelEnv) {
    switch (identity.vercelEnv) {
      case "development": // local dev on Vercel
      case "preview":
      case "production":
        return "vercel-env";
    }
  }

  // Default fallback
  return "local-env";
}
