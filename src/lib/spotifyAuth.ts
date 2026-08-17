const CLIENT_ID = "39510ca6a53d40bf8bc239fd9296e64b";
const SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state playlist-read-private";
const TOKEN_KEY = "cozyfocus.spotify.tokens";
const VERIFIER_KEY = "cozyfocus.spotify.verifier";
const STATE_KEY = "cozyfocus.spotify.state";

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
}

function redirectUri() {
  return `${window.location.origin}/callback`;
}

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  arr.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(len: number) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(digest);
}

function loadTokens(): TokenSet | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveTokens(data: { access_token: string; refresh_token?: string; expires_in: number; scope?: string }) {
  const existing = loadTokens();
  const tokens: TokenSet = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existing?.refreshToken ?? "",
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? existing?.scope ?? "",
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function hasRequiredScope(scope: string) {
  const granted = new Set(scope.split(" "));
  return SCOPES.split(" ").every((s) => granted.has(s));
}

export function isConnected() {
  const tokens = loadTokens();
  return !!tokens?.refreshToken && hasRequiredScope(tokens.scope);
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function beginLogin() {
  const verifier = randomToken(64);
  const challenge = await challengeFor(verifier);
  const state = randomToken(16);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export function isCallback() {
  return window.location.pathname === "/callback";
}

export async function completeLogin(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const savedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  window.history.replaceState({}, "", "/");
  if (error || !code || !verifier || !state || state !== savedState) return false;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return false;
  saveTokens(await res.json());
  return true;
}

async function refreshTokens(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens?.refreshToken) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: CLIENT_ID,
    }),
  });
  if (!res.ok) {
    logout();
    return null;
  }
  const data = await res.json();
  saveTokens(data);
  return data.access_token;
}

export async function getAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt - 15000) return tokens.accessToken;
  return refreshTokens();
}
