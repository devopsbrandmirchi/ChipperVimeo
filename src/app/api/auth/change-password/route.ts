import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";
import { changePasswordSchema } from "@/auth/types/schemas";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = changePasswordSchema.parse(body);
    const service = await createAuthService();
    const user = await service.changePassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    return authSuccess({ user }, "Password changed successfully");
  } catch (error) {
    return mapAuthError(error);
  }
}
