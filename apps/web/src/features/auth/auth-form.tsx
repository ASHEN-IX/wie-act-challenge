import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { TextField } from "@/components/shared/form-field";
import { FieldGroup } from "@/components/ui/field";
import {
  login,
  register,
  forgotPassword,
  resetPassword,
  resendVerification,
} from "./actions";
const forms = {
  login: {
    title: "Welcome back",
    description: "Pick up where you left off.",
    submit: "Sign in",
    action: login,
  },
  register: {
    title: "A space for your next idea",
    description: "Create your EdNova account to get started.",
    submit: "Create account",
    action: register,
  },
  forgot: {
    title: "Forgot your password?",
    description: "We’ll send you a link to reset it.",
    submit: "Send reset link",
    action: forgotPassword,
  },
  reset: {
    title: "Set a new password",
    description: "Choose a strong password for your account.",
    submit: "Reset password",
    action: resetPassword,
  },
  verify: {
    title: "Verify your email",
    description: "Check your inbox or request a new verification link.",
    submit: "Resend verification",
    action: resendVerification,
  },
};
export function AuthForm({
  mode,
  token,
  verified,
}: {
  mode: keyof typeof forms;
  token?: string;
  verified?: boolean;
}) {
  const config = forms[mode];
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="hidden w-[44%] flex-col justify-between bg-primary p-14 text-primary-foreground lg:flex">
        <Link href="/" className="inline-flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <img src="/ednova-mark.svg" alt="" width="40" height="40" className="rounded-[11px]" />
          EdNova
        </Link>
        <div className="max-w-md">
          <h2 className="text-5xl font-medium leading-tight tracking-tight">
            Make room
            <br />
            for understanding.
          </h2>
          <p className="mt-7 text-lg leading-8 opacity-80">
            Your courses. Your questions. A little progress, every day.
          </p>
        </div>
        <p className="text-sm opacity-70">
          Learn independently. Grow together.
        </p>
      </aside>
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center px-6 py-12"
      >
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-12 inline-flex items-center gap-2.5 text-2xl font-semibold lg:hidden"
          >
            <img src="/ednova-mark.svg" alt="" width="32" height="32" className="rounded-lg" />
            EdNova
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            {verified ? "Email verified" : config.title}
          </h1>
          <p className="mb-8 mt-3 text-muted-foreground">
            {verified
              ? "Your account is ready. Sign in to continue."
              : config.description}
          </p>
          {verified ? (
            <Link
              href="/login"
              className="font-medium text-primary underline underline-offset-4"
            >
              Sign in
            </Link>
          ) : (
            <ActionForm action={config.action} submit={config.submit}>
              <FieldGroup>
                {mode === "register" && (
                  <TextField
                    label="Name"
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={80}
                  />
                )}
                {mode !== "reset" && (
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                )}
                {["login", "register", "reset"].includes(mode) && (
                  <TextField
                    label="Password"
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                  />
                )}
                {mode === "reset" && (
                  <>
                    <TextField
                      label="Confirm password"
                      name="confirmation"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                    />
                    <input type="hidden" name="token" value={token || ""} />
                  </>
                )}
              </FieldGroup>
            </ActionForm>
          )}
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                <Link href="/forgot-password" className="hover:text-primary">
                  Forgot password?
                </Link>
                <Link href="/register" className="hover:text-primary">
                  Create an account
                </Link>
                <Link href="/verify-email" className="hover:text-primary">
                  Verify email
                </Link>
              </>
            ) : (
              <Link href="/login" className="hover:text-primary">
                Back to sign in
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
