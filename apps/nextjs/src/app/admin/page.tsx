import { AuthShowcase } from "../_components/auth-showcase";
import { HomeContent } from "../_components/home-content";
import { CreatePostForm } from "../_components/posts";
import { requireAdmin } from "../../auth/require-admin";

export default async function AdminHome() {
  await requireAdmin();

  return (
    <>
      <AuthShowcase />
      <div className="flex flex-col items-center justify-center gap-4">
        <CreatePostForm />
      </div>
      <HomeContent />
    </>
  );
}
