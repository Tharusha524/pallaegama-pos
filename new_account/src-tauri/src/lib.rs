use tauri_plugin_sql::{Migration, MigrationKind};
use base64::{Engine as _, engine::general_purpose};

/// Converts a base64-encoded PNG (rendered by the React canvas at 576px wide)
/// into ESC/POS raster bytes and sends them directly to the named Windows
/// printer using the spooler RAW data type — bypassing all browser print
/// dialogs and page-scaling issues.
#[tauri::command]
fn print_receipt_escpos(
    printer_name: String,
    image_base64: String,
    auto_cut: bool,
) -> Result<(), String> {
    // 1. Decode base64 → PNG bytes
    let png_bytes = general_purpose::STANDARD
        .decode(&image_base64)
        .map_err(|e| format!("Base64 decode error: {e}"))?;

    // 2. Decode PNG → grayscale pixels
    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| format!("Image decode error: {e}"))?
        .to_luma8();

    let width = img.width();
    let height = img.height();
    let bytes_per_line = ((width + 7) / 8) as usize;

    // 3. Build ESC/POS command stream
    let mut esc: Vec<u8> = Vec::new();

    // Initialize printer
    esc.extend_from_slice(b"\x1B\x40");

    // Send image in strips of 255 lines to avoid overflowing the printer buffer
    let strip_height: u32 = 255;
    let xl = (bytes_per_line & 0xFF) as u8;
    let xh = ((bytes_per_line >> 8) & 0xFF) as u8;
    let mut y_start = 0u32;
    while y_start < height {
        let y_end = (y_start + strip_height).min(height);
        let strip_lines = y_end - y_start;
        let yl = (strip_lines & 0xFF) as u8;
        let yh = ((strip_lines >> 8) & 0xFF) as u8;
        // GS v 0 — raster bit image header for this strip
        esc.extend_from_slice(&[0x1D, 0x76, 0x30, 0x00, xl, xh, yl, yh]);
        // Raster data: 1 bit per pixel, dark pixel = 1, MSB first
        for y in y_start..y_end {
            let mut byte_val: u8 = 0;
            let mut bit = 0u32;
            for x in 0..width {
                let luma = img.get_pixel(x, y).0[0];
                if luma < 180 {
                    byte_val |= 1 << (7 - (bit % 8));
                }
                bit += 1;
                if bit % 8 == 0 {
                    esc.push(byte_val);
                    byte_val = 0;
                }
            }
            if bit % 8 != 0 {
                esc.push(byte_val);
            }
            let written = ((width + 7) / 8) as usize;
            for _ in written..bytes_per_line {
                esc.push(0);
            }
        }
        y_start = y_end;
    }

    // Feed paper before cut
    esc.extend_from_slice(b"\x1B\x64\x04"); // ESC d 4

    // Cut paper
    if auto_cut {
        esc.extend_from_slice(b"\x1D\x56\x41\x03"); // GS V A 3 (partial cut)
    }

    // 4. Send raw ESC/POS bytes to the Windows printer
    #[cfg(target_os = "windows")]
    {
        send_raw_to_windows_printer(&printer_name, &esc)?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = printer_name;
        return Err("ESC/POS printing is only supported on Windows".to_string());
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn send_raw_to_windows_printer(printer_name: &str, data: &[u8]) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use std::ffi::OsStr;
    use winapi::um::winspool::{
        OpenPrinterW, StartDocPrinterW, StartPagePrinter,
        WritePrinter, EndPagePrinter, EndDocPrinter, ClosePrinter,
        DOC_INFO_1W,
    };
    use winapi::um::winnt::HANDLE;
    use winapi::shared::minwindef::DWORD;
    use std::ptr;

    let wide = |s: &str| -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    };

    let printer_wide = wide(printer_name);
    let doc_name_wide = wide("Receipt");
    let datatype_wide = wide("RAW");

    unsafe {
        let mut handle: HANDLE = ptr::null_mut();

        if OpenPrinterW(
            printer_wide.as_ptr() as *mut _,
            &mut handle,
            ptr::null_mut(),
        ) == 0 {
            return Err(format!(
                "Cannot open printer '{}'. Make sure it is installed and powered on.",
                printer_name
            ));
        }

        let mut doc_info = DOC_INFO_1W {
            pDocName: doc_name_wide.as_ptr() as *mut _,
            pOutputFile: ptr::null_mut(),
            pDatatype: datatype_wide.as_ptr() as *mut _,
        };

        if StartDocPrinterW(handle, 1, &mut doc_info as *mut _ as *mut u8) == 0 {
            ClosePrinter(handle);
            return Err("StartDocPrinter failed. Check printer status.".to_string());
        }

        if StartPagePrinter(handle) == 0 {
            EndDocPrinter(handle);
            ClosePrinter(handle);
            return Err("StartPagePrinter failed.".to_string());
        }

        let mut written: DWORD = 0;
        WritePrinter(
            handle,
            data.as_ptr() as *mut _,
            data.len() as DWORD,
            &mut written,
        );

        EndPagePrinter(handle);
        EndDocPrinter(handle);
        ClosePrinter(handle);
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Offline POS local database: products/customers are synced down from
  // Laravel for lookup while offline; pending_sales holds sales made while
  // offline, tagged with a UUID + terminal/cashier id so they can be synced
  // back up exactly once, from any of several POS terminals.
  let migrations = vec![Migration {
    version: 1,
    description: "create offline pos tables",
    sql: r#"
      CREATE TABLE IF NOT EXISTS products (
        stock_id TEXT PRIMARY KEY,
        barcode TEXT,
        description TEXT NOT NULL,
        unit_price REAL NOT NULL,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

      CREATE TABLE IF NOT EXISTS customers (
        debtor_no TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        branch_code TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS pending_sales (
        uuid TEXT PRIMARY KEY,
        terminal_id TEXT NOT NULL,
        cashier_id TEXT NOT NULL,
        customer_id TEXT,
        payload TEXT NOT NULL,
        total REAL NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        sync_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pending_sales_synced ON pending_sales(synced_at);
    "#,
    kind: MigrationKind::Up,
  }, Migration {
    version: 2,
    // Cached logged-in users, synced down whenever online — lets the app
    // recognise an already-authenticated cashier and restore their session
    // (with permissions) when opened with no connection at all, instead of
    // relying on browser localStorage.
    description: "create offline users table",
    sql: r#"
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        user_json TEXT NOT NULL,
        permission_ids TEXT NOT NULL,
        edit_permission_ids TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    "#,
    kind: MigrationKind::Up,
  }, Migration {
    version: 3,
    // Small reference lists checkout depends on to even submit a sale
    // (branches, shipping companies, bank accounts) — none of these change
    // often, so one JSON blob per list, synced down the same way as
    // products/customers, is enough to unblock checkout offline.
    description: "create offline reference_data table",
    sql: r#"
      CREATE TABLE IF NOT EXISTS reference_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    "#,
    kind: MigrationKind::Up,
  }, Migration {
    version: 4,
    // Damage entries logged while offline — queued the same way as
    // pending_sales, synced up to the real recordStockDamage endpoint once
    // back online. Viewing the Stock/Stock Damage pages offline reuses the
    // reference_data blobs above (stock_list, stock_damages), not new
    // tables — they're read-only snapshots, this is the one write queue.
    description: "create offline stock damage queue",
    sql: r#"
      CREATE TABLE IF NOT EXISTS pending_stock_damages (
        uuid TEXT PRIMARY KEY,
        terminal_id TEXT NOT NULL,
        stock_id TEXT NOT NULL,
        description TEXT,
        quantity REAL NOT NULL,
        reason TEXT,
        damage_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        sync_error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pending_stock_damages_synced ON pending_stock_damages(synced_at);
    "#,
    kind: MigrationKind::Up,
  }, Migration {
    version: 5,
    // The customers cache only ever stored debtor_no/name/branch_code —
    // fine for the customer picker, but checkout also needs sales_type
    // (to pick the right price list) and other fields nothing here
    // anticipated. Store the whole customer object instead, the same way
    // users' user_json already does, so no future field goes missing.
    description: "store full customer object in offline cache",
    sql: r#"
      ALTER TABLE customers ADD COLUMN customer_json TEXT NOT NULL DEFAULT '{}';
    "#,
    kind: MigrationKind::Up,
  }];

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![print_receipt_escpos])
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:pos.db", migrations)
        .build(),
    )
    // Auto-update: checks the endpoint configured in tauri.conf.json,
    // downloads and installs a newer signed build, then plugin-process
    // restarts the app to apply it — see src/offline/updater.ts for the
    // check/install call from the frontend.
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
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
