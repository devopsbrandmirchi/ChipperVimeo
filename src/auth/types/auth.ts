/**
 * Auth domain types — framework-agnostic.
 */

import type { AppRole } from "@/auth/types/roles";
import type { Permission } from "@/auth/types/permissions";

export type AuthUser = {
  id: string;
  email: string;
  role: AppRole | null;
  permissions: Permission[];
  createdAt: string | null;
};

export type AuthSession = {
  accessToken: string;
  expiresAt: number | null;
};

export type AuthState = {
  user: AuthUser | null;
  session: AuthSession | null;
};

export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type ForgotPasswordInput = {
  email: string;
};

export type ResetPasswordInput = {
  password: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};
