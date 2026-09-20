import { freeOsProvider } from "./freeos";
import { grokBotProvider } from "./grokbot";
import { openXyosProvider } from "./openxyos";
import type { BackendProvider, ProviderId } from "./types";
import { isProviderId } from "./types";
import { xyaiStudioProvider } from "./xyaiStudio";

export const BACKEND_PROVIDERS: BackendProvider[] = [
  freeOsProvider,
  openXyosProvider,
  xyaiStudioProvider,
  grokBotProvider,
];

/**
 * Register a new XYAIStudio (or extra) backend:
 * 1. Implement `BackendProvider` in `src/lib/providers/<id>.ts`
 * 2. Push it onto `BACKEND_PROVIDERS` and add the id to `PROVIDER_IDS`
 * 3. Persist settings via dedicated AppConfig fields or `providerOptions[id]`
 * 4. Add a Settings form section; add secret keys in `secrets_cmd.rs` if needed
 * Pet/chat UI stays unchanged.
 */

export function getProvider(id: string): BackendProvider {
  const found = BACKEND_PROVIDERS.find((provider) => provider.id === id);
  if (!found) {
    throw new Error(`未知后端：${id}`);
  }
  return found;
}

export function safeProviderId(id: string | undefined | null): ProviderId {
  return id && isProviderId(id) ? id : "freeos";
}

export { isProviderId };
export type { BackendProvider, ProviderId } from "./types";
