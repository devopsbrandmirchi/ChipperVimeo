import { z } from "zod";

import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { uuidSchema } from "@/app/api/v1/_shared/schemas";
import { requirePermission } from "@/auth/guards/role.guard";
import { AdminUserService } from "@/auth/services/admin-user.service";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "ANALYST", "READ_ONLY"]),
});

export const PATCH = createApiHandler(
  async ({ request, params, user, requestId }) => {
    requirePermission(user, "settings:manage");
    const id = uuidSchema.parse(params.id);
    const body = patchSchema.parse(await request.json());
    const service = new AdminUserService();
    const updated = await service.updateRole(user, id, body.role);
    return successResponse(updated, "Role updated successfully", {
      requestId,
    });
  },
);
