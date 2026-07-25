import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export type SessionUser = {
  id: string;
  email: string | undefined;
  role: string | null;
};

export type UpdateSessionResult = {
  response: NextResponse;
  user: SessionUser | null;
};

/**
 * Refresh Supabase Auth session cookies at the network boundary.
 * Called from `src/proxy.ts` — never used to authorize the Vimeo webhook.
 */
export async function updateSession(
  request: NextRequest,
): Promise<UpdateSessionResult> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: supabaseResponse, user: null };
  }

  const roleValue = user.app_metadata?.role;
  const role = typeof roleValue === "string" ? roleValue : null;

  return {
    response: supabaseResponse,
    user: {
      id: user.id,
      email: user.email,
      role,
    },
  };
}
