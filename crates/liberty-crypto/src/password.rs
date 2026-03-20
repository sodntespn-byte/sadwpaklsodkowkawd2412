//! Password hashing and verification using Argon2

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Algorithm, Params, Version,
};
use zeroize::{Zeroize, Zeroizing};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PasswordError {
    #[error("Password hashing failed: {0}")]
    HashingFailed(String),
    
    #[error("Invalid password")]
    InvalidPassword,
    
    #[error("Invalid hash format")]
    InvalidHashFormat,
    
    #[error("Password too short")]
    TooShort,
    
    #[error("Password too long")]
    TooLong,
}

/// Minimum password length
const MIN_PASSWORD_LEN: usize = 8;
/// Maximum password length
const MAX_PASSWORD_LEN: usize = 128;

/// Hash a password using Argon2id
pub fn hash_password(password: &str) -> Result<String, PasswordError> {
    // Validate password length
    let password_bytes = password.as_bytes();
    if password_bytes.len() < MIN_PASSWORD_LEN {
        return Err(PasswordError::TooShort);
    }
    if password_bytes.len() > MAX_PASSWORD_LEN {
        return Err(PasswordError::TooLong);
    }

    // Create Argon2id instance with secure parameters
    let params = Params::new(
        65536,        // m_cost (memory cost in KiB) - 64 MB
        3,            // t_cost (time cost - iterations)
        4,            // p_cost (parallelism)
        Some(32),     // output length
    ).map_err(|e| PasswordError::HashingFailed(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    
    // Generate random salt
    let salt = SaltString::generate(&mut OsRng);
    
    // Hash password in zeroizing memory
    let password_bytes = Zeroizing::new(password.as_bytes().to_vec());
    let hash = argon2
        .hash_password(&password_bytes, &salt)
        .map_err(|e| PasswordError::HashingFailed(e.to_string()))?
        .to_string();
    
    Ok(hash)
}

/// Verify a password against a hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, PasswordError> {
    // Parse the hash
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|_| PasswordError::InvalidHashFormat)?;
    
    // Verify in zeroizing memory
    let password_bytes = Zeroizing::new(password.as_bytes().to_vec());
    
    match Argon2::default().verify_password(&password_bytes, &parsed_hash) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Securely compare two strings in constant time
pub fn secure_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        result |= x ^ y;
    }
    
    result == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "test_password_123!";
        let hash = hash_password(password).unwrap();
        
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_password_too_short() {
        let result = hash_password("short");
        assert!(matches!(result, Err(PasswordError::TooShort)));
    }

    #[test]
    fn test_password_too_long() {
        let long_password = "a".repeat(200);
        let result = hash_password(&long_password);
        assert!(matches!(result, Err(PasswordError::TooLong)));
    }
}
