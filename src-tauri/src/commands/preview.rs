use serde_json::json;
use tauri::AppHandle;

#[tauri::command]
pub async fn get_texture_preview(
    app: AppHandle,
    ytd_id: String,
    texture_id: String,
    optimized: bool,
) -> Result<String, String> {
    let value = crate::sidecar::call(
        &app,
        "get_preview",
        json!({
            "ytdId": ytd_id,
            "textureId": texture_id,
            "optimized": optimized
        }),
    )
    .await
    .map_err(|err| err.to_string())?;

    value
        .get("preview")
        .and_then(|item| item.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "Preview inválido retornado pelo sidecar".to_string())
}
