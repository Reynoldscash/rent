import Link from "next/link";
import { signUp } from "@/lib/auth/actions";
import { AuthCard, Field, FormError, Notice, SubmitButton } from "@/components/auth-form";

type Props = { searchParams: Promise<{ error?: string; sent?: string }> };

export default async function SignUpPage({ searchParams }: Props) {
  const { error, sent } = await searchParams;

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <Notice>
          Check your email to confirm your account. Once confirmed you can list items, request
          bookings and send messages.
        </Notice>
        <Link href="/signin" className="mt-6 inline-block text-sm font-medium underline">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account">
      <FormError message={error} />
      <form action={signUp}>
        <Field label="Full name" name="full_name" autoComplete="name" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password (8+ characters)" name="password" type="password" autoComplete="new-password" />
        <SubmitButton>Sign up</SubmitButton>
      </form>
      <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
