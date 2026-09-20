use serde::Serialize;

use crate::activity_cmd::{categorize_foreground, get_activity_snapshot};

#[cfg(windows)]
const SAMPLE_W: u32 = 160;
#[cfg(windows)]
const SAMPLE_H: u32 = 90;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PixelStats {
    pub width: u32,
    pub height: u32,
    pub mean_luma: f64,
    pub dark_ratio: f64,
    pub bright_ratio: f64,
    pub edge_score: f64,
    pub color_variance: f64,
    pub chroma_mean: f64,
    pub captured: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenAnalysis {
    pub title: String,
    pub process: String,
    pub category: String,
    pub stats: PixelStats,
}

pub fn empty_stats() -> PixelStats {
    PixelStats {
        width: 0,
        height: 0,
        mean_luma: 0.0,
        dark_ratio: 0.0,
        bright_ratio: 0.0,
        edge_score: 0.0,
        color_variance: 0.0,
        chroma_mean: 0.0,
        captured: false,
    }
}

/// Downscaled BGRA (bottom-up or top-down) → local-only heuristics. Never persisted.
pub fn stats_from_bgra(width: u32, height: u32, bgra: &[u8]) -> PixelStats {
    let needed = (width as usize)
        .saturating_mul(height as usize)
        .saturating_mul(4);
    if width == 0 || height == 0 || bgra.len() < needed {
        return empty_stats();
    }
    let n = (width * height) as usize;
    let mut lumas = Vec::with_capacity(n);
    let mut luma_sum = 0.0f64;
    let mut luma_sq = 0.0f64;
    let mut chroma_sum = 0.0f64;
    let mut dark = 0u32;
    let mut bright = 0u32;
    for pixel in bgra[..needed].chunks_exact(4) {
        let blue = pixel[0] as f32 / 255.0;
        let green = pixel[1] as f32 / 255.0;
        let red = pixel[2] as f32 / 255.0;
        let luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        lumas.push(luma);
        luma_sum += f64::from(luma);
        luma_sq += f64::from(luma * luma);
        if luma < 0.22 {
            dark += 1;
        }
        if luma > 0.78 {
            bright += 1;
        }
        let max_c = red.max(green).max(blue);
        let min_c = red.min(green).min(blue);
        chroma_sum += f64::from(max_c - min_c);
    }
    let mut edges = 0u32;
    let mut edge_denom = 0u32;
    for y in 0..height {
        for x in 0..width {
            let i = (y * width + x) as usize;
            if x + 1 < width {
                edge_denom += 1;
                if (lumas[i] - lumas[i + 1]).abs() > 0.12 {
                    edges += 1;
                }
            }
            if y + 1 < height {
                edge_denom += 1;
                if (lumas[i] - lumas[i + width as usize]).abs() > 0.12 {
                    edges += 1;
                }
            }
        }
    }
    let mean = luma_sum / n as f64;
    let variance = (luma_sq / n as f64 - mean * mean).max(0.0);
    PixelStats {
        width,
        height,
        mean_luma: mean,
        dark_ratio: f64::from(dark) / n as f64,
        bright_ratio: f64::from(bright) / n as f64,
        edge_score: if edge_denom == 0 {
            0.0
        } else {
            f64::from(edges) / f64::from(edge_denom)
        },
        color_variance: variance.sqrt().min(1.0),
        chroma_mean: chroma_sum / n as f64,
        captured: true,
    }
}

#[cfg(windows)]
mod capture {
    use super::{empty_stats, stats_from_bgra, PixelStats, SAMPLE_H, SAMPLE_W};

    type Handle = *mut core::ffi::c_void;

    #[repr(C)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    struct BitmapInfoHeader {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetForegroundWindow() -> Handle;
        fn GetClientRect(hwnd: Handle, rect: *mut Rect) -> i32;
        fn GetDC(hwnd: Handle) -> Handle;
        fn ReleaseDC(hwnd: Handle, hdc: Handle) -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(hdc: Handle) -> Handle;
        fn CreateCompatibleBitmap(hdc: Handle, cx: i32, cy: i32) -> Handle;
        fn SelectObject(hdc: Handle, obj: Handle) -> Handle;
        fn StretchBlt(
            hdc: Handle,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            src: Handle,
            x1: i32,
            y1: i32,
            cx1: i32,
            cy1: i32,
            rop: u32,
        ) -> i32;
        fn GetDIBits(
            hdc: Handle,
            bmp: Handle,
            start: u32,
            lines: u32,
            bits: *mut u8,
            info: *mut BitmapInfoHeader,
            usage: u32,
        ) -> i32;
        fn DeleteObject(obj: Handle) -> i32;
        fn DeleteDC(hdc: Handle) -> i32;
    }

    const SRCCOPY: u32 = 0x00CC0020;
    const BI_RGB: u32 = 0;

    pub fn capture_foreground_stats() -> PixelStats {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return empty_stats();
            }
            let mut rect = Rect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            if GetClientRect(hwnd, &mut rect) == 0 {
                return empty_stats();
            }
            let src_w = (rect.right - rect.left).max(1);
            let src_h = (rect.bottom - rect.top).max(1);
            let dst_w = SAMPLE_W as i32;
            let dst_h = SAMPLE_H as i32;
            let hdc = GetDC(hwnd);
            if hdc.is_null() {
                return empty_stats();
            }
            let mem = CreateCompatibleDC(hdc);
            let bmp = CreateCompatibleBitmap(hdc, dst_w, dst_h);
            if mem.is_null() || bmp.is_null() {
                if !bmp.is_null() {
                    DeleteObject(bmp);
                }
                if !mem.is_null() {
                    DeleteDC(mem);
                }
                ReleaseDC(hwnd, hdc);
                return empty_stats();
            }
            let previous = SelectObject(mem, bmp);
            let copied = StretchBlt(mem, 0, 0, dst_w, dst_h, hdc, 0, 0, src_w, src_h, SRCCOPY);
            let mut header = BitmapInfoHeader {
                bi_size: std::mem::size_of::<BitmapInfoHeader>() as u32,
                bi_width: dst_w,
                bi_height: -dst_h,
                bi_planes: 1,
                bi_bit_count: 32,
                bi_compression: BI_RGB,
                bi_size_image: 0,
                bi_x_pels_per_meter: 0,
                bi_y_pels_per_meter: 0,
                bi_clr_used: 0,
                bi_clr_important: 0,
            };
            let mut buf = vec![0u8; (SAMPLE_W * SAMPLE_H * 4) as usize];
            let ok = if copied != 0 {
                GetDIBits(mem, bmp, 0, SAMPLE_H, buf.as_mut_ptr(), &mut header, 0)
            } else {
                0
            };
            SelectObject(mem, previous);
            DeleteObject(bmp);
            DeleteDC(mem);
            ReleaseDC(hwnd, hdc);
            if ok == 0 {
                return empty_stats();
            }
            stats_from_bgra(SAMPLE_W, SAMPLE_H, &buf)
        }
    }
}

#[cfg(not(windows))]
mod capture {
    use super::{empty_stats, PixelStats};

    pub fn capture_foreground_stats() -> PixelStats {
        empty_stats()
    }
}

#[tauri::command]
pub fn analyze_screen_local(include_screenshot: Option<bool>) -> ScreenAnalysis {
    let snap = get_activity_snapshot(Some(true));
    let (title, process, category) = match snap.foreground {
        Some(info) => (info.title, info.process, info.category),
        None => {
            let title = String::new();
            let process = String::new();
            let category = categorize_foreground(&process, &title).to_string();
            (title, process, category)
        }
    };
    let stats = if include_screenshot.unwrap_or(false) {
        capture::capture_foreground_stats()
    } else {
        empty_stats()
    };
    ScreenAnalysis {
        title,
        process,
        category,
        stats,
    }
}
