import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/supabase/app-url";

const ALLOWED_RETURN_PATHS = new Set(["/dashboard", "/reset-password"]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedPath = requestUrl.searchParams.get("next") ?? "";
  const returnPath = ALLOWED_RETURN_PATHS.has(requestedPath) ? requestedPath : "/login";
  const origin = getAppOrigin();

  if (!code) {
    return Response.redirect(new URL("/login?error=The%20email%20link%20is%20invalid%20or%20has%20expired.", origin));
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Supabase email callback failed", { code: error.code ?? "unknown" });
      return Response.redirect(new URL("/login?error=The%20email%20link%20is%20invalid%20or%20has%20expired.", origin));
    }
    return Response.redirect(new URL(returnPath, origin));
  } catch (error) {
    console.error("Supabase email callback could not be completed", { name: error instanceof Error ? error.name : "unknown" });
    return Response.redirect(new URL("/login?error=Email%20confirmation%20could%20not%20be%20completed.", origin));
  }
}
