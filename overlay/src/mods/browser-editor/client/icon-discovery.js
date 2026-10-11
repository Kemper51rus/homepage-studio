const discoveredIconPattern =
  /^\/api\/config\/icon\/discovered-[a-f0-9]{64}\.(?:gif|ico|jpg|png|svg|webp)$/;

export async function discoverNewItemIcon(modal, config, request = fetch) {
  let timeoutId;
  try {
    if (
      modal?.mode === "edit" ||
      !["services", "bookmarks"].includes(modal?.type) ||
      (config?.icon != null &&
        (typeof config.icon !== "string" || config.icon.trim() !== "")) ||
      typeof config?.href !== "string" ||
      !/^https?:\/\//i.test(config.href.trim())
    ) {
      return config;
    }

    const href = new URL(config.href.trim());
    if (
      !["http:", "https:"].includes(href.protocol) ||
      href.username ||
      href.password
    ) {
      return config;
    }

    const controller = new AbortController();
    const timeout = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, 8000);
    });
    const discovery = (async () => {
      const response = await request("/api/config/icon/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: href.toString() }),
        signal: controller.signal,
      });
      return response.ok ? response.json() : null;
    })();
    const result = await Promise.race([discovery, timeout]);
    if (
      controller.signal.aborted ||
      result?.success !== true ||
      typeof result.localIcon !== "string" ||
      !discoveredIconPattern.test(result.localIcon)
    ) {
      return config;
    }

    return { ...config, icon: result.localIcon };
  } catch {
    return config;
  } finally {
    clearTimeout(timeoutId);
  }
}
