#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 目录选择器：用户授权的路径会自动加入 fs 作用域。
    .plugin(tauri_plugin_dialog::init())
    // 文件读取：扫描音乐目录、按需读取音频文件内容。
    // watch 功能用于检测外部元数据变更。
    .plugin(tauri_plugin_fs::init())
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
