//! JWT Token management

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum JwtError {
    #[error("Token creation failed: {0}")]
    CreationFailed(String),
    
    #[error("Token validation failed: {0}")]
    ValidationFailed(String),
    
    #[error("Token expired")]
    Expired,
    
    #[error("Invalid token")]
    InvalidToken,
}

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Issuer
    pub iss: String,
    /// Audience
    pub aud: String,
    /// Expiration timestamp
    pub exp: usize,
    /// Issued at timestamp
    pub iat: usize,
    /// JWT ID
    pub jti: String,
    /// Token type (access/refresh)
    pub token_type: TokenType,
    /// User roles (for quick access)
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TokenType {
    Access,
    Refresh,
}

/// JWT Configuration
pub struct JwtConfig {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    issuer: String,
    audience: String,
    access_token_expiration: Duration,
    refresh_token_expiration: Duration,
}

impl JwtConfig {
    /// Create a new JWT configuration with a secret key
    pub fn new(secret: &[u8], issuer: &str, audience: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret),
            decoding_key: DecodingKey::from_secret(secret),
            issuer: issuer.to_string(),
            audience: audience.to_string(),
            access_token_expiration: Duration::hours(1),
            refresh_token_expiration: Duration::days(30),
        }
    }
    
    /// Create with RSA keys (for production)
    pub fn new_rsa(private_key: &[u8], public_key: &[u8], issuer: &str, audience: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_rsa_pem(private_key).unwrap(),
            decoding_key: DecodingKey::from_rsa_pem(public_key).unwrap(),
            issuer: issuer.to_string(),
            audience: audience.to_string(),
            access_token_expiration: Duration::hours(1),
            refresh_token_expiration: Duration::days(30),
        }
    }
    
    /// Generate an access token
    pub fn generate_access_token(&self, user_id: Uuid, roles: Vec<String>) -> Result<String, JwtError> {
        self.generate_token(user_id, roles, TokenType::Access, self.access_token_expiration)
    }
    
    /// Generate a refresh token
    pub fn generate_refresh_token(&self, user_id: Uuid, roles: Vec<String>) -> Result<String, JwtError> {
        self.generate_token(user_id, roles, TokenType::Refresh, self.refresh_token_expiration)
    }
    
    /// Generate a token with custom expiration
    fn generate_token(
        &self,
        user_id: Uuid,
        roles: Vec<String>,
        token_type: TokenType,
        expiration: Duration,
    ) -> Result<String, JwtError> {
        let now = Utc::now();
        let exp = now + expiration;
        
        let claims = Claims {
            sub: user_id.to_string(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: Uuid::new_v4().to_string(),
            token_type,
            roles,
        };
        
        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| JwtError::CreationFailed(e.to_string()))
    }
    
    /// Validate and decode a token
    pub fn validate_token(&self, token: &str) -> Result<Claims, JwtError> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[&self.issuer]);
        validation.set_audience(&[&self.audience]);
        
        match decode::<Claims>(token, &self.decoding_key, &validation) {
            Ok(data) => Ok(data.claims),
            Err(e) => {
                match e.kind() {
                    jsonwebtoken::errors::ErrorKind::ExpiredSignature => Err(JwtError::Expired),
                    _ => Err(JwtError::ValidationFailed(e.to_string())),
                }
            }
        }
    }
    
    /// Validate a refresh token specifically
    pub fn validate_refresh_token(&self, token: &str) -> Result<Claims, JwtError> {
        let claims = self.validate_token(token)?;
        
        if claims.token_type != TokenType::Refresh {
            return Err(JwtError::InvalidToken);
        }
        
        Ok(claims)
    }
    
    /// Validate an access token specifically
    pub fn validate_access_token(&self, token: &str) -> Result<Claims, JwtError> {
        let claims = self.validate_token(token)?;
        
        if claims.token_type != TokenType::Access {
            return Err(JwtError::InvalidToken);
        }
        
        Ok(claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_generation_and_validation() {
        let config = JwtConfig::new(b"test_secret_key_123456", "liberty", "liberty-users");
        let user_id = Uuid::new_v4();
        
        let token = config.generate_access_token(user_id, vec!["user".to_string()]).unwrap();
        let claims = config.validate_access_token(&token).unwrap();
        
        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.token_type, TokenType::Access);
    }

    #[test]
    fn test_refresh_token() {
        let config = JwtConfig::new(b"test_secret_key_123456", "liberty", "liberty-users");
        let user_id = Uuid::new_v4();
        
        let token = config.generate_refresh_token(user_id, vec!["user".to_string()]).unwrap();
        let claims = config.validate_refresh_token(&token).unwrap();
        
        assert_eq!(claims.token_type, TokenType::Refresh);
    }
}
