import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PetWindow from "../windows/PetWindow";
import SettingsWindow from "../windows/SettingsWindow";
import { PET_POSE_LIST } from "./mascots";

vi.mock("./tauriApi", () => {
  return {
    tauriApi: {
      loadConfig: vi.fn(async () => ({
        providerId: "freeos",
        freeos: { baseUrl: "http://127.0.0.1:8088", username: "" },
        openxyos: { baseUrl: "http://127.0.0.1:3000", email: "" },
        xyaiStudio: { baseUrl: "" },
        grokbot: { baseUrl: "http://127.0.0.1:1340", gatewayJsonPath: "" },
        providerOptions: {},
        mascotId: "wave",
        autoExpression: true,
        lastAgentId: null,
        threadIdByAgent: {},
        petX: null,
        petY: null,
        petSize: 180,
        shortcutOpenPet: "CmdOrCtrl+Shift+Y",
        shortcutOpenHome: "CmdOrCtrl+Shift+H",
        keepWindowsVisible: true,
      })),
      saveConfig: vi.fn(async () => undefined),
      patchConfig: vi.fn(async () => undefined),
      getSecret: vi.fn(async () => null),
      setSecret: vi.fn(async () => undefined),
      deleteSecret: vi.fn(async () => undefined),
      showChatNearPet: vi.fn(async () => undefined),
      showSettings: vi.fn(async () => undefined),
      quitApp: vi.fn(async () => undefined),
      reloadHotkeys: vi.fn(async () => undefined),
      emitAuthUpdated: vi.fn(async () => undefined),
      emitMascotChanged: vi.fn(async () => undefined),
      listenMascotChanged: vi.fn(async () => () => undefined),
      listenPetLifecycle: vi.fn(async () => () => undefined),
      importGatewayJson: vi.fn(),
    },
  };
});

vi.mock("./tauriWindowApi", () => ({
  startCurrentWindowDrag: vi.fn(async () => undefined),
  hideCurrentWindow: vi.fn(async () => undefined),
}));

describe("PetWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the mascot and exposes all 16 poses on the context menu", async () => {
    const { container } = render(<PetWindow />);
    const sprite = await screen.findByAltText("挥手问好");
    expect(sprite).toHaveAttribute("src", "/mascots/wave.png");
    const root = container.querySelector(".pet-root");
    expect(root).toBeTruthy();
    fireEvent.contextMenu(root!);
    for (const pose of PET_POSE_LIST) {
      expect(screen.getAllByAltText(pose.labelZh).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll(".pet-menu-poses button")).toHaveLength(16);
  });
});

describe("SettingsWindow", () => {
  it("lists first-party providers including the Studio 未就绪 stub", async () => {
    render(<SettingsWindow />);
    expect(await screen.findByText("XYAI精灵小元 · 设置")).toBeInTheDocument();
    const select = screen.getByLabelText("后端") as HTMLSelectElement;
    const labels = [...select.options].map((option) => option.textContent);
    expect(labels).toEqual([
      "FreeOS / XYAI",
      "openXYOS 组织 OS",
      "XYAI Studio 桌面工作台（未就绪）",
      "本机 Grok Bot",
    ]);
  });
});
