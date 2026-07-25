import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";
import { UnauthorizedError } from "@/auth/types/errors";

export async function POST() {
  try {
    const service = await createAuthService();
    const result = await service.refreshSession();
    if (!result) {
      throw new UnauthorizedError("Session expired");
    }
    return authSuccess(result, "Session refreshed");
  } catch (error) {
    return mapAuthError(error);
  }
}
