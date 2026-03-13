//! LIBERTY Brand Constants
//!
//! Core brand colors and UI constants for the LIBERTY platform.

/// Primary brand colors - Yellow and Black theme
pub mod colors {
    /// Primary yellow - #FFD700 (Gold)
    pub const PRIMARY_YELLOW: &str = "#FFD700";
    
    /// Secondary yellow - #FFC107 (Amber)
    pub const SECONDARY_YELLOW: &str = "#FFC107";
    
    /// Light yellow - #FFEB3B
    pub const LIGHT_YELLOW: &str = "#FFEB3B";
    
    /// Dark yellow - #FF9800
    pub const DARK_YELLOW: &str = "#FF9800";
    
    /// Primary black - #0D0D0D
    pub const PRIMARY_BLACK: &str = "#0D0D0D";
    
    /// Secondary black - #1A1A1A
    pub const SECONDARY_BLACK: &str = "#1A1A1A";
    
    /// Dark gray - #2D2D2D
    pub const DARK_GRAY: &str = "#2D2D2D";
    
    /// Medium gray - #404040
    pub const MEDIUM_GRAY: &str = "#404040";
    
    /// Light gray - #808080
    pub const LIGHT_GRAY: &str = "#808080";
    
    /// White text - #FFFFFF
    pub const WHITE: &str = "#FFFFFF";
    
    /// Success green - #4CAF50
    pub const SUCCESS: &str = "#4CAF50";
    
    /// Error red - #F44336
    pub const ERROR: &str = "#F44336";
    
    /// Warning orange - #FF9800
    pub const WARNING: &str = "#FF9800";
    
    /// Info blue - #2196F3
    pub const INFO: &str = "#2196F3";
    
    /// Online status - #4CAF50
    pub const STATUS_ONLINE: &str = "#4CAF50";
    
    /// Idle status - #FFC107
    pub const STATUS_IDLE: &str = "#FFC107";
    
    /// Do not disturb - #F44336
    pub const STATUS_DND: &str = "#F44336";
    
    /// Offline - #808080
    pub const STATUS_OFFLINE: &str = "#808080";
}

/// Server configuration constants
pub mod server {
    /// Default server port
    pub const DEFAULT_PORT: u16 = 8443;
    
    /// WebSocket path
    pub const WS_PATH: &str = "/ws";
    
    /// API version
    pub const API_VERSION: &str = "v1";
    
    /// Max message length (1MB)
    pub const MAX_MESSAGE_LENGTH: usize = 1_048_576;
    
    /// Max server name length
    pub const MAX_SERVER_NAME_LENGTH: usize = 100;
    
    /// Max channel name length
    pub const MAX_CHANNEL_NAME_LENGTH: usize = 50;
    
    /// Max username length
    pub const MAX_USERNAME_LENGTH: usize = 32;
    
    /// Min username length
    pub const MIN_USERNAME_LENGTH: usize = 3;
    
    /// Max password length
    pub const MAX_PASSWORD_LENGTH: usize = 128;
    
    /// Min password length
    pub const MIN_PASSWORD_LENGTH: usize = 8;
}

/// JWT configuration
pub mod jwt {
    /// Token expiration in seconds (7 days)
    pub const TOKEN_EXPIRATION: u64 = 604_800;
    
    /// Refresh token expiration (30 days)
    pub const REFRESH_EXPIRATION: u64 = 2_592_000;
}
