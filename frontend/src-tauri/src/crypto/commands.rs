use crate::crypto::service::{decrypt, encrypt, encrypt_verifier, is_encrypted_payload, verify_pin};
use crate::crypto::state::CryptoState;
use crate::database::repositories::app_settings::AppSettingsRepository;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize)]
pub struct EncryptionStatus {
    pub enabled: bool,
    pub unlocked: bool,
}

#[derive(Debug, Deserialize)]
pub struct PinRequest {
    pub pin: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePinRequest {
    pub old_pin: String,
    pub new_pin: String,
}

#[tauri::command]
pub async fn crypto_get_status(
    state: State<'_, AppState>,
    crypto: State<'_, CryptoState>,
) -> Result<EncryptionStatus, String> {
    let pool = state.db_manager.pool();
    let enabled = AppSettingsRepository::get_bool(pool, "encryption_enabled")
        .await
        .unwrap_or(false);
    Ok(EncryptionStatus {
        enabled,
        unlocked: crypto.is_unlocked(),
    })
}

#[tauri::command]
pub async fn crypto_setup_encryption(
    state: State<'_, AppState>,
    crypto: State<'_, CryptoState>,
    request: PinRequest,
) -> Result<(), String> {
    if request.pin.len() < 4 {
        return Err("PIN must be at least 4 characters".into());
    }
    let pool = state.db_manager.pool();
    let verifier = encrypt_verifier(&request.pin)?;
    AppSettingsRepository::set(pool, "encryption_verifier", &verifier)
        .await
        .map_err(|e| e.to_string())?;
    AppSettingsRepository::set_bool(pool, "encryption_enabled", true)
        .await
        .map_err(|e| e.to_string())?;
    crypto.unlock(request.pin);
    Ok(())
}

#[tauri::command]
pub async fn crypto_unlock(
    state: State<'_, AppState>,
    crypto: State<'_, CryptoState>,
    request: PinRequest,
) -> Result<(), String> {
    let pool = state.db_manager.pool();
    let enabled = AppSettingsRepository::get_bool(pool, "encryption_enabled")
        .await
        .unwrap_or(false);
    if !enabled {
        crypto.unlock(request.pin);
        return Ok(());
    }
    let verifier = AppSettingsRepository::get(pool, "encryption_verifier")
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Encryption not configured".to_string())?;
    if !verify_pin(&request.pin, &verifier) {
        return Err("Invalid PIN".into());
    }
    crypto.unlock(request.pin);
    Ok(())
}

#[tauri::command]
pub fn crypto_lock(crypto: State<'_, CryptoState>) -> Result<(), String> {
    crypto.lock();
    Ok(())
}

#[tauri::command]
pub async fn crypto_change_pin(
    state: State<'_, AppState>,
    crypto: State<'_, CryptoState>,
    request: ChangePinRequest,
) -> Result<(), String> {
    if request.new_pin.len() < 4 {
        return Err("New PIN must be at least 4 characters".into());
    }
    let pool = state.db_manager.pool();
    let verifier = AppSettingsRepository::get(pool, "encryption_verifier")
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Encryption not configured".to_string())?;
    if !verify_pin(&request.old_pin, &verifier) {
        return Err("Invalid current PIN".into());
    }
    let new_verifier = encrypt_verifier(&request.new_pin)?;
    AppSettingsRepository::set(pool, "encryption_verifier", &new_verifier)
        .await
        .map_err(|e| e.to_string())?;
    crypto.unlock(request.new_pin);
    Ok(())
}

#[tauri::command]
pub fn crypto_encrypt_field(
    crypto: State<'_, CryptoState>,
    plaintext: String,
) -> Result<String, String> {
    crypto.with_pin(|pin| encrypt(&plaintext, pin))
}

#[tauri::command]
pub fn crypto_decrypt_field(
    crypto: State<'_, CryptoState>,
    ciphertext: String,
) -> Result<String, String> {
    if !is_encrypted_payload(&ciphertext) {
        return Ok(ciphertext);
    }
    crypto.with_pin(|pin| decrypt(&ciphertext, pin))
}
