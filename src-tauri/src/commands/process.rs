use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn process_textures(app: AppHandle, config: Value) -> Result<Value, String> {
    crate::sidecar::call(&app, "process_textures", config)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn cancel_processing(app: AppHandle) -> Result<Value, String> {
    crate::sidecar::call(&app, "cancel_processing", serde_json::json!({}))
        .await
        .map_err(|err| err.to_string())
}
