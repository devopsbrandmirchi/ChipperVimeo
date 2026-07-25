import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";
import { resetPasswordSchema } from "@/auth/types/schemas";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = resetPasswordSchema.parse(body);
    const service = await createAuthService();
    const user = await service.resetPassword({ password: input.password });
    return authSuccess({ user }, "Password reset successfully");
  } catch (error) {
    return mapAuthError(error);
  }
}
