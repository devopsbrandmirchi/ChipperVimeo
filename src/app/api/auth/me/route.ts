import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";
import { UnauthorizedError } from "@/auth/types/errors";

export async function GET() {
  try {
    const service = await createAuthService();
    const result = await service.getCurrentSession();
    if (!result) {
      throw new UnauthorizedError();
    }
    return authSuccess(result, "Current user retrieved");
  } catch (error) {
    return mapAuthError(error);
  }
}
