use std::fs;
use std::path::Path;

/// Recursively emit `cargo:rerun-if-changed` for the directory and every file
/// within it. Per-file emission is required because Cargo's directory-level
/// rerun-if-changed does not reliably detect edits to files inside the dir.
fn rerun_if_dir_changed(dir: &Path) {
    if !dir.exists() {
        return;
    }
    println!("cargo:rerun-if-changed={}", dir.display());
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            rerun_if_dir_changed(&path);
        } else {
            println!("cargo:rerun-if-changed={}", path.display());
        }
    }
}

fn main() {
    // Recompile whenever any embedded default build JSON changes, since those
    // files are pulled in at compile time via include_dir! and editing them
    // does not otherwise change any .rs source.
    rerun_if_dir_changed(Path::new("../src/data/builds"));

    tauri_build::build()
}
