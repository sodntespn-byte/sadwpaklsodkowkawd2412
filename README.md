# 🟡 LIBERTY

**Freedom to Connect** - A modern, secure Discord-like social network application.

![LIBERTY Banner](https://via.placeholder.com/800x200/0D0D0D/FFD700?text=LIBERTY+-+Freedom+to+Connect)

## 📁 Estrutura do projeto (frontend / backend separados)

O repositório está organizado em duas pastas:

| Pasta       | Descrição                                                                 |
| ----------- | ------------------------------------------------------------------------- |
| **backend/**  | API Node.js (Express), WebSocket, auth JWT, PostgreSQL. Entrada: `backend/server.js`. |
| **frontend/** | Interface estática: HTML, CSS, JS. Servida pelo backend na mesma origem. |

**Executar (na raiz):**

```bash
npm install
npm start
```

O servidor sobe com `node backend/server.js` e serve a API em `/api/v1` e os ficheiros estáticos da pasta `frontend/`. Variáveis de ambiente (`.env` ou painel do host): `DATABASE_URL`, `JWT_SECRET`.

**Onde está cada coisa:** ver **[ESTRUTURA.md](ESTRUTURA.md)** (mapa do projeto).  
**Deploy e documentação:** pasta **[docs/](docs/)** (SECURITY, SQUARECLOUD, DATABASE).

---

## 🎨 Design Theme

- **Primary Yellow**: `#FFD700` (Gold)
- **Secondary Yellow**: `#FFC107` (Amber)
- **Primary Black**: `#0D0D0D`
- **Secondary Black**: `#1A1A1A`

## 🏗️ Architecture

```
liberty/
├── crates/
│   ├── liberty-server/    # Main server (Rust)
│   ├── liberty-core/      # Domain models (Rust)
│   ├── liberty-crypto/    # Cryptography (Rust)
│   └── liberty-proto/     # Protocol types (Rust)
├── native/               # C performance components
│   ├── liberty_perf.h
│   └── liberty_perf.c
├── fstar/                 # F* formal verification
│   ├── LibertyCrypto.fst
│   └── LibertyProtocol.fst
├── backend/               # API Node.js (Express, WebSocket, PostgreSQL)
│   ├── server.js
│   ├── src/
│   ├── message-cache.js
│   └── db/
└── frontend/             # Interface estática
    ├── index.html
    ├── css/
    └── js/
```

## 🚀 Features

### Backend (Rust)

- **WebSocket Gateway**: Real-time bidirectional communication
- **REST API**: Full RESTful API for all operations
- **SQLite Database**: Persistent storage with SQLx
- **JWT Authentication**: Secure token-based auth with refresh tokens
- **Argon2id Password Hashing**: Industry-standard password security
- **AES-256-GCM Encryption**: End-to-end encryption support

### Frontend

- **Modern UI**: Beautiful yellow/black theme inspired by Discord
- **Real-time Updates**: WebSocket-based live messaging
- **Server Management**: Create, join, and manage servers
- **Channel System**: Text and voice channels with categories
- **Member Management**: Roles, permissions, and moderation

### Native Components (C)

- **Fast Hashing**: xxHash-inspired 64-bit hash function
- **String Operations**: Boyer-Moore-Horspool search, glob matching
- **Base64**: Optimized encoding/decoding
- **Memory Pool**: Fast allocation for message processing
- **Rate Limiting**: Token bucket implementation

### Formal Verification (F\*)

- **Cryptographic Proofs**: Security properties for crypto operations
- **Protocol Validation**: Message format and permission verification
- **Safety Invariants**: Memory safety and authentication guarantees

## 📋 Prerequisites

- **Rust** 1.70+ (with Cargo)
- **C Compiler** (GCC or Clang)
- **SQLite** 3.x
- **F\*** (optional, for verification)

## 🔧 Building

```bash
# Clone the repository
cd liberty

# Build all Rust crates
cargo build --release

# Build native C library (optional)
cd native
gcc -O3 -c liberty_perf.c -o liberty_perf.o
ar rcs libliberty_perf.a liberty_perf.o
```

## 🏃 Running

### Backend + Frontend (real integration)

To run the app with the **real Rust backend** (recommended for full features):

```bash
# From project root (liberty/)
export DATABASE_URL="sqlite:liberty.db?mode=rwc"
export RUST_LOG="liberty=debug"
export JWT_SECRET="$(openssl rand -hex 32)"   # or set a fixed 32+ char secret

cargo run -p liberty-server
# or: npm run server
```

Then open **http://localhost:8443** in your browser. The server serves the static frontend, REST API (`/api/v1`), and WebSocket (`/ws`) from the same origin, so the frontend connects to the real backend automatically.

### Frontend only (mock API)

To run the frontend with a **mock API** (no Rust, no database):

```bash
npm run dev
```

Then open **http://localhost:8080**. This uses `dev-server.js`, which simulates the API and WebSocket for UI development.

---

```bash
# Set environment variables (for real backend)
export DATABASE_URL="sqlite:liberty.db?mode=rwc"
export RUST_LOG="liberty=debug"

# JWT secret — obrigatório em produção (mínimo 32 caracteres aleatórios)
export JWT_SECRET="$(openssl rand -hex 32)"

# Run the server
cargo run --release -p liberty-server
```

The server will start on `http://localhost:8443`

## 📡 API Endpoints

### Authentication

| Method | Endpoint                | Description       |
| ------ | ----------------------- | ----------------- |
| POST   | `/api/v1/auth/register` | Register new user |
| POST   | `/api/v1/auth/login`    | Login             |
| POST   | `/api/v1/auth/logout`   | Logout            |
| POST   | `/api/v1/auth/refresh`  | Refresh token     |

### Users

| Method | Endpoint            | Description         |
| ------ | ------------------- | ------------------- |
| GET    | `/api/v1/users/@me` | Get current user    |
| PATCH  | `/api/v1/users/@me` | Update current user |
| GET    | `/api/v1/users/:id` | Get user by ID      |

### Servers

| Method | Endpoint              | Description         |
| ------ | --------------------- | ------------------- |
| GET    | `/api/v1/servers`     | List user's servers |
| POST   | `/api/v1/servers`     | Create server       |
| GET    | `/api/v1/servers/:id` | Get server info     |
| PATCH  | `/api/v1/servers/:id` | Update server       |
| DELETE | `/api/v1/servers/:id` | Delete server       |

### Channels

| Method | Endpoint                       | Description    |
| ------ | ------------------------------ | -------------- |
| GET    | `/api/v1/servers/:id/channels` | List channels  |
| POST   | `/api/v1/servers/:id/channels` | Create channel |
| GET    | `/api/v1/channels/:id`         | Get channel    |
| DELETE | `/api/v1/channels/:id`         | Delete channel |

### Messages

| Method | Endpoint                             | Description    |
| ------ | ------------------------------------ | -------------- |
| GET    | `/api/v1/channels/:id/messages`      | List messages  |
| POST   | `/api/v1/channels/:id/messages`      | Send message   |
| PATCH  | `/api/v1/channels/:id/messages/:mid` | Edit message   |
| DELETE | `/api/v1/channels/:id/messages/:mid` | Delete message |

## 🔌 WebSocket Protocol

Connect to `ws://localhost:8443/ws`

### Client → Server Messages

```json
{"op": "authenticate", "d": {"token": "jwt_token"}}
{"op": "heartbeat", "d": {"seq": 1}}
{"op": "send_message", "d": {"channel_id": "uuid", "content": "Hello!"}}
{"op": "update_presence", "d": {"status": "online"}}
```

### Server → Client Messages

```json
{"op": "hello", "d": {"heartbeat_interval": 45000, "server_version": "0.1.0"}}
{"op": "authenticated", "d": {"user": {...}, "servers": [...], "session_id": "uuid"}}
{"op": "message_created", "d": {"message": {...}}}
{"op": "presence_update", "d": {"user_id": "uuid", "status": "online"}}
```

## 🔐 Security Features

- **Password Hashing**: Argon2id with 64MB memory, 3 iterations
- **JWT Tokens**: RS256 signing with configurable expiration
- **E2E Encryption**: AES-256-GCM for private channels
- **Rate Limiting**: Token bucket per-user rate limits
- **Input Validation**: All inputs validated and sanitized
- **CORS**: Configurable cross-origin policies

## 🎯 Permissions System

| Permission            | Bit     |
| --------------------- | ------- |
| CREATE_INSTANT_INVITE | 1 << 0  |
| KICK_MEMBERS          | 1 << 1  |
| BAN_MEMBERS           | 1 << 2  |
| ADMINISTRATOR         | 1 << 3  |
| MANAGE_CHANNELS       | 1 << 4  |
| MANAGE_SERVER         | 1 << 5  |
| SEND_MESSAGES         | 1 << 11 |
| MANAGE_MESSAGES       | 1 << 13 |
| MANAGE_ROLES          | 1 << 28 |

## 🧪 Testing

```bash
# Run Rust tests
cargo test --all

# Run with coverage
cargo tarpaulin --all

# F* verification (requires F* installation)
cd fstar
fstar LibertyCrypto.fst
fstar LibertyProtocol.fst
```

## 📦 Dependencies

### Rust

- `tokio` - Async runtime
- `axum` - Web framework
- `sqlx` - Database
- `argon2` - Password hashing
- `jsonwebtoken` - JWT handling
- `serde` - Serialization
- `uuid` - UUID generation

### Frontend

- Vanilla JavaScript (no framework)
- Font Awesome icons
- Inter font family

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

**LIBERTY** - _Freedom to Connect_ 🟡⚫
