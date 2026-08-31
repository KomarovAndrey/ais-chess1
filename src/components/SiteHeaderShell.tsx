import { getHeaderAuth } from "@/lib/auth/session";
import SiteHeader from "@/components/SiteHeader";

export default async function SiteHeaderShell() {
  const { user, profile } = await getHeaderAuth();
  return <SiteHeader initialUser={user} initialProfile={profile} />;
}
