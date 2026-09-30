import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, SubmitButton } from "@/components/auth-form";

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { error, next } = await searchParams;

  return (
    <AuthCard title="Sign in">
      <FormError message={error} />
      <form action={signIn}>
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
        New here?{" "}
        <Link href="/signup" className="font-medium underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}
