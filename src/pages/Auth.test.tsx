import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const auth = {
  login: "Log In",
  signup: "Sign Up",
  email: "Email",
  password: "Password",
  name: "Full Name",
  phone: "Phone",
  forgotPassword: "Forgot password?",
  noAccount: "Don't have an account?",
  hasAccount: "Already have an account?",
  resetPassword: "Reset Password",
  sendReset: "Send Reset Link",
  trialNote: "Your free 30-day trial includes full access to all features.",
  confirmPassword: "Confirm password",
  passwordsDoNotMatch: "Passwords do not match.",
  confirmEmailTitle: "Check your email",
  confirmEmailDescription: "We sent a confirmation link.",
  resendConfirmation: "Resend confirmation email",
  resendConfirmationSuccess: "We sent another confirmation link.",
  resendEmailMissing: "Enter the email you signed up with first.",
};
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: { auth } }),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockResend = vi.fn();
const mockSignInWithOAuth = vi.fn();
vi.mock("@/components/ThemeToggle", () => ({ default: () => <div data-testid="theme-toggle" /> }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      resend: (...args: unknown[]) => mockResend(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

import Auth from "./Auth";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/login" element={<Auth />} />
        <Route path="/auth/register" element={<Auth />} />
        <Route path="/app" element={<div data-testid="app-page">app</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockToast.mockReset();
  mockSignInWithPassword.mockReset();
  mockSignUp.mockReset();
  mockResetPasswordForEmail.mockReset();
  mockResend.mockReset();
  mockSignInWithOAuth.mockReset();
});

describe("Auth", () => {
  it("renders the login form by default at /auth/login", () => {
    renderAt("/auth/login");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Full Name")).not.toBeInTheDocument();
  });

  it("renders the signup form with name/phone/confirm-password fields at /auth/register", () => {
    renderAt("/auth/register");
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByText(auth.trialNote)).toBeInTheDocument();
  });

  it("switches to the reset-password mode and back to login", () => {
    renderAt("/auth/login");
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    renderAt("/auth/login");
    const passwordInput = screen.getByLabelText("Password") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput.type).toBe("text");
  });

  it("logs in successfully and navigates to /app", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    renderAt("/auth/login");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "secret123" });
      expect(screen.getByTestId("app-page")).toBeInTheDocument();
    });
  });

  it("shows an error toast when login fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: new Error("Invalid credentials") });
    renderAt("/auth/login");

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error", description: "Invalid credentials" })
      )
    );
  });

  it("rejects signup when name is missing", async () => {
    renderAt("/auth/register");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: "Enter your full name." }))
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("rejects signup when passwords don't match", async () => {
    renderAt("/auth/register");
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ description: auth.passwordsDoNotMatch }))
    );
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("signs up successfully without an immediate session and shows the confirm-email screen", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    renderAt("/auth/register");
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("signs up successfully with an immediate session and navigates to /app", async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: "tok" } }, error: null });
    renderAt("/auth/register");
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => expect(screen.getByTestId("app-page")).toBeInTheDocument());
  });

  it("resends the confirmation email from the confirm-email screen", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    mockResend.mockResolvedValue({ error: null });
    renderAt("/auth/register");
    fireEvent.change(screen.getByLabelText("Full Name"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    await screen.findByText("Check your email");

    fireEvent.click(screen.getByText("Resend confirmation email"));

    await waitFor(() =>
      expect(mockResend).toHaveBeenCalledWith(
        expect.objectContaining({ type: "signup", email: "jane@example.com" })
      )
    );
  });

  it("sends a password reset email", async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    renderAt("/auth/login");
    fireEvent.click(screen.getByText("Forgot password?"));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Send Reset Link/i }));

    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "a@b.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
      )
    );
  });

  it("starts Google sign-in and shows an error toast on failure", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: new Error("oauth boom") });
    renderAt("/auth/login");

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Error", description: "oauth boom" }))
    );
  });
});
