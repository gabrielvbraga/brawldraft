// SERVICE WORKER do BrawlDraft: recebe os avisos no celular.
// O aviso chega sem texto; aqui buscamos o texto no site e mostramos a notificação.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let msg = { title: "BrawlDraft", body: "Novidades no Ranked.", url: "/" };
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) {
          const res = await fetch("/api/push/message?e=" + encodeURIComponent(sub.endpoint), { cache: "no-store" });
          if (res.ok) msg = { ...msg, ...(await res.json()) };
        }
      } catch (e) {
        // sem internet: mostra o texto padrão
      }
      await self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "brawldraft",
        data: { url: msg.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
