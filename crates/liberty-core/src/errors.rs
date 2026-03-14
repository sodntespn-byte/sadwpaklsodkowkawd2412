//! LIBERTY Error Types

use thiserror::Error;

#[derive(Error, Debug)]
pub enum LibertyError {
    #[error("User not found")]
    UserNotFound,
    
    #[error("Server not found")]
    ServerNotFound,
    
    #[error("Channel not found")]
    ChannelNotFound,
    
    #[error("Message not found")]
    MessageNotFound,
    
    #[error("Invalid credentials")]
    InvalidCredentials,
    
    #[error("User already exists")]
    UserAlreadyExists,
    
    #[error("Invalid username")]
    InvalidUsername,
    
    #[error("Invalid password")]
    InvalidPassword,
    
    #[error("Token expired")]
    TokenExpired,
    
    #[error("Invalid token")]
    InvalidToken,
    
    #[error("Unauthorized")]
    Unauthorized,
    
    #[error("Forbidden")]
    Forbidden,
    
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    
    #[error("Server full")]
    ServerFull,
    
    #[error("Banned from server")]
    BannedFromServer,
    
    #[error("Database error: {0}")]
    DatabaseError(String),
    
    #[error("IO error: {0}")]
    IoError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<serde_json::Error> for LibertyError {
    fn from(e: serde_json::Error) -> Self {
        LibertyError::SerializationError(e.to_string())
    }
}

impl From<std::io::Error> for LibertyError {
    fn from(e: std::io::Error) -> Self {
        LibertyError::IoError(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, LibertyError>;
