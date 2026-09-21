#!/usr/bin/env bash
# Generate a Tauri updater signing keypair and print exact GitHub Secret steps.
# Does NOT invent or emit Authenticode / code-signing certificates.
set -euo pipefail

PRINT_ONLY=0
KEY_PATH="${TAURI_SIGNER_KEY_PATH:-$HOME/.tauri/xyai-xiaoyuan.key}"

usage() {
  cat <<'EOF'
用法：
  scripts/generate-tauri-signer.sh              生成本地密钥并打印 GitHub Secret 步骤
  scripts/generate-tauri-signer.sh --print-only 只打印步骤，不生成文件

环境变量：
  TAURI_SIGNER_KEY_PATH   私钥路径（默认 ~/.tauri/xyai-xiaoyuan.key）

本脚本只处理 Tauri updater 的 minisign 密钥（TAURI_SIGNING_PRIVATE_KEY）。
不会生成、下载或伪造 Windows Authenticode 证书。
EOF
}

for arg in "$@"; do
  case "$arg" in
    --print-only|-n) PRINT_ONLY=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

print_steps() {
  cat <<EOF

========== GitHub Secrets（复制执行）==========

1. 打开仓库 Settings → Secrets and variables → Actions
   https://github.com/XYAIStudio/xyai-xiaoyuan/settings/secrets/actions

2. 新建 Repository secret：

   名称：TAURI_SIGNING_PRIVATE_KEY
   值：  私钥文件全文（下面会提示路径）
         cat ${KEY_PATH}

3. 若生成密钥时设置了密码，再添加：

   名称：TAURI_SIGNING_PRIVATE_KEY_PASSWORD
   值：  你当时输入的密码

4. 把公钥全文贴进 src-tauri/tauri.conf.json → plugins.updater.pubkey
   （必须在给用户安装第一版之前完成，否则已装客户端无法校验后续更新）

5. 打 tag v0.1.x / app-v0.1.x，或手动跑 Release 工作流。
   有私钥时才会上传 latest.json；没有密钥时 CI 仍打未签名 NSIS，检查保持绿色。

不要提交私钥、.key、PFX、CER。
Authenticode（WINDOWS_CERTIFICATE）是另一回事：请使用你自己向 CA 购买
或组织签发的证书，本脚本不会生成。

详见 docs/signing.md
EOF
}

if [ "$PRINT_ONLY" -eq 1 ]; then
  print_steps
  exit 0
fi

mkdir -p "$(dirname "$KEY_PATH")"
if [ -e "$KEY_PATH" ]; then
  echo "已存在私钥：$KEY_PATH"
  echo "不会覆盖。若要重新生成，先自行移走该文件。"
else
  echo "正在调用 tauri signer generate …"
  npx --yes tauri signer generate -w "$KEY_PATH"
fi

PUB_PATH="${KEY_PATH}.pub"
if [ -f "$PUB_PATH" ]; then
  echo
  echo "公钥（贴进 tauri.conf.json plugins.updater.pubkey）："
  echo "----------------------------------------"
  cat "$PUB_PATH"
  echo "----------------------------------------"
fi

echo
echo "私钥路径：$KEY_PATH"
echo "写入 Secret 前可预览（不要贴到 Issue / PR）："
echo "  cat $KEY_PATH"
print_steps
