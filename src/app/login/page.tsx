import LoginForm from "./LoginForm";

interface LoginPageProps {
  searchParams: Promise<{ reset?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const resetSuccess = params.reset === "ok";

  return <LoginForm resetSuccess={resetSuccess} />;
}
