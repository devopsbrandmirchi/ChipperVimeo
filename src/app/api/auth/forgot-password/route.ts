import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";
import { forgotPasswordSchema } from "@/auth/types/schemas";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = forgotPasswordSchema.parse(body);
    const service = await createAuthService();
    const origin = new URL(request.url).origin;
    const redirectTo = `${origin}/reset-password`;

    try {
      await service.forgotPassword(input, redirectTo);
    } catch {
      // Always return success to avoid email enumeration.
    }

    return authSuccess(
      { ok: true },
      "If that email exists, a reset link has been sent",
    );
  } catch (error) {
    return mapAuthError(error);
  }
}
