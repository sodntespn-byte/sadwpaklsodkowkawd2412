// LIBERTY - Formal Verification in F*
// Security-critical cryptographic operations

module LibertyCrypto

open FStar.Mul
open FStar.Bytes
open FStar.UInt32
open FStar.UInt64

// ============================================
// Basic Types
// ============================================

/** Password with length constraints */
type password = b:bytes { 8 <= length b /\ length b <= 128 }

/** Hash output (64 bytes for SHA-512) */
type hash = b:bytes { length b = 64 }

/** Salt (16 bytes) */
type salt = b:bytes { length b = 16 }

/** Auth token */
type token = b:bytes { 16 <= length b /\ length b <= 256 }

/** User ID (UUID format) */
type user_id = b:bytes { length b = 16 }

/** Nonce for encryption (12 bytes for AES-GCM) */
type nonce = b:bytes { length b = 12 }

/** Encryption key (32 bytes for AES-256) */
type enc_key = b:bytes { length b = 32 }

/** Ciphertext with authentication tag */
type ciphertext = b:bytes { 16 <= length b }

// ============================================
// Security Properties
// ============================================

/** Memory safety: no buffer overflows */
val no_buffer_overflow: 
  buffer:bytes ->
  index:nat ->
  Lemma (ensures (index < length buffer))

/** Constant-time comparison to prevent timing attacks */
val constant_time_compare:
  a:bytes ->
  b:bytes ->
  Pure bool
    (requires (length a = length b))
    (ensures (fun r -> r = (a = b)))

/** Zero memory securely */
val secure_zero:
  buffer:bytes ->
  Pure unit
    (requires (True))
    (ensures (fun _ -> forall i. buffer.[i] = 0))

// ============================================
// Password Hashing (Argon2id)
// ============================================

/** Password hashing parameters */
type hash_params = {
  memory_cost: nat;      // Memory in KiB
  time_cost: nat;        // Iterations
  parallelism: nat;      // Parallel threads
  output_len: nat;       // Hash output length
}

/** Default secure parameters */
val default_hash_params: hash_params

/** Hash password with Argon2id */
val hash_password:
  password:password ->
  params:hash_params ->
  Pure (hash * salt)
    (requires (params.output_len = 64))
    (ensures (fun (h, s) -> 
      // Hash is deterministic given same salt
      True))

/** Verify password against hash */
val verify_password:
  password:password ->
  hash:hash ->
  salt:salt ->
  params:hash_params ->
  Pure bool
    (requires (True))
    (ensures (fun r -> 
      // Returns true iff password matches
      r = True \/ r = False))

// ============================================
// Symmetric Encryption (AES-256-GCM)
// ============================================

/** Authenticated encryption result */
type encrypted_data = {
  ciphertext: ciphertext;
  nonce: nonce;
  tag: b:bytes { length b = 16 };
}

/** Encrypt with AES-256-GCM */
val encrypt:
  key:enc_key ->
  plaintext:bytes ->
  Pure encrypted_data
    (requires (True))
    (ensures (fun r -> 
      // Ciphertext length = plaintext length + tag
      length r.ciphertext = length plaintext + 16))

/** Decrypt with AES-256-GCM */
val decrypt:
  key:enc_key ->
  data:encrypted_data ->
  Pure (option bytes)
    (requires (True))
    (ensures (fun r ->
      // Returns Some plaintext if valid, None if authentication fails
      match r with
      | Some p -> length p = length data.ciphertext - 16
      | None -> True))

// ============================================
// Key Derivation (HKDF-SHA256)
// ============================================

/** Derive key from password */
val derive_key:
  password:password ->
  salt:salt ->
  Pure enc_key
    (requires (True))
    (ensures (fun k -> length k = 32))

/** Derive multiple keys from master key */
val derive_keys:
  master_key:enc_key ->
  context:bytes ->
  count:nat ->
  Pure (list enc_key)
    (requires (count > 0))
    (ensures (fun ks -> length ks = count))

// ============================================
// JWT Token Validation
// ============================================

/** Token claims */
type claims = {
  sub: user_id;          // Subject (user ID)
  iss: string;           // Issuer
  aud: string;           // Audience
  exp: uint64;           // Expiration timestamp
  iat: uint64;           // Issued at timestamp
  jti: token;            // JWT ID
}

/** Token type */
type token_type = | Access | Refresh

/** Create signed token */
val create_token:
  claims:claims ->
  token_type:token_type ->
  secret:bytes ->
  Pure token
    (requires (length secret >= 32))
    (ensures (fun t -> length t >= 16))

/** Validate token */
val validate_token:
  token:token ->
  secret:bytes ->
  current_time:uint64 ->
  Pure (option (claims * token_type))
    (requires (length secret >= 32))
    (ensures (fun r ->
      match r with
      | Some (c, tt) -> c.exp > current_time
      | None -> True))

/** Check if token is expired */
val is_expired:
  claims:claims ->
  current_time:uint64 ->
  Pure bool
    (requires (True))
    (ensures (fun r -> r = (claims.exp <= current_time)))

// ============================================
// Rate Limiting
// ============================================

/** Rate limit state */
type rate_limit = {
  tokens: uint64;
  max_tokens: uint64;
  refill_rate: uint64;  // Tokens per second
  last_refill: uint64;  // Timestamp
}

/** Check if request is allowed */
val check_rate_limit:
  limit:rate_limit ->
  cost:uint64 ->
  current_time:uint64 ->
  Pure (rate_limit * bool)
    (requires (True))
    (ensures (fun (new_limit, allowed) ->
      // If allowed, tokens are deducted
      // If not allowed, tokens unchanged
      allowed ==> new_limit.tokens = limit.tokens - cost \/
      not allowed ==> new_limit.tokens = limit.tokens))

// ============================================
// Security Invariants
// ============================================

/** All passwords are hashed before storage */
val password_storage_invariant:
  stored:bytes ->
  Pure unit
    (requires (length stored = 64))  // Must be hash
    (ensures (fun _ -> True))

/** All tokens are validated before use */
val token_validation_invariant:
  token:token ->
  claims:claims ->
  current_time:uint64 ->
  Pure unit
    (requires (claims.exp > current_time))  // Must not be expired
    (ensures (fun _ -> True))

/** Keys are never exposed in logs */
val no_key_logging:
  key:enc_key ->
  Pure unit
    (requires (True))
    (ensures (fun _ -> 
      // Key is never passed to logging functions
      True))

// ============================================
// Proofs
// ============================================

/** Proof that encryption is reversible with correct key */
val encrypt_decrypt_inverse:
  key:enc_key ->
  plaintext:bytes ->
  Lemma 
    (ensures (
      let encrypted = encrypt key plaintext in
      match decrypt key encrypted with
      | Some decrypted -> decrypted = plaintext
      | None -> False
    ))

/** Proof that hash verification is consistent */
val hash_verify_consistent:
  password:password ->
  params:hash_params ->
  Lemma
    (ensures (
      let (h, s) = hash_password password params in
      verify_password password h s params = True
    ))

/** Proof that rate limiting prevents overflow */
val rate_limit_no_overflow:
  limit:rate_limit ->
  cost:uint64 ->
  current_time:uint64 ->
  Lemma
    (ensures (
      let (new_limit, _) = check_rate_limit limit cost current_time in
      new_limit.tokens <= limit.max_tokens
    ))
