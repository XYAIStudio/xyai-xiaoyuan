import { getCurrentWindow } from "@tauri-apps/api/window";

export function getWindowLabel(): string {
  try {
    return getCurrentWindow().label;
  } catch {
    const query = new URLSearchParams(window.location.search).get("window");
    return query || "pet";
  }
}

export async function startCurrentWindowDrag(): Promise<void> {
  try {
    await getCurrentWindow().startDragging();
  } catch {
    /* browser preview */
  }
}

export async function hideCurrentWindow(): Promise<void> {
  try {
    await getCurrentWindow().hide();
  } catch {
    /* browser preview */
  }
}
