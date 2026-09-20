use std::fs;

use serde_json::json;
use xyai_xiaoyuan_lib::config_cmd::{
    self, AppConfig, home_url_for, normalize_provider_id, select_mascot, supported_poses,
};
use xyai_xiaoyuan_lib::secrets_cmd::{
    gateway_file_to_url_and_token, secret_account, validate_secret_key,
};
use xyai_xiaoyuan_lib::window_cmd::{chat_position, is_http_url};

#[test]
fn sixteen_official_poses_are_selectable() {
    let poses = supported_poses();
    assert_eq!(poses.len(), 16);
    let expected = [
        "wave", "thumbs", "hearts", "idea", "think", "run", "celebrate", "explore", "magic",
        "garden", "music", "paint", "party", "hug", "hero", "night",
    ];
    assert_eq!(poses, expected);
    let mut cfg = AppConfig::default();
    for pose in poses {
        select_mascot(&mut cfg, pose).expect("pose should be accepted");
        assert_eq!(cfg.mascot_id, *pose);
    }
    assert!(select_mascot(&mut cfg, "unknown-pose").is_err());
}

#[test]
fn provider_id_roundtrip_includes_first_party_and_future_backends() {
    for id in ["freeos", "openxyos", "xyai-studio", "grokbot", "future-xyai-app"] {
        let cfg = AppConfig {
            provider_id: normalize_provider_id(id),
            ..AppConfig::default()
        };
        let encoded = serde_json::to_value(&cfg).unwrap();
        assert_eq!(encoded["providerId"], id);
        let decoded: AppConfig = serde_json::from_value(encoded).unwrap();
        assert_eq!(decoded.provider_id, id);
    }
    assert_eq!(normalize_provider_id("  "), "freeos");
}

#[test]
fn config_patch_and_defaults() {
    let dir = std::env::temp_dir().join(format!("xyai-xiaoyuan-cfg-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("config.json");
    let loaded = config_cmd::load_from_path(&path).unwrap();
    assert_eq!(loaded.provider_id, "freeos");
    assert_eq!(loaded.freeos.base_url, "http://127.0.0.1:8088");
    assert_eq!(loaded.openxyos.base_url, "http://127.0.0.1:3000");
    assert_eq!(loaded.grokbot.base_url, "http://127.0.0.1:1340");
    assert_eq!(loaded.mascot_id, "wave");

    let patched = config_cmd::patch_at_path(
        &path,
        json!({
            "providerId": "openxyos",
            "petSize": 160,
            "mascotId": "hero",
            "providerOptions": { "future-xyai-app": { "baseUrl": "http://127.0.0.1:9999" } }
        }),
    )
    .unwrap();
    assert_eq!(patched.provider_id, "openxyos");
    assert_eq!(patched.pet_size, 160.0);
    assert_eq!(patched.mascot_id, "hero");
    assert_eq!(
        patched.provider_options["future-xyai-app"]["baseUrl"],
        "http://127.0.0.1:9999"
    );
    let err = config_cmd::patch_at_path(&path, json!({ "petSize": 10 })).unwrap_err();
    assert!(err.contains("petSize"));
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn secrets_keys_and_gateway_import_parsing() {
    for key in [
        "freeos_password",
        "freeos_token",
        "openxyos_password",
        "openxyos_token",
        "grokbot_token",
        "studio_token",
    ] {
        validate_secret_key(key).unwrap();
    }
    assert!(validate_secret_key("not-a-key").is_err());
    assert_eq!(
        secret_account("alice", "freeos_token").unwrap(),
        "alice:freeos_token"
    );

    let (url, token) = gateway_file_to_url_and_token(
        r#"{"host":"0.0.0.0","port":1340,"scheme":"http","token":"abc"}"#,
    )
    .unwrap();
    assert_eq!(url, "http://127.0.0.1:1340");
    assert_eq!(token.as_deref(), Some("abc"));

    let (url, token) = gateway_file_to_url_and_token(r#"{"host":"::","port":99}"#).unwrap();
    assert_eq!(url, "http://127.0.0.1:99");
    assert!(token.is_none());
}

#[test]
fn chat_geometry_prefers_left_then_clamps() {
    let (x, y) = chat_position(400, 100, 180, 180, 420, 520, 0, 0, 1280, 800);
    assert_eq!(x, 400 - 420 - 8);
    assert!(y >= 0);
    let (x, _) = chat_position(10, 10, 180, 180, 420, 520, 0, 0, 800, 600);
    assert!(x >= 10 + 180);
    assert!(is_http_url("http://127.0.0.1:8088"));
    assert!(is_http_url("https://example.com"));
    assert!(!is_http_url("file:///tmp"));
}

#[test]
fn home_url_follows_active_provider() {
    let mut cfg = AppConfig::default();
    assert_eq!(home_url_for(&cfg), "http://127.0.0.1:8088");
    cfg.provider_id = "openxyos".into();
    assert_eq!(home_url_for(&cfg), "http://127.0.0.1:3000");
    cfg.provider_id = "grokbot".into();
    assert_eq!(home_url_for(&cfg), "http://127.0.0.1:1340");
    cfg.provider_id = "xyai-studio".into();
    assert_eq!(home_url_for(&cfg), "");
}
