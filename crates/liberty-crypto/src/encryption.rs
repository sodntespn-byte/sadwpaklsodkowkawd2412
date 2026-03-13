//! End-to-end encryption support using AES-256-GCM

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use sha2::{Sha256, Digest};
use hkdf::Hkdf;
use thiserror::Error;
use zeroize::{Zeroize, Zeroizing};

#[derive(Error, Debug)]
pub enum EncryptionError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    
    #[error("Key derivation failed")]
    KeyDerivationFailed,
    
    #[error("Invalid key size")]
    InvalidKeySize,
    
    #[error("Invalid nonce size")]
    InvalidNonceSize,
}

/// AES-256-GCM key size (32 bytes)
pub const KEY_SIZE: usize = 32;
/// Nonce size for AES-GCM (12 bytes)
pub const NONCE_SIZE: usize = 12;
/// Tag size for AES-GCM (16 bytes)
pub const TAG_SIZE: usize = 16;

/// Generate a random encryption key
pub fn generate_key() -> [u8; KEY_SIZE] {
    let mut key = [0u8; KEY_SIZE];
    OsRng.fill_bytes(&mut key);
    key
}

/// Generate a random nonce
pub fn generate_nonce() -> [u8; NONCE_SIZE] {
    let mut nonce = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

/// Derive a key from a password using HKDF
pub fn derive_key_from_password(password: &str, salt: &[u8]) -> Result<[u8; KEY_SIZE], EncryptionError> {
    let hkdf = Hkdf::<Sha256>::new(Some(salt), password.as_bytes());
    let mut key = [0u8; KEY_SIZE];
    hkdf.expand(b"liberty_encryption_key", &mut key)
        .map_err(|_| EncryptionError::KeyDerivationFailed)?;
    Ok(key)
}

/// Encrypt data using AES-256-GCM
pub fn encrypt(key: &[u8], plaintext: &[u8]) -> Result<(Vec<u8>, [u8; NONCE_SIZE]), EncryptionError> {
    if key.len() != KEY_SIZE {
        return Err(EncryptionError::InvalidKeySize);
    }
    
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;
    
    let nonce = generate_nonce();
    let nonce_obj = Nonce::from_slice(&nonce);
    
    let ciphertext = cipher
        .encrypt(nonce_obj, plaintext)
        .map_err(|e| EncryptionError::EncryptionFailed(e.to_string()))?;
    
    Ok((ciphertext, nonce))
}

/// Decrypt data using AES-256-GCM
pub fn decrypt(key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Zeroizing<Vec<u8>>, EncryptionError> {
    if key.len() != KEY_SIZE {
        return Err(EncryptionError::InvalidKeySize);
    }
    if nonce.len() != NONCE_SIZE {
        return Err(EncryptionError::InvalidNonceSize);
    }
    
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;
    
    let nonce_obj = Nonce::from_slice(nonce);
    
    let plaintext = cipher
        .decrypt(nonce_obj, ciphertext)
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))?;
    
    Ok(Zeroizing::new(plaintext))
}

/// Encrypted message structure
#[derive(Debug, Clone)]
pub struct EncryptedMessage {
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; NONCE_SIZE],
    pub version: u8,
}

impl EncryptedMessage {
    /// Current encryption version
    pub const VERSION: u8 = 1;
    
    /// Create a new encrypted message
    pub fn new(ciphertext: Vec<u8>, nonce: [u8; NONCE_SIZE]) -> Self {
        Self {
            ciphertext,
            nonce,
            version: Self::VERSION,
        }
    }
    
    /// Serialize to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(1 + NONCE_SIZE + self.ciphertext.len());
        bytes.push(self.version);
        bytes.extend_from_slice(&self.nonce);
        bytes.extend_from_slice(&self.ciphertext);
        bytes
    }
    
    /// Deserialize from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, EncryptionError> {
        if bytes.len() < 1 + NONCE_SIZE {
            return Err(EncryptionError::DecryptionFailed("Invalid message format".to_string()));
        }
        
        let version = bytes[0];
        if version != Self::VERSION {
            return Err(EncryptionError::DecryptionFailed(format!(
                "Unsupported version: {}",
                version
            )));
        }
        
        let mut nonce = [0u8; NONCE_SIZE];
        nonce.copy_from_slice(&bytes[1..1 + NONCE_SIZE]);
        
        let ciphertext = bytes[1 + NONCE_SIZE..].to_vec();
        
        Ok(Self {
            ciphertext,
            nonce,
            version,
        })
    }
}

/// Secure message encryption for E2E encrypted channels
pub fn encrypt_message(key: &[u8], message: &str) -> Result<EncryptedMessage, EncryptionError> {
    let (ciphertext, nonce) = encrypt(key, message.as_bytes())?;
    Ok(EncryptedMessage::new(ciphertext, nonce))
}

/// Secure message decryption for E2E encrypted channels
pub fn decrypt_message(key: &[u8], encrypted: &EncryptedMessage) -> Result<String, EncryptionError> {
    let plaintext = decrypt(key, &encrypted.nonce, &encrypted.ciphertext)?;
    String::from_utf8(plaintext.to_vec())
        .map_err(|e| EncryptionError::DecryptionFailed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = generate_key();
        let plaintext = b"Hello, LIBERTY!";
        
        let (ciphertext, nonce) = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &nonce, &ciphertext).unwrap();
        
        assert_eq!(plaintext.to_vec(), decrypted.to_vec());
    }

    #[test]
    fn test_message_encryption() {
        let key = generate_key();
        let message = "Secret message for LIBERTY users";
        
        let encrypted = encrypt_message(&key, message).unwrap();
        let decrypted = decrypt_message(&key, &encrypted).unwrap();
        
        assert_eq!(message, decrypted);
    }

    #[test]
    fn test_encrypted_message_serialization() {
        let key = generate_key();
        let message = "Test serialization";
        
        let encrypted = encrypt_message(&key, message).unwrap();
        let bytes = encrypted.to_bytes();
        let restored = EncryptedMessage::from_bytes(&bytes).unwrap();
        
        assert_eq!(encrypted.nonce, restored.nonce);
        assert_eq!(encrypted.ciphertext, restored.ciphertext);
    }

    #[test]
    fn test_key_derivation() {
        let password = "user_password_123";
        let salt = b"random_salt_value";
        
        let key1 = derive_key_from_password(password, salt).unwrap();
        let key2 = derive_key_from_password(password, salt).unwrap();
        
        assert_eq!(key1, key2);
    }
}
