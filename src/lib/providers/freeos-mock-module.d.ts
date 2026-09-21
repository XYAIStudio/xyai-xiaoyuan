declare module "../../../scripts/lib/freeos-mock.mjs" {
  import type { Server } from "node:http";

  export const FREEOS_MOCK_USER: string;
  export const FREEOS_MOCK_PASSWORD: string;
  export const FREEOS_MOCK_TOKEN: string;

  export function mockReply(text: string): string;

  export function listenFreeOsMock(
    port: number,
    host?: string,
    options?: { setupRequired?: boolean },
  ): Promise<{ server: Server; port: number; url: string }>;
}
