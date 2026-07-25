import {
  authSuccess,
  mapAuthError,
} from "@/app/api/auth/_shared/responses";
import { createAuthService } from "@/auth/guards/auth.guard";
import { loginSchema } from "@/auth/types/schemas";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = loginSchema.parse(body);
    const service = await createAuthService();
    const result = await service.login({
      email: input.email,
      password: input.password,
      rememberMe: input.rememberMe,
    });
    return authSuccess(result, "Logged in successfully");
  } catch (error) {
    return mapAuthError(error);
  }
}
