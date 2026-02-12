import { AuthShowcase } from "../_components/auth-showcase";
import { HomeContent } from "../_components/home-content";
import { CreatePostForm } from "../_components/posts";

export default function AdminHome() {
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
