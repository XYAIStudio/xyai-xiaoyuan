import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_APP_CONFIG } from "./configLogic";
import PetWindow from "../windows/PetWindow";
import SettingsWindow from "../windows/SettingsWindow";
import { PET_POSE_LIST } from "./mascots";

vi.mock("./tauriApi", async () => {
  const { DEFAULT_APP_CONFIG: defaults } = await import("./configLogic");
  return {
    tauriApi: {
      loadConfig: vi.fn(async () => ({ ...defaults })),
      saveConfig: vi.fn(async () => undefined),
      patchConfig: vi.fn(async () => undefined),
      getSecret: vi.fn(async () => null),
      setSecret: vi.fn(async () => undefined),
      deleteSecret: vi.fn(async () => undefined),
      showChatNearPet: vi.fn(async () => undefined),
      showSettings: vi.fn(async () => undefined),
      quitApp: vi.fn(async () => undefined),
      reloadHotkeys: vi.fn(async () => undefined),
      applyPetWindow: vi.fn(async () => undefined),
      clampPetToWorkArea: vi.fn(async () => undefined),
      isChatVisible: vi.fn(async () => false),
      focusChat: vi.fn(async () => undefined),
      setAutostart: vi.fn(async () => false),
      getActivitySnapshot: vi.fn(async () => ({
        idleMs: 0,
        kind: "idle",
        source: "unavailable",
        available: false,
      })),
      analyzeScreen: vi.fn(async () => ({
        title: "",
        process: "",
        category: "unknown",
        capturedAt: 0,
        stats: {
          width: 0,
          height: 0,
          meanLuma: 0,
          darkRatio: 0,
          brightRatio: 0,
          edgeScore: 0,
          colorVariance: 0,
          chromaMean: 0,
          captured: false,
        },
      })),
      emitAuthUpdated: vi.fn(async () => undefined),
      emitMascotChanged: vi.fn(async () => undefined),
      listenMascotChanged: vi.fn(async () => () => undefined),
      listenPetLifecycle: vi.fn(async () => () => undefined),
      emitConfigUpdated: vi.fn(async () => undefined),
      listenConfigUpdated: vi.fn(async () => () => undefined),
      listenCheckUpdates: vi.fn(async () => () => undefined),
      listenPetToast: vi.fn(async () => () => undefined),
      listenPomodoroToggle: vi.fn(async () => () => undefined),
      emitPomodoroUpdated: vi.fn(async () => undefined),
      emitPomodoroToggle: vi.fn(async () => undefined),
      emitPomodoroSkip: vi.fn(async () => undefined),
      listenPomodoroSkip: vi.fn(async () => () => undefined),
      listenPomodoroUpdated: vi.fn(async () => () => undefined),
      emitCompanionAction: vi.fn(async () => undefined),
      listenCompanionAction: vi.fn(async () => () => undefined),
      setTrayTooltip: vi.fn(async () => undefined),
      emitPetToast: vi.fn(async () => undefined),
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
    expect(screen.getByRole("button", { name: "锁定姿态" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拍一拍" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "喂食" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "晚安" })).toBeInTheDocument();
  });

  it("cycles a playful pose on click without opening chat", async () => {
    const { tauriApi } = await import("./tauriApi");
    const { container } = render(<PetWindow />);
    await screen.findByAltText("挥手问好");
    fireEvent.click(container.querySelector(".pet-root")!);
    expect(tauriApi.showChatNearPet).not.toHaveBeenCalled();
    expect(await screen.findByAltText("比心")).toBeInTheDocument();
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
    expect(screen.getByText(/本机联调优先 FreeOS/)).toBeInTheDocument();
    expect(screen.getByText(/docs\/live-freeos\.md/)).toBeInTheDocument();
  });

  it("shows Chinese connection result after 测试连接", async () => {
    const { tauriApi } = await import("./tauriApi");
    const { freeOsProvider } = await import("./providers/freeos");
    vi.mocked(tauriApi.getSecret).mockResolvedValue("xiaoyuan");
    const spy = vi.spyOn(freeOsProvider, "testConnection").mockResolvedValue({
      ok: true,
      message: "已连接：小元 · 1 个智能体",
      latencyMs: 12,
    });
    render(<SettingsWindow />);
    fireEvent.change(await screen.findByLabelText("用户名"), {
      target: { value: "xiaoyuan" },
    });
    fireEvent.change(screen.getByLabelText("密码（钥匙串）"), {
      target: { value: "xiaoyuan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
    expect(await screen.findByTestId("connection-status")).toHaveTextContent(/已连接：小元/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("exposes pose auto-switch and lock controls on the pet tab", async () => {
    render(<SettingsWindow />);
    fireEvent.click(await screen.findByRole("button", { name: "桌宠" }));
    expect(screen.getByLabelText("根据对话状态自动切换表情")).toBeChecked();
    expect(screen.getByLabelText("锁定姿态")).not.toBeChecked();
    expect(screen.getByLabelText("始终置顶")).toBeChecked();
    expect(screen.getByLabelText("登录时自动启动小元")).not.toBeChecked();
  });

  it("exposes activity sensing and sound switches on the companion tab", async () => {
    render(<SettingsWindow />);
    fireEvent.click(await screen.findByRole("button", { name: "陪伴" }));
    expect(
      screen.getByLabelText("活动感知（根据键盘/鼠标空闲切换姿态）"),
    ).toBeChecked();
    expect(screen.getByLabelText("开启声音（总开关，默认关闭）")).not.toBeChecked();
    expect(screen.getByLabelText("音效")).toBeChecked();
    expect(
      screen.getByLabelText("偶尔说一句（空闲气泡，打招呼仍会显示）"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("理解屏幕内容（默认关闭，仅本机分析）"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("理解屏幕内容（默认关闭，仅本机分析）"),
    ).not.toBeDisabled();
    expect(screen.getByLabelText("允许截屏分析（额外开关，永不上传）")).toBeDisabled();
    expect(
      screen.getByLabelText("背景音乐（仓库自制循环，需打开总开关）"),
    ).not.toBeChecked();
  });

  it("shows extra shortcuts including click-through and pomodoro", async () => {
    render(<SettingsWindow />);
    fireEvent.click(await screen.findByRole("button", { name: "快捷键" }));
    expect(screen.getByLabelText("打开对话")).toHaveValue(
      DEFAULT_APP_CONFIG.shortcutOpenChat,
    );
    expect(screen.getByLabelText("番茄钟开始/暂停")).toHaveValue(
      DEFAULT_APP_CONFIG.shortcutPomodoro,
    );
    expect(screen.getByLabelText("拍一拍")).toHaveValue(DEFAULT_APP_CONFIG.shortcutPat);
  });

  it("shows version and update check on the about tab", async () => {
    render(<SettingsWindow />);
    fireEvent.click(await screen.findByRole("button", { name: "关于" }));
    expect(await screen.findByRole("button", { name: "检查更新" })).toBeInTheDocument();
    expect(screen.getByText(/XYAI精灵小元 0\.1\.0/)).toBeInTheDocument();
  });
});
