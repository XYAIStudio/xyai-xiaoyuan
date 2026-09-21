use std::fs;

use serde_json::json;
use xyai_xiaoyuan_lib::activity_cmd::{categorize_foreground, source_from_cursor};
use xyai_xiaoyuan_lib::config_cmd::{
    self, home_url_for, normalize_provider_id, select_mascot, supported_poses, AppConfig,
};
use xyai_xiaoyuan_lib::screen_cmd::stats_from_bgra;
use xyai_xiaoyuan_lib::secrets_cmd::{
    gateway_file_to_url_and_token, secret_account, validate_secret_key,
};
use xyai_xiaoyuan_lib::window_cmd::{chat_position, clamp_pet_position, is_http_url};

#[test]
fn sixteen_official_poses_are_selectable() {
    let poses = supported_poses();
    assert_eq!(poses.len(), 16);
    let expected = [
        "wave",
        "thumbs",
        "hearts",
        "idea",
        "think",
        "run",
        "celebrate",
        "explore",
        "magic",
        "garden",
        "music",
        "paint",
        "party",
        "hug",
        "hero",
        "night",
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
    for id in [
        "freeos",
        "openxyos",
        "xyai-studio",
        "grokbot",
        "future-xyai-app",
    ] {
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
    assert!(!loaded.lock_pose);
    assert!(loaded.activity_aware);
    assert!(loaded.companion_bubbles);
    assert!(!loaded.sound_enabled);
    assert!(loaded.sfx_enabled);
    assert_eq!(loaded.idle_threshold_sec, 50);
    assert!(!loaded.foreground_hints);
    assert!(!loaded.screen_understanding);
    assert!(!loaded.allow_screenshot_analysis);

    let patched = config_cmd::patch_at_path(
        &path,
        json!({
            "providerId": "openxyos",
            "petSize": 160,
            "mascotId": "hero",
            "lockPose": true,
            "activityAware": false,
            "soundEnabled": true,
            "soundVolume": 25,
            "providerOptions": { "future-xyai-app": { "baseUrl": "http://127.0.0.1:9999" } }
        }),
    )
    .unwrap();
    assert_eq!(patched.provider_id, "openxyos");
    assert_eq!(patched.pet_size, 160.0);
    assert_eq!(patched.mascot_id, "hero");
    assert!(patched.lock_pose);
    assert!(!patched.activity_aware);
    assert!(patched.sound_enabled);
    assert_eq!(patched.sound_volume, 25);
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
    let (x, y) = chat_position(500, 100, 180, 180, 420, 520, 0, 0, 1280, 800);
    assert_eq!(x, 500 - 420 - 8);
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

#[test]
fn activity_source_and_foreground_categories() {
    assert_eq!(source_from_cursor(200, true), "mouse");
    assert_eq!(source_from_cursor(200, false), "keyboard");
    assert_eq!(source_from_cursor(3_000, true), "unknown");
    assert_eq!(categorize_foreground("Code.exe", "main.rs"), "ide");
    assert_eq!(categorize_foreground("chrome", "Docs"), "browser");
    assert_eq!(categorize_foreground("Zoom.exe", "Standup"), "meeting");
    assert_eq!(categorize_foreground("Spotify.exe", ""), "media");
    assert_eq!(categorize_foreground("notepad", "notes"), "other");
}

#[test]
fn local_screenshot_stats_stay_on_device() {
    let dark = vec![18u8, 20, 16, 255].repeat(160 * 90);
    let dark_stats = stats_from_bgra(160, 90, &dark);
    assert!(dark_stats.captured);
    assert!(dark_stats.dark_ratio > 0.9);
    assert!(dark_stats.edge_score < 0.05);

    let mut checker = Vec::with_capacity(8 * 8 * 4);
    for y in 0..8 {
        for x in 0..8 {
            let on = ((x + y) % 2) == 0;
            if on {
                checker.extend_from_slice(&[240u8, 240, 240, 255]);
            } else {
                checker.extend_from_slice(&[12u8, 12, 12, 255]);
            }
        }
    }
    let busy = stats_from_bgra(8, 8, &checker);
    assert!(busy.captured);
    assert!(busy.edge_score > 0.5);
}

#[test]
fn pet_stays_inside_work_area_and_snaps() {
    let (x, y) = clamp_pet_position(-40, 10, 180, 180, 0, 0, 1280, 800, true);
    assert_eq!(x, 0);
    assert!(y >= 0);
    let (x, _) = clamp_pet_position(1260, 10, 180, 180, 0, 0, 1280, 800, true);
    assert_eq!(x, 1280 - 180);
}
