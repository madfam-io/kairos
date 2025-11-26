mod subtitles;

use subtitles::{parse_subtitles, Subtitle};
use std::fs;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Kairos.", name)
}

#[tauri::command]
fn parse_subtitles_cmd(path: &str) -> Result<Vec<Subtitle>, String> {
    parse_subtitles(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_file(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn file_exists(path: &str) -> bool {
    std::path::Path::new(path).exists()
}

#[tauri::command]
fn get_video_metadata(path: &str) -> Result<VideoMetadata, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    Ok(VideoMetadata {
        path: path.to_string(),
        name: file_name,
        size: metadata.len(),
    })
}

#[derive(serde::Serialize)]
struct VideoMetadata {
    path: String,
    name: String,
    size: u64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            parse_subtitles_cmd,
            read_file,
            file_exists,
            get_video_metadata,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
