use serde::Serialize;

#[cfg(windows)]
use std::sync::Mutex;

const IDE_HINTS: &[&str] = &[
    "code",
    "cursor",
    "vscode",
    "devenv",
    "idea",
    "pycharm",
    "webstorm",
    "goland",
    "clion",
    "rustrover",
    "sublime",
    "nvim",
    "vim",
    "emacs",
    "xcode",
    "android studio",
    "zed",
    "windsurf",
    "visual studio",
    "jetbrains",
];

const BROWSER_HINTS: &[&str] = &[
    "chrome", "firefox", "msedge", "edge", "safari", "brave", "opera", "vivaldi", "chromium", "arc",
];

const MEETING_HINTS: &[&str] = &[
    "zoom",
    "teams",
    "webex",
    "meet",
    "discord",
    "slack",
    "tencentmeeting",
    "wemeet",
    "voov",
    "lark",
    "dingtalk",
];

const MEDIA_HINTS: &[&str] = &[
    "spotify",
    "vlc",
    "music",
    "itunes",
    "netflix",
    "youtube",
    "potplayer",
    "mpv",
    "foobar",
    "qqmusic",
    "netease",
];

#[cfg(windows)]
static LAST_CURSOR: Mutex<Option<(i32, i32)>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundInfo {
    pub title: String,
    pub process: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySnapshot {
    pub idle_ms: u64,
    pub source: String,
    pub available: bool,
    pub foreground: Option<ForegroundInfo>,
}

pub fn categorize_foreground(process: &str, title: &str) -> &'static str {
    let blob = format!("{process} {title}").to_lowercase();
    if blob.trim().is_empty() {
        return "unknown";
    }
    if MEETING_HINTS.iter().any(|hint| blob.contains(hint)) {
        return "meeting";
    }
    if IDE_HINTS.iter().any(|hint| blob.contains(hint)) {
        return "ide";
    }
    if BROWSER_HINTS.iter().any(|hint| blob.contains(hint)) {
        return "browser";
    }
    if MEDIA_HINTS.iter().any(|hint| blob.contains(hint)) {
        return "media";
    }
    "other"
}

pub fn source_from_cursor(idle_ms: u64, cursor_moved: bool) -> &'static str {
    if idle_ms >= 1_500 {
        "unknown"
    } else if cursor_moved {
        "mouse"
    } else {
        "keyboard"
    }
}

#[cfg(windows)]
fn note_cursor(x: i32, y: i32) -> bool {
    let Ok(mut guard) = LAST_CURSOR.lock() else {
        return false;
    };
    let moved = match *guard {
        Some((px, py)) => px != x || py != y,
        None => false,
    };
    *guard = Some((x, y));
    moved
}

#[cfg(windows)]
mod platform {
    use super::{
        categorize_foreground, note_cursor, source_from_cursor, ActivitySnapshot, ForegroundInfo,
    };
    use std::path::Path;

    #[repr(C)]
    struct LastInputInfo {
        cb_size: u32,
        dw_time: u32,
    }

    #[repr(C)]
    struct Point {
        x: i32,
        y: i32,
    }

    type Handle = *mut core::ffi::c_void;

    #[link(name = "user32")]
    extern "system" {
        fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
        fn GetCursorPos(lp_point: *mut Point) -> i32;
        fn GetForegroundWindow() -> Handle;
        fn GetWindowTextW(hwnd: Handle, lp_string: *mut u16, n_max_count: i32) -> i32;
        fn GetWindowThreadProcessId(hwnd: Handle, lpdw_process_id: *mut u32) -> u32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetTickCount() -> u32;
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> Handle;
        fn CloseHandle(handle: Handle) -> i32;
        fn QueryFullProcessImageNameW(
            handle: Handle,
            flags: u32,
            name: *mut u16,
            size: *mut u32,
        ) -> i32;
    }

    fn wide_to_string(buf: &[u16], len: usize) -> String {
        String::from_utf16_lossy(&buf[..len.min(buf.len())])
    }

    fn foreground(include: bool) -> Option<ForegroundInfo> {
        if !include {
            return None;
        }
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
            let title = if title_len > 0 {
                wide_to_string(&title_buf, title_len as usize)
            } else {
                String::new()
            };
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            if pid == 0 {
                return Some(ForegroundInfo {
                    category: categorize_foreground("", &title).into(),
                    process: String::new(),
                    title,
                });
            }
            const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            let process = if handle.is_null() {
                String::new()
            } else {
                let mut name = [0u16; 512];
                let mut size = name.len() as u32;
                let ok = QueryFullProcessImageNameW(handle, 0, name.as_mut_ptr(), &mut size);
                CloseHandle(handle);
                if ok != 0 {
                    let full = wide_to_string(&name, size as usize);
                    Path::new(&full)
                        .file_stem()
                        .map(|s| s.to_string_lossy().into_owned())
                        .unwrap_or(full)
                } else {
                    String::new()
                }
            };
            Some(ForegroundInfo {
                category: categorize_foreground(&process, &title).into(),
                process,
                title,
            })
        }
    }

    pub fn snapshot(include_foreground: bool) -> ActivitySnapshot {
        let mut info = LastInputInfo {
            cb_size: std::mem::size_of::<LastInputInfo>() as u32,
            dw_time: 0,
        };
        let idle_ms = unsafe {
            if GetLastInputInfo(&mut info) == 0 {
                return ActivitySnapshot {
                    idle_ms: 0,
                    source: "unavailable".into(),
                    available: false,
                    foreground: None,
                };
            }
            GetTickCount().wrapping_sub(info.dw_time) as u64
        };
        let mut point = Point { x: 0, y: 0 };
        let moved = unsafe {
            if GetCursorPos(&mut point) != 0 {
                note_cursor(point.x, point.y)
            } else {
                false
            }
        };
        ActivitySnapshot {
            idle_ms,
            source: source_from_cursor(idle_ms, moved).into(),
            available: true,
            foreground: foreground(include_foreground),
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{categorize_foreground, ActivitySnapshot};

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state_id: u32, event_type: u32) -> f64;
    }

    const SESSION: u32 = 0;
    const KEY_DOWN: u32 = 10;
    const FLAGS: u32 = 12;
    const MOUSE_MOVED: u32 = 5;
    const LEFT_DOWN: u32 = 1;
    const RIGHT_DOWN: u32 = 3;
    const ANY_INPUT: u32 = u32::MAX;

    fn idle_ms(event: u32) -> f64 {
        unsafe { CGEventSourceSecondsSinceLastEventType(SESSION, event) * 1000.0 }
    }

    pub fn snapshot(include_foreground: bool) -> ActivitySnapshot {
        let any = idle_ms(ANY_INPUT).max(0.0) as u64;
        let key = idle_ms(KEY_DOWN).min(idle_ms(FLAGS)).max(0.0);
        let mouse = idle_ms(MOUSE_MOVED)
            .min(idle_ms(LEFT_DOWN))
            .min(idle_ms(RIGHT_DOWN))
            .max(0.0);
        let source = if any >= 1_500 {
            "unknown"
        } else if key <= mouse {
            "keyboard"
        } else {
            "mouse"
        };
        let _ = include_foreground;
        let _ = categorize_foreground;
        ActivitySnapshot {
            idle_ms: any,
            source: source.into(),
            available: true,
            foreground: None,
        }
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod platform {
    use super::ActivitySnapshot;

    pub fn snapshot(_include_foreground: bool) -> ActivitySnapshot {
        ActivitySnapshot {
            idle_ms: 0,
            source: "unavailable".into(),
            available: false,
            foreground: None,
        }
    }
}

#[tauri::command]
pub fn get_activity_snapshot(include_foreground: Option<bool>) -> ActivitySnapshot {
    platform::snapshot(include_foreground.unwrap_or(false))
}
