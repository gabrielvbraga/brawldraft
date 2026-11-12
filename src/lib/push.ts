// AVISOS NO CELULAR (lado do navegador): liga, desliga e atualiza os mapas avisados.

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "unsupported" | "off-server" | "denied" | "off" | "on";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Registra o service worker (também ajuda a instalar o site como app). */
export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

async function current(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (!VAPID) return "off-server";
  if (Notification.permission === "denied") return "denied";
  try {
    return (await current()) ? "on" : "off";
  } catch {
    return "off";
  }
}

async function send(sub: PushSubscription, maps: number[], lang: string): Promise<boolean> {
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, maps, lang }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Pede permissão e liga os avisos. */
export async function enablePush(maps: number[], lang: string): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (!VAPID) return "off-server";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = (await registerWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) as BufferSource }));
    return (await send(sub, maps, lang)) ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function disablePush(): Promise<PushState> {
  try {
    const sub = await current();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => null);
      await sub.unsubscribe();
    }
  } catch {
    // segue
  }
  return "off";
}

/** Se os avisos estão ligados, atualiza a lista de mapas (chamado ao abrir o site). */
export async function refreshPush(maps: number[], lang: string) {
  if (!supported() || !VAPID || Notification.permission !== "granted") return;
  try {
    const sub = await current();
    if (sub) await send(sub, maps, lang);
  } catch {
    // segue
  }
}
