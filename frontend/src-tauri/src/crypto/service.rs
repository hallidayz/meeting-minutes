use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;

const MARKER: &[u8] = b"WNS1";
const OLD_SALT: &[u8] = b"a-very-secure-static-salt-for-whisper-notes";
const ITERATIONS: u32 = 100_000;
const SALT_LENGTH: usize = 16;
const IV_LENGTH: usize = 12;

fn derive_key(pin: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(pin.as_bytes(), salt, ITERATIONS, &mut key);
    Ok(key)
}

fn parse_payload(bytes: &[u8]) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>), String> {
    let is_new = bytes.len() >= MARKER.len() && bytes[..MARKER.len()] == *MARKER;
    if is_new {
        let salt_start = MARKER.len();
        let iv_start = salt_start + SALT_LENGTH;
        let content_start = iv_start + IV_LENGTH;
        if bytes.len() < content_start {
            return Err("Invalid encrypted payload".into());
        }
        Ok((
            bytes[salt_start..iv_start].to_vec(),
            bytes[iv_start..content_start].to_vec(),
            bytes[content_start..].to_vec(),
        ))
    } else {
        if bytes.len() < IV_LENGTH {
            return Err("Invalid encrypted payload".into());
        }
        Ok((
            OLD_SALT.to_vec(),
            bytes[..IV_LENGTH].to_vec(),
            bytes[IV_LENGTH..].to_vec(),
        ))
    }
}

pub fn is_encrypted_payload(data: &str) -> bool {
    let Ok(bytes) = BASE64.decode(data) else {
        return false;
    };
    bytes.len() >= MARKER.len() && bytes[..MARKER.len()] == *MARKER
}

pub fn encrypt(plaintext: &str, pin: &str) -> Result<String, String> {
    let mut salt = [0u8; SALT_LENGTH];
    let mut iv = [0u8; IV_LENGTH];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut iv);

    let key = derive_key(pin, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&iv);
    let encrypted = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    let mut packed = Vec::with_capacity(MARKER.len() + SALT_LENGTH + IV_LENGTH + encrypted.len());
    packed.extend_from_slice(MARKER);
    packed.extend_from_slice(&salt);
    packed.extend_from_slice(&iv);
    packed.extend_from_slice(&encrypted);

    Ok(BASE64.encode(packed))
}

pub fn decrypt(ciphertext_b64: &str, pin: &str) -> Result<String, String> {
    let bytes = BASE64
        .decode(ciphertext_b64)
        .map_err(|_| "Invalid PIN or corrupted data.".to_string())?;
    let (salt, iv, content) = parse_payload(&bytes)?;
    let key = derive_key(pin, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&iv);
    let decrypted = cipher
        .decrypt(nonce, content.as_ref())
        .map_err(|_| "Invalid PIN or corrupted data.".to_string())?;
    String::from_utf8(decrypted).map_err(|_| "Invalid PIN or corrupted data.".to_string())
}

pub fn encrypt_verifier(pin: &str) -> Result<String, String> {
    encrypt("AI_GUARDIAN_PIN_VERIFIER", pin)
}

pub fn verify_pin(pin: &str, verifier: &str) -> bool {
    decrypt(verifier, pin)
        .map(|v| v == "AI_GUARDIAN_PIN_VERIFIER")
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_encryption() {
        let pin = "1234";
        let encrypted = encrypt("hello world", pin).unwrap();
        assert!(is_encrypted_payload(&encrypted));
        assert_eq!(decrypt(&encrypted, pin).unwrap(), "hello world");
    }
}
