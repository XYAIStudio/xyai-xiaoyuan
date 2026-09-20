import { useEffect, useRef, useState } from "react";

import { DEFAULT_APP_CONFIG, normalizeLoadedConfig } from "../lib/configLogic";
import { PET_POSE_LIST, type PetPoseId } from "../lib/mascots";
import { BACKEND_PROVIDERS, getProvider } from "../lib/providers/registry";
import type { ProviderId } from "../lib/providers/types";
import { tauriApi } from "../lib/tauriApi";
import { hideCurrentWindow } from "../lib/tauriWindowApi";
import type { AppConfig } from "../lib/types";
import {
  APP_VERSION,
  checkAppUpdate,
  installAppUpdate,
  readAppVersion,
  type UpdateCheckResult,
} from "../lib/updates";

type Tab = "backend" | "pet" | "shortcuts" | "about";

export default function SettingsWindow() {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [tab, setTab] = useState<Tab>("backend");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(APP_VERSION);
  const [update, setUpdate] = useState<UpdateCheckResult>({
    status: "idle",
    version: APP_VERSION,
  });

  const runUpdateCheck = async () => {
    setBusy(true);
    setUpdate({ status: "idle", version });
    try {
      const result = await checkAppUpdate();
      setUpdate(result);
      if (result.status === "available") {
        setStatus(`发现新版本 ${result.version}`);
      } else if (result.status === "current") {
        setStatus(`已是最新版 ${result.version}`);
      } else if (result.status === "desktop-only") {
        setStatus("检查更新仅在桌面客户端可用（npm run tauri dev / 安装包）");
      } else if (result.status === "error") {
        setStatus(result.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const runUpdateCheckRef = useRef(runUpdateCheck);
  runUpdateCheckRef.current = runUpdateCheck;

  useEffect(() => {
    void tauriApi.loadConfig().then(setCfg);
    void readAppVersion().then(setVersion);
    let unlisten: (() => void) | undefined;
    void tauriApi
      .listenCheckUpdates(() => {
        setTab("about");
        void runUpdateCheckRef.current();
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  const provider = getProvider(cfg.providerId);

  const save = async () => {
    await tauriApi.saveConfig(cfg);
    if (cfg.providerId === "freeos" && password) {
      await tauriApi.setSecret("freeos_password", password);
    }
    if (cfg.providerId === "openxyos" && password) {
      await tauriApi.setSecret("openxyos_password", password);
    }
    if (cfg.providerId === "grokbot" && token) {
      await tauriApi.setSecret("grokbot_token", token);
    }
    await tauriApi.reloadHotkeys();
    await tauriApi.emitAuthUpdated();
    await tauriApi.emitMascotChanged(cfg.mascotId);
    await tauriApi.emitConfigUpdated();
    setStatus("已保存");
  };

  const test = async () => {
    setBusy(true);
    setStatus("正在测试…");
    try {
      await tauriApi.saveConfig(cfg);
      if (password) {
        const key =
          cfg.providerId === "openxyos" ? "openxyos_password" : "freeos_password";
        if (cfg.providerId === "freeos" || cfg.providerId === "openxyos") {
          await tauriApi.setSecret(key, password);
        }
      }
      if (cfg.providerId === "grokbot" && token) {
        await tauriApi.setSecret("grokbot_token", token);
      }
      const username =
        cfg.providerId === "openxyos" ? cfg.openxyos.email : cfg.freeos.username;
      const baseUrl =
        cfg.providerId === "openxyos"
          ? cfg.openxyos.baseUrl
          : cfg.providerId === "grokbot"
            ? cfg.grokbot.baseUrl
            : cfg.providerId === "xyai-studio"
              ? cfg.xyaiStudio.baseUrl
              : cfg.freeos.baseUrl;
      const result = await provider.testConnection({
        baseUrl,
        username,
        getSecret: tauriApi.getSecret,
        setSecret: tauriApi.setSecret,
        deleteSecret: tauriApi.deleteSecret,
      });
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "测试失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-root">
      <header className="settings-header">
        <strong>XYAI精灵小元 · 设置</strong>
        <button type="button" onClick={() => void hideCurrentWindow()}>
          ×
        </button>
      </header>
      <nav className="settings-tabs">
        {(
          [
            ["backend", "后端"],
            ["pet", "桌宠"],
            ["shortcuts", "快捷键"],
            ["about", "关于"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "backend" ? (
        <section className="settings-body">
          <label>
            后端
            <select
              value={cfg.providerId}
              onChange={(event) =>
                setCfg((current) =>
                  normalizeLoadedConfig({
                    ...current,
                    providerId: event.target.value as ProviderId,
                  }),
                )
              }
            >
              {BACKEND_PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.labelZh}
                  {item.ready ? "" : "（未就绪）"}
                </option>
              ))}
            </select>
          </label>
          <p className="settings-note">
            小元可对接 XYAI Studio 组织下的独立产品（FreeOS、openXYOS、XYAI Studio
            工作台等），以及额外的本机 Grok Bot
            网关。切换后端不会改动桌宠与对话界面。没有本机服务时，可先跑{" "}
            <code>npm run mock:backends</code>，再把地址改成 18088 / 13000 / 11340。
          </p>
          {!provider.ready ? (
            <p className="settings-note">{provider.notReadyReason}</p>
          ) : null}
          {cfg.providerId === "freeos" ? (
            <>
              <label>
                FreeOS 地址
                <input
                  value={cfg.freeos.baseUrl}
                  placeholder="http://127.0.0.1:8088"
                  onChange={(event) =>
                    setCfg((c) => ({
                      ...c,
                      freeos: { ...c.freeos, baseUrl: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                用户名
                <input
                  value={cfg.freeos.username}
                  onChange={(event) =>
                    setCfg((c) => ({
                      ...c,
                      freeos: { ...c.freeos, username: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                密码（钥匙串）
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </>
          ) : null}
          {cfg.providerId === "openxyos" ? (
            <>
              <label>
                openXYOS API
                <input
                  value={cfg.openxyos.baseUrl}
                  placeholder="http://127.0.0.1:3000"
                  onChange={(event) =>
                    setCfg((c) => ({
                      ...c,
                      openxyos: { ...c.openxyos, baseUrl: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                邮箱
                <input
                  value={cfg.openxyos.email}
                  onChange={(event) =>
                    setCfg((c) => ({
                      ...c,
                      openxyos: { ...c.openxyos, email: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                密码（钥匙串）
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </>
          ) : null}
          {cfg.providerId === "xyai-studio" ? (
            <label>
              探测地址（可选）
              <input
                value={cfg.xyaiStudio.baseUrl}
                placeholder="本机 Studio 若将来暴露 HTTP 再填写"
                onChange={(event) =>
                  setCfg((c) => ({
                    ...c,
                    xyaiStudio: { baseUrl: event.target.value },
                  }))
                }
              />
            </label>
          ) : null}
          {cfg.providerId === "grokbot" ? (
            <>
              <label>
                网关地址
                <input
                  value={cfg.grokbot.baseUrl}
                  placeholder="http://127.0.0.1:1340"
                  onChange={(event) =>
                    setCfg((c) => ({
                      ...c,
                      grokbot: { ...c.grokbot, baseUrl: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Bearer 令牌（钥匙串，切勿提交到 Git）
                <input
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
              </label>
              <label>
                gateway.json 路径（可选）
                <input
                  value={cfg.grokbot.gatewayJsonPath}
                  placeholder="/home/box/sand-data/gateway.json"
                  onChange={(event) =>
                    setCfg((c) => ({
                      ...c,
                      grokbot: { ...c.grokbot, gatewayJsonPath: event.target.value },
                    }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={!cfg.grokbot.gatewayJsonPath}
                onClick={async () => {
                  try {
                    const imported = await tauriApi.importGatewayJson(
                      cfg.grokbot.gatewayJsonPath,
                    );
                    setCfg((c) => ({
                      ...c,
                      grokbot: { ...c.grokbot, baseUrl: imported.baseUrl },
                    }));
                    setStatus(
                      imported.hasToken
                        ? `已导入网关地址 ${imported.baseUrl}，令牌已写入钥匙串`
                        : `已导入地址 ${imported.baseUrl}，文件中无 token`,
                    );
                  } catch (error) {
                    setStatus(error instanceof Error ? error.message : "导入失败");
                  }
                }}
              >
                从 gateway.json 导入
              </button>
              <p className="settings-note">
                本机网关为内部接口，仅建议在 127.0.0.1 /
                隧道内使用，路径与字段可能随版本变化。
              </p>
            </>
          ) : null}
          <div className="settings-actions">
            <button type="button" disabled={busy} onClick={() => void test()}>
              测试连接
            </button>
            <button type="button" onClick={() => void save()}>
              保存
            </button>
          </div>
          {status ? <p className="settings-status">{status}</p> : null}
        </section>
      ) : null}
      {tab === "pet" ? (
        <section className="settings-body">
          <label className="settings-check">
            <input
              type="checkbox"
              checked={cfg.autoExpression}
              onChange={(event) =>
                setCfg((c) => ({ ...c, autoExpression: event.target.checked }))
              }
            />
            根据对话状态自动切换表情
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={cfg.lockPose}
              onChange={(event) =>
                setCfg((c) => ({ ...c, lockPose: event.target.checked }))
              }
            />
            锁定姿态
          </label>
          <p className="settings-note">
            点击缩略图选择默认待机姿势（16
            个官方造型）。锁定后自动表情与待机轮换都会暂停，手动点选仍可更换当前造型。
          </p>
          <div className="pose-grid">
            {PET_POSE_LIST.map((pose) => (
              <button
                key={pose.id}
                type="button"
                className={cfg.mascotId === pose.id ? "is-active" : ""}
                onClick={() =>
                  setCfg((c) => ({ ...c, mascotId: pose.id as PetPoseId }))
                }
              >
                <img src={pose.src} alt={pose.labelZh} />
                <span>
                  {String(pose.index).padStart(2, "0")} {pose.labelZh}
                </span>
              </button>
            ))}
          </div>
          <div className="settings-actions">
            <button type="button" onClick={() => void save()}>
              保存
            </button>
          </div>
        </section>
      ) : null}
      {tab === "shortcuts" ? (
        <section className="settings-body">
          <label>
            打开小元
            <input
              value={cfg.shortcutOpenPet}
              onChange={(event) =>
                setCfg((c) => ({ ...c, shortcutOpenPet: event.target.value }))
              }
            />
          </label>
          <label>
            打开后端主页
            <input
              value={cfg.shortcutOpenHome}
              onChange={(event) =>
                setCfg((c) => ({ ...c, shortcutOpenHome: event.target.value }))
              }
            />
          </label>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={cfg.keepWindowsVisible}
              onChange={(event) =>
                setCfg((c) => ({ ...c, keepWindowsVisible: event.target.checked }))
              }
            />
            点击其他应用时保持对话/设置窗口显示
          </label>
          <div className="settings-actions">
            <button type="button" onClick={() => void save()}>
              保存
            </button>
          </div>
        </section>
      ) : null}
      {tab === "about" ? (
        <section className="settings-body">
          <p className="settings-note">
            XYAI精灵小元 {version} ·
            官方桌面伴侣。本机始终置顶，对话走你在「后端」里选择的 XYAIStudio 产品。
          </p>
          <p className="settings-note">
            更新源：GitHub Releases 的 <code>latest.json</code>
            。首次公开发布前请自行生成签名密钥并写入仓库 Secrets（见 README）。
          </p>
          <div className="settings-actions">
            <button type="button" disabled={busy} onClick={() => void runUpdateCheck()}>
              检查更新
            </button>
            {update.status === "available" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void installAppUpdate().catch((error) => {
                    setStatus(error instanceof Error ? error.message : "安装更新失败");
                  });
                }}
              >
                下载并安装 {update.version}
              </button>
            ) : null}
          </div>
          {update.status === "current" ? (
            <p className="settings-status">当前 {update.version} 已是最新。</p>
          ) : null}
          {status ? <p className="settings-status">{status}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
