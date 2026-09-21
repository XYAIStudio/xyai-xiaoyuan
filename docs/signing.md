# Windows 签名与自动更新

公开发布前需要**你自己生成**密钥。仓库里的 updater 公钥只是脚手架，**私钥和 Authenticode 证书绝不能进 Git**。没有这些 Secrets 时，CI 仍会打出 **未签名** 的 NSIS，检查必须保持绿色。

相关工作流：

- PR / `main` / `cursor/**`：[Windows installers](../.github/workflows/windows.yml) → Artifact `xyai-xiaoyuan-windows-x64-nsis`
- Tag / 手动：[Release](../.github/workflows/release.yml) → draft GitHub Release，Windows 只上传 NSIS

安装包与更新清单说明见 [packaging-windows.md](packaging-windows.md)。

## 1. Tauri 更新签名（`latest.json`）

桌面端 **设置 → 关于 → 检查更新** 读取：

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

Release 工作流已设置 `updaterJsonPreferNsis: true`，因此 `latest.json` 里的 Windows 条目指向 **NSIS**（`XYAI Xiaoyuan_*_x64-setup.nsis.zip` / `setup.exe`），与 CI Artifact 一致。

### 生成本地密钥

推荐用仓库脚本（会打印下面的 GitHub Secret 步骤，**不会**伪造 Authenticode 证书）：

```bash
bash scripts/generate-tauri-signer.sh
# 只看步骤、不生成文件：
bash scripts/generate-tauri-signer.sh --print-only
```

Windows PowerShell：

```powershell
pwsh scripts/generate-tauri-signer.ps1
pwsh scripts/generate-tauri-signer.ps1 -PrintOnly
```

也可以直接：

```bash
npx tauri signer generate -w ~/.tauri/xyai-xiaoyuan.key
```

会得到：

| 文件                         | 用途                                       |
| ---------------------------- | ------------------------------------------ |
| `~/.tauri/xyai-xiaoyuan.key` | **私钥**，只放本机与 GitHub Secrets        |
| `xyai-xiaoyuan.key.pub`      | 公钥，贴进仓库 `src-tauri/tauri.conf.json` |

生成时可以设密码。有密码则必须同时配置下面的 password secret。

### 写入仓库

1. 把公钥全文贴进 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。
   **务必在给用户安装第一版之前完成**，否则已装客户端无法校验后续更新。
2. GitHub → Settings → Secrets and variables → Actions 添加：

| Secret 名                            | 必填                     | 内容             |
| ------------------------------------ | ------------------------ | ---------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | 要打 updater 产物时必填  | 私钥文件**全文** |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 生成密钥时设了密码才需要 | 私钥密码         |

工作流（`.github/workflows/release.yml` 与 `windows.yml`）会把这两个值传给 `tauri-action` / `npx tauri build`。没有 `TAURI_SIGNING_PRIVATE_KEY` 时自动关闭 `createUpdaterArtifacts`，仍产出未签名 NSIS。

### 没有密钥时

- `scripts/tauri-ci-config.py` 会加上 `bundle.createUpdaterArtifacts=false`
- 仍然产出 NSIS `setup.exe`
- **不会**上传 `latest.json`（避免空签名）
- 客户端检查更新会提示尚未配置，不影响聊天

不要在仓库里放假私钥或假证书来「凑」CI。

## 2. 可选：Authenticode（智能屏幕）

这是 Windows 代码签名，与 updater 的 minisign **不是同一把钥匙**。没有 Authenticode 也能安装，只是 SmartScreen 会提示未知发布者。

仓库**不生成、不提交**任何 PFX / CER。请使用你自己向 CA 购买或组织内部签发的证书。

### 导出并添加 Secrets

1. 在本机把代码签名证书导出为 **PFX**（含私钥）。
2. Base64 编码（不要换行进 Secret 时请自行确认 runner 能解码）：

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("xyai-xiaoyuan-codesign.pfx"))
```

3. GitHub Secrets（都可选，缺了就跳过，构建继续）：

| Secret 名                      | 内容          |
| ------------------------------ | ------------- |
| `WINDOWS_CERTIFICATE`          | PFX 的 Base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX 密码      |

工作流若读到证书，会导入到 `Cert:\CurrentUser\My`，并把指纹写入 `WINDOWS_CERTIFICATE_THUMBPRINT`，再交给 Tauri `bundle.windows.certificateThumbprint`。密码为空或解码失败时**直接跳过**，不会伪造签名。

时间戳服务器沿用 `tauri.conf.json` 里 Windows 摘要设置（`sha256`）。如需自定义 timestamp URL，在本机 `tauri.windows.conf.json` 增加 `timestampUrl`，不要把证书材料写进仓库。

## 3. 发布检查清单

1. 更新 `package.json` / `src-tauri/tauri.conf.json` 版本（`make sync-version VERSION=0.1.x`）。
2. 公钥已写入 `plugins.updater.pubkey`。
3. Secrets：至少 `TAURI_SIGNING_PRIVATE_KEY`（要自动更新时）；Authenticode 按需。
4. 打 tag `v0.1.x` / `app-v0.1.x` 或手动跑 **Release**。
5. 确认 draft Release 上同时有：
   - `XYAI Xiaoyuan_<ver>_x64-setup.exe`（或 nsis zip）
   - `latest.json`（仅在 updater 密钥存在时）
6. 核对 `latest.json` 的 `platforms.windows-x86_64.url` 指向该 NSIS 产物。

更细的下载步骤见 [packaging-windows.md](packaging-windows.md)。
