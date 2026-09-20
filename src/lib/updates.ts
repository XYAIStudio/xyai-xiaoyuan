export const APP_VERSION = "0.1.0";
export const UPDATER_ENDPOINT =
  "https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json";

export type UpdateCheckResult =
  | { status: "desktop-only" }
  | { status: "idle"; version: string }
  | { status: "current"; version: string }
  | { status: "available"; version: string; notes: string }
  | { status: "error"; message: string };

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function readAppVersion(): Promise<string> {
  if (!isTauriRuntime()) return APP_VERSION;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return APP_VERSION;
  }
}

export async function checkAppUpdate(): Promise<UpdateCheckResult> {
  const version = await readAppVersion();
  if (!isTauriRuntime()) return { status: "desktop-only" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { status: "current", version };
    return {
      status: "available",
      version: update.version,
      notes: update.body ?? "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/404|failed to fetch|error sending request|not found/i.test(message)) {
      return {
        status: "error",
        message:
          "还没有发布更新包。请先在 GitHub Releases 上传带 latest.json 的安装包。",
      };
    }
    if (/signature|pubkey|secret/i.test(message)) {
      return {
        status: "error",
        message: "更新签名未配置。请在仓库 Secrets 中加入 TAURI_SIGNING_PRIVATE_KEY。",
      };
    }
    return { status: "error", message };
  }
}

export async function installAppUpdate(): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("仅桌面端可安装更新");
  }
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) throw new Error("当前已是最新版本");
  await update.downloadAndInstall();
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch {
    /* relaunch is best-effort after the installer runs */
  }
}
