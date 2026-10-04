use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// Re-grant the previously selected music directory after an app restart.
/// Dialog-granted filesystem scopes are in-memory and are not restored automatically.
#[tauri::command]
fn restore_monitor_folder_scope(app: tauri::AppHandle, path: String) -> Result<(), String> {
  let directory = PathBuf::from(path);
  app.fs_scope()
    .allow_directory(&directory, true)
    .map_err(|error| error.to_string())?;
  app.asset_protocol_scope()
    .allow_directory(&directory, true)
    .map_err(|error| error.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 目录选择器：用户授权的路径会自动加入 fs 作用域。
    .plugin(tauri_plugin_dialog::init())
    // 在系统默认浏览器中打开外部链接。
    .plugin(tauri_plugin_opener::init())
    // 文件读取：扫描音乐目录、按需读取音频文件内容。
    // watch 功能用于检测外部元数据变更。
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![restore_monitor_folder_scope])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
