import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ClientRedirect from "@/components/auth/ClientRedirect";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="p-8">
      <ClientRedirect />
      <h1>Landing page placeholder</h1>
    </div>
  );
}
