// Client-safe: only generates the auth URL via the API route
export function getAuthUrl(): string {
  return "/api/auth/gmail/connect";
}
