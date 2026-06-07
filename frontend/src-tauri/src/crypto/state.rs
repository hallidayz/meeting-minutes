use std::sync::RwLock;

pub struct CryptoState {
    pin: RwLock<Option<String>>,
}

impl CryptoState {
    pub fn new() -> Self {
        Self {
            pin: RwLock::new(None),
        }
    }

    pub fn unlock(&self, pin: String) {
        if let Ok(mut guard) = self.pin.write() {
            *guard = Some(pin);
        }
    }

    pub fn lock(&self) {
        if let Ok(mut guard) = self.pin.write() {
            *guard = None;
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.pin.read().map(|g| g.is_some()).unwrap_or(false)
    }

    pub fn with_pin<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&str) -> Result<T, String>,
    {
        let guard = self.pin.read().map_err(|_| "Crypto state unavailable".to_string())?;
        let pin = guard.as_ref().ok_or_else(|| "App is locked".to_string())?;
        f(pin)
    }
}

impl Default for CryptoState {
    fn default() -> Self {
        Self::new()
    }
}
