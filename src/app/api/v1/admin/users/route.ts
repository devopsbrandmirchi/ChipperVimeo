import { z } from "zod";

import { createApiHandler } from "@/app/api/v1/_shared/api-handler";
import { successResponse } from "@/app/api/v1/_shared/responses";
import { requirePermission } from "@/auth/guards/role.guard";
import { AdminUserService } from "@/auth/services/admin-user.service";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "ANALYST", "READ_ONLY"]),
  method: z.enum(["invite", "create"]).default("invite"),
  password: z.string().min(8).optional(),
});

export const GET = createApiHandler(async ({ user, requestId }) => {
  requirePermission(user, "settings:manage");
  const service = new AdminUserService();
  const [users, audit] = await Promise.all([
    service.listUsers(),
    service.listAudit(40),
  ]);
  return successResponse(
    { users, audit },
    "Admin users retrieved successfully",
    { requestId },
  );
});

export const POST = createApiHandler(async ({ request, user, requestId }) => {
  requirePermission(user, "settings:manage");
  const body = inviteSchema.parse(await request.json());
  const service = new AdminUserService();
  const created = await service.inviteOrCreate(user, body);
  return successResponse(created, "User provisioned successfully", {
    status: 201,
    requestId,
  });
});
