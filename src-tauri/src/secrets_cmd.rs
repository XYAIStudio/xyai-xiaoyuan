use std::{collections::HashMap, fs, path::Path, sync::Mutex};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::config_cmd;

#[cfg(not(debug_assertions))]
use keyring::{Entry, Error};

#[cfg(not(debug_assertions))]
const KEYRING_SERVICE: &str = "com.xyai.xiaoyuan";
const DEV_SECRETS_FILE: &str = "dev-secrets.json";
static SECRETS_WRITE_LOCK: Mutex<()> = Mutex::new(());

const SECRET_KEYS: &[&str] = &[
    "password",
    "access_token",
    "freeos_password",
    "freeos_token",
    "openxyos_password",
    "openxyos_token",
    "grokbot_token",
    "studio_token",
];

pub fn validate_secret_key(key: &str) -> Result<(), String> {
    if SECRET_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(format!("unsupported secret key: {key}"))
    }
}

pub fn secret_account(username: &str, key: &str) -> Result<String, String> {
    validate_secret_key(key)?;
    let scope = if username.trim().is_empty() {
        "default"
    } else {
        username.trim()
    };
    Ok(format!("{scope}:{key}"))
}

pub fn load_secrets_file(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let json = fs::read_to_string(path)
        .map_err(|error| format!("failed to read secrets {}: {error}", path.display()))?;
    serde_json::from_str(&json)
        .map_err(|error| format!("failed to parse secrets {}: {error}", path.display()))
}

pub fn save_secrets_file(path: &Path, secrets: &HashMap<String, String>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "failed to create secrets directory {}: {error}",
                parent.display()
            )
        })?;
    }
    let json = serde_json::to_string_pretty(secrets)
        .map_err(|error| format!("failed to serialize secrets: {error}"))?;
    fs::write(path, json)
        .map_err(|error| format!("failed to write secrets {}: {error}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub fn get_secret_from_file(path: &Path, account: &str) -> Result<Option<String>, String> {
    Ok(load_secrets_file(path)?.get(account).cloned())
}

pub fn set_secret_in_file(path: &Path, account: &str, value: &str) -> Result<(), String> {
    let _guard = SECRETS_WRITE_LOCK
        .lock()
        .map_err(|_| "secrets write lock is poisoned".to_string())?;
    let mut secrets = load_secrets_file(path)?;
    secrets.insert(account.to_string(), value.to_string());
    save_secrets_file(path, &secrets)
}

pub fn delete_secret_from_file(path: &Path, account: &str) -> Result<(), String> {
    let _guard = SECRETS_WRITE_LOCK
        .lock()
        .map_err(|_| "secrets write lock is poisoned".to_string())?;
    let mut secrets = load_secrets_file(path)?;
    secrets.remove(account);
    save_secrets_file(path, &secrets)
}

fn scope_username(app: &AppHandle) -> String {
    config_cmd::load_config(app.clone())
        .map(|cfg| match cfg.provider_id.as_str() {
            "openxyos" => {
                if cfg.openxyos.email.is_empty() {
                    "openxyos".into()
                } else {
                    cfg.openxyos.email
                }
            }
            "grokbot" => "grokbot".into(),
            "xyai-studio" => "studio".into(),
            _ => {
                if cfg.freeos.username.is_empty() {
                    "default".into()
                } else {
                    cfg.freeos.username
                }
            }
        })
        .unwrap_or_else(|_| "default".into())
}

#[cfg(debug_assertions)]
fn secrets_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(DEV_SECRETS_FILE))
        .map_err(|error| format!("failed to resolve app config directory: {error}"))
}

#[tauri::command]
pub fn get_secret(app: AppHandle, key: String) -> Result<Option<String>, String> {
    validate_secret_key(&key)?;
    let username = scope_username(&app);
    let account = secret_account(&username, &key)?;
    #[cfg(debug_assertions)]
    {
        return get_secret_from_file(&secrets_path(&app)?, &account);
    }
    #[cfg(not(debug_assertions))]
    match Entry::new(KEYRING_SERVICE, &account).and_then(|entry| entry.get_password()) {
        Ok(value) => Ok(Some(value)),
        Err(Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("failed to read secret: {error}")),
    }
}

#[tauri::command]
pub fn set_secret(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let username = scope_username(&app);
    let account = secret_account(&username, &key)?;
    #[cfg(debug_assertions)]
    {
        return set_secret_in_file(&secrets_path(&app)?, &account, &value);
    }
    #[cfg(not(debug_assertions))]
    Entry::new(KEYRING_SERVICE, &account)
        .and_then(|entry| entry.set_password(&value))
        .map_err(|error| format!("failed to store secret: {error}"))
}

#[tauri::command]
pub fn delete_secret(app: AppHandle, key: String) -> Result<(), String> {
    let username = scope_username(&app);
    let account = secret_account(&username, &key)?;
    #[cfg(debug_assertions)]
    {
        return delete_secret_from_file(&secrets_path(&app)?, &account);
    }
    #[cfg(not(debug_assertions))]
    match Entry::new(KEYRING_SERVICE, &account).and_then(|entry| entry.delete_credential()) {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("failed to delete secret: {error}")),
    }
}

#[derive(Debug, Deserialize)]
struct GatewayFile {
    port: Option<u16>,
    scheme: Option<String>,
    host: Option<String>,
    token: Option<String>,
}

pub fn gateway_file_to_url_and_token(raw: &str) -> Result<(String, Option<String>), String> {
    let parsed: GatewayFile =
        serde_json::from_str(raw).map_err(|error| format!("gateway.json 解析失败: {error}"))?;
    let mut host = parsed.host.unwrap_or_else(|| "127.0.0.1".into());
    if host == "0.0.0.0" || host == "::" {
        host = "127.0.0.1".into();
    }
    let scheme = parsed.scheme.unwrap_or_else(|| "http".into());
    let port = parsed.port.unwrap_or(1340);
    let base_url = format!("{scheme}://{host}:{port}");
    let token = parsed.token.filter(|value| !value.is_empty());
    Ok((base_url, token))
}

#[tauri::command]
pub fn import_gateway_json(app: AppHandle, path: String) -> Result<serde_json::Value, String> {
    let raw = fs::read_to_string(&path).map_err(|error| format!("无法读取 {path}: {error}"))?;
    let (base_url, token) = gateway_file_to_url_and_token(&raw)?;
    let has_token = token.is_some();
    if let Some(token) = token {
        set_secret(app.clone(), "grokbot_token".into(), token)?;
    }
    let mut cfg = config_cmd::load_config(app.clone())?;
    cfg.grokbot.base_url = base_url.clone();
    cfg.grokbot.gateway_json_path = path;
    config_cmd::save_config(app, cfg)?;
    Ok(serde_json::json!({
        "baseUrl": base_url,
        "hasToken": has_token
    }))
}
