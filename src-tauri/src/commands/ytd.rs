use serde_json::{json, Value};
use tauri::AppHandle;

#[tauri::command]
pub async fn open_ytd(app: AppHandle, paths: Vec<String>) -> Result<Value, String> {
    crate::sidecar::call(&app, "open_ytd", json!({ "paths": paths }))
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn save_ytd(app: AppHandle, config: Value) -> Result<Value, String> {
    crate::sidecar::call(&app, "save_ytd", config)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn get_texture_list(app: AppHandle) -> Result<Value, String> {
    crate::sidecar::call(&app, "get_texture_list", json!({}))
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn export_texture(
    app: AppHandle,
    ytd_id: String,
    texture_id: String,
    optimized: bool,
    format: String,
    output_path: String,
) -> Result<Value, String> {
    crate::sidecar::call(
        &app,
        "export_texture",
        json!({
            "ytdId": ytd_id,
            "textureId": texture_id,
            "optimized": optimized,
            "format": format,
            "outputPath": output_path
        }),
    )
    .await
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn rename_texture(
    app: AppHandle,
    ytd_id: String,
    texture_id: String,
    new_name: String,
) -> Result<Value, String> {
    crate::sidecar::call(
        &app,
        "rename_texture",
        json!({
            "ytdId": ytd_id,
            "textureId": texture_id,
            "newName": new_name
        }),
    )
    .await
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn remove_texture(
    app: AppHandle,
    ytd_id: String,
    texture_id: String,
) -> Result<Value, String> {
    crate::sidecar::call(
        &app,
        "remove_texture",
        json!({
            "ytdId": ytd_id,
            "textureId": texture_id
        }),
    )
    .await
    .map_err(|err| err.to_string())
}
