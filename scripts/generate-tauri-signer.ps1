# Generate a Tauri updater signing keypair and print exact GitHub Secret steps.
# Does NOT invent or emit Authenticode / code-signing certificates.
param(
    [switch]$PrintOnly,
    [string]$KeyPath = $(if ($env:TAURI_SIGNER_KEY_PATH) { $env:TAURI_SIGNER_KEY_PATH } else { Join-Path $HOME ".tauri\xyai-xiaoyuan.key" })
)

function Write-SecretSteps {
    @"

========== GitHub Secrets（复制执行）==========

1. 打开仓库 Settings → Secrets and variables → Actions
   https://github.com/XYAIStudio/xyai-xiaoyuan/settings/secrets/actions

2. 新建 Repository secret：

   名称：TAURI_SIGNING_PRIVATE_KEY
   值：  私钥文件全文
         Get-Content -Raw '$KeyPath'

3. 若生成密钥时设置了密码，再添加：

   名称：TAURI_SIGNING_PRIVATE_KEY_PASSWORD
   值：  你当时输入的密码

4. 把公钥全文贴进 src-tauri/tauri.conf.json → plugins.updater.pubkey
   （必须在给用户安装第一版之前完成）

5. 打 tag v0.1.x / app-v0.1.x，或手动跑 Release 工作流。
   有私钥时才会上传 latest.json；没有密钥时 CI 仍打未签名 NSIS。

不要提交私钥、.key、PFX、CER。
Authenticode（WINDOWS_CERTIFICATE）请使用你自己的证书，本脚本不会生成。

详见 docs/signing.md
"@
}

if ($PrintOnly) {
    Write-SecretSteps
    exit 0
}

$keyDir = Split-Path -Parent $KeyPath
if (-not (Test-Path $keyDir)) {
    New-Item -ItemType Directory -Path $keyDir | Out-Null
}

if (Test-Path $KeyPath) {
    Write-Host "已存在私钥：$KeyPath"
    Write-Host "不会覆盖。若要重新生成，先自行移走该文件。"
} else {
    Write-Host "正在调用 tauri signer generate …"
    npx --yes tauri signer generate -w $KeyPath
}

$pubPath = "$KeyPath.pub"
if (Test-Path $pubPath) {
    Write-Host ""
    Write-Host "公钥（贴进 tauri.conf.json plugins.updater.pubkey）："
    Write-Host "----------------------------------------"
    Get-Content -Raw $pubPath
    Write-Host "----------------------------------------"
}

Write-Host ""
Write-Host "私钥路径：$KeyPath"
Write-Host "写入 Secret 前可预览（不要贴到 Issue / PR）："
Write-Host "  Get-Content -Raw '$KeyPath'"
Write-SecretSteps
