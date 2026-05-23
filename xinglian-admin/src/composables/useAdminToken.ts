const STORAGE_KEY = "xinglian_admin_token";
const PROFILE_KEY = "xinglian_admin_profile";

export type AdminBackofficeRole = "admin" | "cs";

export type AdminProfile = {
  id: number;
  username: string;
  displayName: string | null;
  role: AdminBackofficeRole;
};

export function getAdminRole(): AdminBackofficeRole {
  return getAdminProfile()?.role ?? "admin";
}

export function getAdminToken(): string {
  return sessionStorage.getItem(STORAGE_KEY) || "";
}

export function setAdminToken(token: string): void {
  const t = token.trim();
  if (!t) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, t);
}

export function setAdminProfile(profile: AdminProfile | null): void {
  if (!profile) {
    sessionStorage.removeItem(PROFILE_KEY);
    return;
  }
  sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getAdminProfile(): AdminProfile | null {
  const raw = sessionStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}
