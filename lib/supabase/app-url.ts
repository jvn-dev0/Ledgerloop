import "server-only";

export function getAppOrigin() {
  const configuredUrl = process.env.APP_URL?.trim() || "http://localhost:3008";
  let appUrl: URL;
  try {
    appUrl = new URL(configuredUrl);
  } catch {
    throw new Error("APP_URL must be a valid application URL.");
  }
  if (appUrl.protocol !== "http:" && appUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }
  if (process.env.NODE_ENV === "production" && appUrl.protocol !== "https:") {
    throw new Error("APP_URL must use HTTPS in production.");
  }
  return appUrl.origin;
}
