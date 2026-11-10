"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { parse } from "set-cookie-parser";
import { getAuth } from "@noveris/shared/betterAuth";
import { text } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

async function result(response: Response): Promise<ActionState> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    return {
      error:
        typeof body.message === "string"
          ? body.message
          : "Unable to complete this request.",
    };
  }
  const jar = await cookies();
  for (const cookie of parse(response.headers.getSetCookie())) {
    const sameSite =
      typeof cookie.sameSite === "string"
        ? cookie.sameSite.toLowerCase()
        : undefined;
    jar.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      path: cookie.path || "/",
      maxAge: cookie.maxAge,
      expires: cookie.expires,
      sameSite: sameSite === "strict" || sameSite === "none" ? sameSite : "lax",
    });
  }
  return {};
}

export async function login(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  let state: ActionState;
  try {
    state = await result(
      await (
        await getAuth()
      ).api.signInEmail({
        body: {
          email: text(form, "email", 254),
          password: text(form, "password", 128),
        },
        headers: await headers(),
        asResponse: true,
      }),
    );
  } catch {
    return { error: "Unable to sign in. Check your details and try again." };
  }
  if (state.error) return state;
  redirect("/dashboard");
}
export async function register(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const password = text(form, "password", 128);
    if (password.length < 12)
      return { error: "Use a password with at least 12 characters." };
    const state = await result(
      await (
        await getAuth()
      ).api.signUpEmail({
        body: {
          name: text(form, "name", 80),
          email: text(form, "email", 254),
          password,
          callbackURL: "/verify-email?verified=true",
        },
        headers: await headers(),
        asResponse: true,
      }),
    );
    return state.error
      ? state
      : { success: "Check your inbox to verify your email, then sign in." };
  } catch {
    return { error: "Unable to create your account. Please try again." };
  }
}
export async function forgotPassword(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await (
      await getAuth()
    ).api.requestPasswordReset({
      body: { email: text(form, "email", 254), redirectTo: "/reset-password" },
      headers: await headers(),
    });
    return {
      success:
        "If an account exists, a reset link has been sent. Check your inbox.",
    };
  } catch {
    return { error: "Unable to request a reset. Please try again." };
  }
}
export async function resetPassword(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const newPassword = text(form, "password", 128);
    if (
      newPassword.length < 12 ||
      newPassword !== text(form, "confirmation", 128)
    )
      return {
        error: "Passwords must match and contain at least 12 characters.",
      };
    await (
      await getAuth()
    ).api.resetPassword({
      body: { token: text(form, "token", 500), newPassword },
      headers: await headers(),
    });
    return { success: "Password Reset!" };
  } catch {
    return {
      error: "This reset link is invalid or expired. Request another link.",
    };
  }
}
export async function resendVerification(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    await (
      await getAuth()
    ).api.sendVerificationEmail({
      body: {
        email: text(form, "email", 254),
        callbackURL: "/verify-email?verified=true",
      },
      headers: await headers(),
    });
    return { success: "Check your inbox for the verification link." };
  } catch {
    return { error: "Unable to send verification. Please try again." };
  }
}
export async function logout(): Promise<void> {
  await result(
    await (
      await getAuth()
    ).api.signOut({ headers: await headers(), asResponse: true }),
  );
  redirect("/login");
}
