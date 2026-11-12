// ENVIO DE AVISOS (Web Push) — roda só no servidor.
// O aviso vai "vazio" (sem texto): o celular acorda o service worker (public/sw.js),
// que busca o texto em /api/push/message. Assim não precisa criptografar a mensagem,
// só assinar o pedido com a chave VAPID.
//
// Variáveis na Vercel:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY -> chave pública (pode aparecer no site)
//   VAPID_PRIVATE_KEY            -> chave privada (SECRETA)

import { createPrivateKey, sign } from "node:crypto";

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const CONTACT = "https://brawldraft-fawn.vercel.app";

export const PUSH_ON = PUBLIC !== "" && PRIVATE !== "";

/** Serviços de aviso aceitos (Google/Android, Firefox, Apple, Windows). Evita mandar pedidos para qualquer lugar. */
const HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 690) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

function b64url(data: Buffer | string): string {
  return Buffer.from(data).toString("base64url");
}

/** Cabeçalho "Authorization" do VAPID (um JWT assinado com ES256). */
export function vapidAuth(endpoint: string, now = Date.now()): string {
  const raw = Buffer.from(PUBLIC, "base64url");
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: PRIVATE, x: b64url(raw.subarray(1, 33)), y: b64url(raw.subarray(33, 65)) },
    format: "jwk",
  });
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: CONTACT }));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${payload}.${b64url(signature)}, k=${PUBLIC}`;
}

/** Manda um aviso vazio. Devolve o código HTTP (201 = ok; 404/410 = aparelho saiu). */
export async function sendPush(endpoint: string): Promise<number> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: vapidAuth(endpoint), TTL: "43200", Urgency: "normal", "Content-Length": "0" },
    });
    return res.status;
  } catch {
    return 0;
  }
}
