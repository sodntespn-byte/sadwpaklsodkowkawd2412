/**
 * LIBERTY Performance Library
 * 
 * High-performance C implementations for critical operations.
 * Used by Rust via FFI for maximum performance.
 */

#ifndef LIBERTY_PERF_H
#define LIBERTY_PERF_H

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Version */
#define LIBERTY_PERF_VERSION_MAJOR 1
#define LIBERTY_PERF_VERSION_MINOR 0
#define LIBERTY_PERF_VERSION_PATCH 0

/* Error codes */
typedef enum {
    LIBERTY_OK = 0,
    LIBERTY_ERROR_NULL_POINTER = -1,
    LIBERTY_ERROR_INVALID_INPUT = -2,
    LIBERTY_ERROR_BUFFER_TOO_SMALL = -3,
    LIBERTY_ERROR_HASH_FAILED = -4,
    LIBERTY_ERROR_NOT_FOUND = -5,
} liberty_error_t;

/* ============================================
 * Hash Functions
 * ============================================ */

/**
 * Fast 64-bit hash function (xxHash-inspired)
 * Optimized for small strings (usernames, IDs, etc.)
 */
uint64_t liberty_hash_fast(const void* data, size_t len);

/**
 * Consistent hash for sharding
 * Returns a value between 0 and shard_count-1
 */
uint32_t liberty_consistent_hash(const char* key, size_t key_len, uint32_t shard_count);

/**
 * Hash map for string keys
 */
typedef struct liberty_hashmap liberty_hashmap_t;

liberty_hashmap_t* liberty_hashmap_create(size_t initial_capacity);
void liberty_hashmap_destroy(liberty_hashmap_t* map);

liberty_error_t liberty_hashmap_insert(liberty_hashmap_t* map, const char* key, void* value);
void* liberty_hashmap_get(const liberty_hashmap_t* map, const char* key);
liberty_error_t liberty_hashmap_remove(liberty_hashmap_t* map, const char* key);
size_t liberty_hashmap_size(const liberty_hashmap_t* map);

/* ============================================
 * String Operations
 * ============================================ */

/**
 * Case-insensitive string comparison
 * Returns: <0 if a<b, 0 if a==b, >0 if a>b
 */
int liberty_strcasecmp_fast(const char* a, const char* b);

/**
 * Fast string search (Boyer-Moore-Horspool)
 * Returns: index of first occurrence, or -1 if not found
 */
int64_t liberty_strstr_fast(const char* haystack, size_t haystack_len,
                            const char* needle, size_t needle_len);

/**
 * Check if string matches pattern (simple glob)
 * Supports * and ? wildcards
 */
bool liberty_glob_match(const char* str, const char* pattern);

/**
 * Fast integer to string conversion
 * Returns: number of characters written
 */
int liberty_i64_to_str(int64_t value, char* buffer, size_t buffer_size);
int liberty_u64_to_str(uint64_t value, char* buffer, size_t buffer_size);

/**
 * Fast string to integer conversion
 */
int64_t liberty_str_to_i64(const char* str, size_t len, bool* success);
uint64_t liberty_str_to_u64(const char* str, size_t len, bool* success);

/* ============================================
 * Base64 Encoding/Decoding
 * ============================================ */

/**
 * Calculate base64 encoded length
 */
size_t liberty_base64_encoded_len(size_t input_len);

/**
 * Calculate base64 decoded length
 */
size_t liberty_base64_decoded_len(const char* input, size_t input_len);

/**
 * Base64 encode
 * Returns: number of characters written, or negative on error
 */
int liberty_base64_encode(const uint8_t* input, size_t input_len,
                          char* output, size_t output_size);

/**
 * Base64 decode
 * Returns: number of bytes written, or negative on error
 */
int liberty_base64_decode(const char* input, size_t input_len,
                          uint8_t* output, size_t output_size);

/* ============================================
 * JSON Utilities
 * ============================================ */

/**
 * Fast JSON string validation
 * Checks if string is valid UTF-8 JSON
 */
bool liberty_json_is_valid(const char* json, size_t len);

/**
 * Find value for key in JSON object
 * Returns: pointer to value start, or NULL if not found
 */
const char* liberty_json_find_value(const char* json, size_t json_len,
                                    const char* key, size_t* value_len);

/**
 * Extract string value
 * Returns: 0 on success, copies string to buffer
 */
int liberty_json_get_string(const char* json, size_t json_len,
                            const char* key, char* buffer, size_t buffer_size);

/**
 * Extract integer value
 */
int liberty_json_get_i64(const char* json, size_t json_len,
                         const char* key, int64_t* value);

/* ============================================
 * Rate Limiting
 * ============================================ */

/**
 * Token bucket for rate limiting
 */
typedef struct liberty_token_bucket liberty_token_bucket_t;

liberty_token_bucket_t* liberty_token_bucket_create(double rate, double burst);
void liberty_token_bucket_destroy(liberty_token_bucket_t* bucket);

bool liberty_token_bucket_consume(liberty_token_bucket_t* bucket, double tokens);
void liberty_token_bucket_refill(liberty_token_bucket_t* bucket);

/* ============================================
 * Message Processing
 * ============================================ */

/**
 * Parse mention from message
 * Returns: user ID if found, 0 if not found
 */
uint64_t liberty_parse_mention(const char* msg, size_t msg_len, size_t* mention_end);

/**
 * Parse emoji from string
 * Returns: true if valid emoji, fills buffer with unicode
 */
bool liberty_parse_emoji(const char* str, size_t len, char* buffer, size_t* out_len);

/**
 * Count mentions in message
 */
size_t liberty_count_mentions(const char* msg, size_t len);

/* ============================================
 * Memory Pool
 * ============================================ */

/**
 * Fast memory pool for message processing
 */
typedef struct liberty_mempool liberty_mempool_t;

liberty_mempool_t* liberty_mempool_create(size_t block_size, size_t num_blocks);
void liberty_mempool_destroy(liberty_mempool_t* pool);

void* liberty_mempool_alloc(liberty_mempool_t* pool);
void liberty_mempool_free(liberty_mempool_t* pool, void* ptr);
void liberty_mempool_reset(liberty_mempool_t* pool);

/* ============================================
 * UUID Operations
 * ============================================ */

/**
 * Fast UUID v4 generation
 * Uses hardware RNG if available
 */
void liberty_uuid_v4(char* buffer);

/**
 * UUID validation
 */
bool liberty_uuid_is_valid(const char* uuid);

/**
 * UUID to binary
 */
int liberty_uuid_to_bytes(const char* uuid, uint8_t* bytes);

/**
 * Binary to UUID
 */
int liberty_bytes_to_uuid(const uint8_t* bytes, char* uuid);

/* ============================================
 * Compression
 * ============================================ */

/**
 * Calculate worst-case compressed size
 */
size_t liberty_compress_bound(size_t input_len);

/**
 * LZ4-style fast compression
 * Returns: compressed size, or negative on error
 */
int liberty_compress_fast(const uint8_t* input, size_t input_len,
                          uint8_t* output, size_t output_size);

/**
 * Decompress
 * Returns: decompressed size, or negative on error
 */
int liberty_decompress_fast(const uint8_t* input, size_t input_len,
                            uint8_t* output, size_t output_size);

#ifdef __cplusplus
}
#endif

#endif /* LIBERTY_PERF_H */
