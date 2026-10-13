import { settingsSeed } from "@/lib/mock/data/admin";
import { apiFetch, isApiMode } from "@/lib/api/client";
import { registerApiCache } from "@/lib/api/collection";
import type { WebsiteSettings } from "@/types/entities";

type Section = keyof WebsiteSettings;
const SECTIONS: Section[] = ["general", "navigation", "seo", "contact", "footer"];

let state: WebsiteSettings = settingsSeed;
let loaded = false;
let ready = !isApiMode; // api mode: false until the first read from the server has finished (successfully or not)
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Website-settings service (one document per section).
 *  - mock mode: in-memory, starting from the seed.
 *  - api mode: each section is read from / saved to PostgreSQL through /api/settings/[section]. A section the signed-in
 *    employee may not view keeps the built-in defaults (the server answers 403 and nothing is exposed). Saves go through
 *    the server, which re-checks `settings_<section>:manage_settings`.
 */
async function loadFromServer() {
  const results = await Promise.allSettled(SECTIONS.map((s) => apiFetch<{ value: unknown }>(`/api/settings/${s}`)));
  const next = { ...state } as Record<string, unknown>;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.value !== null) next[SECTIONS[i]] = r.value.value;
  });
  state = next as unknown as WebsiteSettings;
  ready = true;
  emit();
}

export const settingsService = {
  snapshot: () => state,
  ready: () => ready,
  subscribe(l: () => void) {
    listeners.add(l);
    if (isApiMode && !loaded) {
      loaded = true;
      void loadFromServer().catch(() => { loaded = false; ready = true; emit(); });
    }
    return () => listeners.delete(l);
  },
  async get(): Promise<WebsiteSettings> {
    if (isApiMode) await loadFromServer();
    return state;
  },
  async updateSection<K extends Section>(section: K, value: WebsiteSettings[K]): Promise<void> {
    if (isApiMode) {
      const saved = await apiFetch<{ value: WebsiteSettings[K] }>(`/api/settings/${section}`, { method: "PUT", body: value });
      state = { ...state, [section]: saved.value };
    } else {
      state = { ...state, [section]: value };
    }
    emit();
  },
  /** Forget what was loaded (called on sign-in/out so one employee's settings view never leaks into another's). */
  reset() {
    state = settingsSeed;
    loaded = false;
    ready = !isApiMode;
    emit();
  },
};

if (isApiMode) registerApiCache(settingsService);
