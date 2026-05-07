import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const raw = process.env.INTEGRATIONS_ENC_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATIONS_ENC_KEY missing — generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error(
      `INTEGRATIONS_ENC_KEY must decode to 32 bytes (got ${key.length}). Use base64url of 32 random bytes.`
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decrypt(token: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = token.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("invalid encrypted token format");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("invalid IV or auth tag length");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  );
}

// ============================================================
// Signed state token used in the OAuth flow.
// HMAC-SHA256 over a JSON payload + expiry. Compact and self-contained
// (no DB roundtrip on the callback). Replay-protected by `nonce` + short TTL.
// ============================================================
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface StatePayload {
  userId: string;
  nonce: string;
  exp: number;
}

function getStateSecret(): Buffer {
  const raw = process.env.INTEGRATIONS_STATE_SECRET;
  if (!raw) throw new Error("INTEGRATIONS_STATE_SECRET missing");
  return Buffer.from(raw, "utf8");
}

export function signState(userId: string): string {
  const payload: StatePayload = {
    userId,
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): StatePayload {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("invalid state format");
  const expected = createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("state signature mismatch");
  }
  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8")
  ) as StatePayload;
  if (Date.now() > payload.exp) throw new Error("state expired");
  return payload;
}
