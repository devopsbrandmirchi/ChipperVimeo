import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";

export async function POST() {
  try {
    const service = await createAuthService();
    await service.logout();
    return authSuccess({ ok: true }, "Logged out successfully");
  } catch (error) {
    return mapAuthError(error);
  }
}
