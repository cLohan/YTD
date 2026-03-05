#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;

use commands::encoder::{detect_encoders, get_encoder_info};
use commands::preview::get_texture_preview;
use commands::process::{cancel_processing, process_textures};
use commands::ytd::{export_texture, get_texture_list, open_ytd, remove_texture, rename_texture, save_ytd};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = window.emit(
                    "process-log",
                    serde_json::json!({
                        "level": "INFO",
                        "message": "Encerrando sidecar..."
                    }),
                );
                crate::sidecar::shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_ytd,
            save_ytd,
            export_texture,
            rename_texture,
            remove_texture,
            get_texture_list,
            process_textures,
            cancel_processing,
            get_texture_preview,
            detect_encoders,
            get_encoder_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
