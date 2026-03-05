use serde_json::json;
use tauri::AppHandle;

#[tauri::command]
pub async fn detect_encoders(app: AppHandle) -> Result<serde_json::Value, String> {
    crate::sidecar::call(&app, "detect_encoders", json!({}))
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn get_encoder_info(app: AppHandle) -> Result<serde_json::Value, String> {
    crate::sidecar::call(&app, "get_encoder_info", json!({}))
        .await
        .map_err(|err| err.to_string())
}
