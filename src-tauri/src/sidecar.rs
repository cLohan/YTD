use anyhow::{anyhow, Context, Result};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

static CLIENT: OnceCell<Arc<SidecarClient>> = OnceCell::new();

#[derive(Debug, Serialize)]
struct RpcRequest {
    id: String,
    method: String,
    params: Value,
}

#[derive(Debug, Deserialize)]
struct RpcResponse {
    id: Option<String>,
    result: Option<Value>,
    error: Option<RpcError>,
    event: Option<String>,
    data: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct RpcError {
    code: i32,
    message: String,
}

pub async fn call(app: &AppHandle, method: &str, params: Value) -> Result<Value> {
    let client = get_or_init_client(app)?;
    client.call(method, params)
}

pub fn shutdown() {
    if let Some(client) = CLIENT.get() {
        if let Ok(mut child) = client._child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn get_or_init_client(app: &AppHandle) -> Result<Arc<SidecarClient>> {
    if let Some(existing) = CLIENT.get() {
        existing.set_app_handle(app.clone());
        return Ok(existing.clone());
    }

    let created = Arc::new(SidecarClient::spawn(app.clone())?);
    CLIENT
        .set(created.clone())
        .map_err(|_| anyhow!("Falha ao inicializar cliente sidecar"))?;
    Ok(created)
}

struct SidecarClient {
    stdin: Arc<Mutex<ChildStdin>>,
    pending: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Result<Value, String>>>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    last_stderr: Arc<Mutex<String>>,
    _child: Arc<Mutex<Child>>,
}

impl SidecarClient {
    fn spawn(app: AppHandle) -> Result<Self> {
        let exe = sidecar_executable_path()?;

        let mut command = Command::new(exe);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command
            .spawn()
            .context("Falha ao iniciar sidecar YtdCore")?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("Sidecar sem stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Sidecar sem stdout"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow!("Sidecar sem stderr"))?;

        let pending: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Result<Value, String>>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let app_handle = Arc::new(Mutex::new(Some(app)));
        let last_stderr = Arc::new(Mutex::new(String::new()));

        Self::spawn_reader_thread(stdout, pending.clone(), app_handle.clone());
        Self::spawn_stderr_thread(stderr, app_handle.clone(), last_stderr.clone());

        Ok(Self {
            stdin: Arc::new(Mutex::new(stdin)),
            pending,
            app_handle,
            last_stderr,
            _child: Arc::new(Mutex::new(child)),
        })
    }

    fn set_app_handle(&self, app: AppHandle) {
        if let Ok(mut guard) = self.app_handle.lock() {
            *guard = Some(app);
        }
    }

    fn call(&self, method: &str, params: Value) -> Result<Value> {
        let id = Uuid::new_v4().to_string();
        let request = RpcRequest {
            id: id.clone(),
            method: method.to_string(),
            params,
        };

        let (tx, rx) = std::sync::mpsc::channel::<Result<Value, String>>();

        {
            let mut map = self
                .pending
                .lock()
                .map_err(|_| anyhow!("Falha no lock de requisições pendentes"))?;
            map.insert(id.clone(), tx);
        }

        let payload = serde_json::to_string(&request)?;

        {
            let mut stdin = self
                .stdin
                .lock()
                .map_err(|_| anyhow!("Falha no lock do stdin do sidecar"))?;
            stdin.write_all(payload.as_bytes())?;
            stdin.write_all(b"\n")?;
            stdin.flush()?;
        }

        match rx.recv_timeout(Duration::from_secs(180)) {
            Ok(value) => value.map_err(|message| anyhow!(message)),
            Err(_) => {
                let detail = self
                    .last_stderr
                    .lock()
                    .ok()
                    .map(|s| s.clone())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "sem stderr do sidecar".to_string());
                Err(anyhow!("Sidecar não respondeu. Detalhe: {}", detail))
            }
        }
    }

    fn spawn_reader_thread(
        stdout: ChildStdout,
        pending: Arc<Mutex<HashMap<String, std::sync::mpsc::Sender<Result<Value, String>>>>>,
        app_handle: Arc<Mutex<Option<AppHandle>>>,
    ) {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                let line = match line {
                    Ok(value) => value,
                    Err(_) => continue,
                };

                if line.trim().is_empty() {
                    continue;
                }

                let message = match serde_json::from_str::<RpcResponse>(&line) {
                    Ok(value) => value,
                    Err(_) => continue,
                };

                if let Some(event_name) = message.event.as_deref() {
                    if let Ok(handle_guard) = app_handle.lock() {
                        if let Some(handle) = handle_guard.as_ref() {
                            if event_name == "progress" {
                                let _ = handle.emit("process-progress", message.data.clone().unwrap_or_else(|| json!({})));
                            } else if event_name == "log" {
                                let _ = handle.emit("process-log", message.data.clone().unwrap_or_else(|| json!({
                                    "level": "INFO",
                                    "message": "Evento de log vazio"
                                })));
                            }
                        }
                    }
                    continue;
                }

                let Some(id) = message.id else {
                    continue;
                };

                let sender = {
                    let mut map = match pending.lock() {
                        Ok(value) => value,
                        Err(_) => continue,
                    };
                    map.remove(&id)
                };

                if let Some(tx) = sender {
                    if let Some(err) = message.error {
                        let _ = tx.send(Err(format!("[{}] {}", err.code, err.message)));
                    } else {
                        let _ = tx.send(Ok(message.result.unwrap_or_else(|| json!({}))));
                    }
                }
            }
        });
    }

    fn spawn_stderr_thread(
        stderr: ChildStderr,
        app_handle: Arc<Mutex<Option<AppHandle>>>,
        last_stderr: Arc<Mutex<String>>,
    ) {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                let line = match line {
                    Ok(value) if !value.trim().is_empty() => value,
                    _ => continue,
                };

                if let Ok(mut last) = last_stderr.lock() {
                    *last = line.clone();
                }

                if let Ok(handle_guard) = app_handle.lock() {
                    if let Some(handle) = handle_guard.as_ref() {
                        let _ = handle.emit(
                            "process-log",
                            json!({
                                "level": "ERROR",
                                "message": format!("Sidecar stderr: {}", line)
                            }),
                        );
                    }
                }
            }
        });
    }
}

fn sidecar_executable_path() -> Result<PathBuf> {
    let mut candidates = vec![];
    let binary_names = [
        "YtdCore.exe",
        "YtdCore-x86_64-pc-windows-msvc.exe",
        "YtdCore-aarch64-pc-windows-msvc.exe",
    ];

    if let Ok(current) = std::env::current_exe() {
        if let Some(base) = current.parent() {
            for name in binary_names {
                candidates.push(base.join("sidecars").join("YtdCore").join(name));
                candidates.push(base.join(name));
                candidates.push(base.join("resources").join(name));
                candidates.push(base.join("resources").join("sidecars").join("YtdCore").join(name));
            }
        }

        // Local dev/build layout: <workspace>/target/release/<app>.exe
        // and sidecar publish at <workspace>/src-tauri/sidecars/YtdCore/bin/.../publish.
        for ancestor in current.ancestors() {
            let release_bin = ancestor
                .join("src-tauri")
                .join("sidecars")
                .join("YtdCore")
                .join("bin")
                .join("Release")
                .join("net8.0-windows")
                .join("win-x64");
            let publish = ancestor
                .join("src-tauri")
                .join("sidecars")
                .join("YtdCore")
                .join("bin")
                .join("Release")
                .join("net8.0-windows")
                .join("win-x64")
                .join("publish");
            for name in binary_names {
                candidates.push(release_bin.join(name));
                candidates.push(publish.join(name));
            }
        }
    }

    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let base = PathBuf::from(manifest_dir);
        for name in binary_names {
            candidates.push(
                base.join("sidecars")
                    .join("YtdCore")
                    .join("bin")
                    .join("Release")
                    .join("net8.0-windows")
                    .join("win-x64")
                    .join(name),
            );
            candidates.push(
                base.join("sidecars")
                    .join("YtdCore")
                    .join("bin")
                    .join("Release")
                    .join("net8.0-windows")
                    .join("win-x64")
                    .join("publish")
                    .join(name),
            );
            candidates.push(
                base.join("sidecars")
                    .join("YtdCore")
                    .join("bin")
                    .join("Debug")
                    .join("net8.0-windows")
                    .join(name),
            );
        }
    }

    let mut valid_candidates: Vec<(PathBuf, std::time::SystemTime)> = candidates
        .into_iter()
        .filter(|candidate| candidate.exists() && sidecar_dependencies_available(candidate))
        .filter_map(|candidate| {
            let modified = std::fs::metadata(&candidate)
                .and_then(|m| m.modified())
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            Some((candidate, modified))
        })
        .collect();

    valid_candidates.sort_by(|a, b| b.1.cmp(&a.1));
    if let Some((best, _)) = valid_candidates.into_iter().next() {
        return Ok(best);
    }

    Err(anyhow!(
        "YtdCore.exe não encontrado. Compile o sidecar em src-tauri/sidecars/YtdCore"
    ))
}

fn sidecar_dependencies_available(exe: &PathBuf) -> bool {
    let Some(dir) = exe.parent() else {
        return false;
    };

    let required = [
        "CodeWalker.Core.dll",
        "SharpDX.dll",
        "SharpDX.DXGI.dll",
        "SharpDX.Direct3D11.dll",
        "SharpDX.Mathematics.dll",
    ];

    required.iter().all(|name| dir.join(name).exists())
}
