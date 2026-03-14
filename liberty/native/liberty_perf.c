/**
 * LIBERTY Performance Library Implementation
 */

#include "liberty_perf.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>
#include <ctype.h>
#include <stdatomic.h>

/* ============================================
 * Hash Functions Implementation
 * ============================================ */

/* 64-bit rotate left */
static inline uint64_t rotl64(uint64_t x, int r) {
    return (x << r) | (x >> (64 - r));
}

/* Constants for hash function */
static const uint64_t PRIME1 = 0x9E3779B185EBCA87ULL;
static const uint64_t PRIME2 = 0xC2B2AE3D27D4EB4FULL;
static const uint64_t PRIME3 = 0x165667B19E3779F9ULL;
static const uint64_t PRIME4 = 0x85EBCA77C2B2AE63ULL;
static const uint64_t PRIME5 = 0x27D4EB2F165667C5ULL;

uint64_t liberty_hash_fast(const void* data, size_t len) {
    const uint8_t* p = (const uint8_t*)data;
    const uint8_t* end = p + len;
    uint64_t h = 0;
    
    if (len >= 8) {
        const uint64_t* p64 = (const uint64_t*)p;
        const uint64_t* end64 = p64 + (len / 8);
        
        while (p64 < end64) {
            uint64_t k = *p64++;
            k *= PRIME2;
            k = rotl64(k, 31);
            k *= PRIME1;
            h ^= k;
            h = rotl64(h, 27);
            h = h * PRIME1 + PRIME4;
        }
        p = (const uint8_t*)p64;
    }
    
    if (p < end) {
        uint64_t k = 0;
        while (p < end - 1) {
            k = (k << 8) | *p++;
        }
        k = (k << 8) | *p;
        k *= PRIME5;
        k = rotl64(k, 11);
        k *= PRIME1;
        h ^= k;
    }
    
    h ^= len;
    h ^= h >> 33;
    h *= PRIME2;
    h ^= h >> 29;
    h *= PRIME3;
    h ^= h >> 32;
    
    return h;
}

uint32_t liberty_consistent_hash(const char* key, size_t key_len, uint32_t shard_count) {
    uint64_t hash = liberty_hash_fast(key, key_len);
    /* Jump consistent hashing */
    int64_t b = -1;
    int64_t j = 0;
    uint64_t h = hash;
    
    while (j < shard_count) {
        b = j;
        h = (h * 2862933555777941757ULL) + 1;
        j = (int64_t)((b + 1) * ((double)(1LL << 31) / (double)((h >> 33) + 1)));
    }
    
    return (uint32_t)b;
}

/* ============================================
 * Hash Map Implementation
 * ============================================ */

#define HASHMAP_LOAD_FACTOR 0.75

typedef struct {
    char* key;
    void* value;
    bool occupied;
} hashmap_entry_t;

struct liberty_hashmap {
    hashmap_entry_t* entries;
    size_t capacity;
    size_t size;
};

liberty_hashmap_t* liberty_hashmap_create(size_t initial_capacity) {
    liberty_hashmap_t* map = (liberty_hashmap_t*)malloc(sizeof(liberty_hashmap_t));
    if (!map) return NULL;
    
    /* Round up to power of 2 */
    size_t cap = 1;
    while (cap < initial_capacity) cap *= 2;
    
    map->entries = (hashmap_entry_t*)calloc(cap, sizeof(hashmap_entry_t));
    if (!map->entries) {
        free(map);
        return NULL;
    }
    
    map->capacity = cap;
    map->size = 0;
    return map;
}

void liberty_hashmap_destroy(liberty_hashmap_t* map) {
    if (!map) return;
    
    for (size_t i = 0; i < map->capacity; i++) {
        if (map->entries[i].occupied) {
            free(map->entries[i].key);
        }
    }
    free(map->entries);
    free(map);
}

static size_t hashmap_find_slot(const liberty_hashmap_t* map, const char* key) {
    uint64_t hash = liberty_hash_fast(key, strlen(key));
    size_t idx = hash & (map->capacity - 1);
    
    while (map->entries[idx].occupied) {
        if (strcmp(map->entries[idx].key, key) == 0) {
            return idx;
        }
        idx = (idx + 1) & (map->capacity - 1);
    }
    
    return idx;
}

liberty_error_t liberty_hashmap_insert(liberty_hashmap_t* map, const char* key, void* value) {
    if (!map || !key) return LIBERTY_ERROR_NULL_POINTER;
    
    /* Check if resize needed */
    if ((double)(map->size + 1) / map->capacity > HASHMAP_LOAD_FACTOR) {
        /* Double capacity */
        size_t new_cap = map->capacity * 2;
        hashmap_entry_t* new_entries = (hashmap_entry_t*)calloc(new_cap, sizeof(hashmap_entry_t));
        if (!new_entries) return LIBERTY_ERROR_INVALID_INPUT;
        
        /* Rehash */
        for (size_t i = 0; i < map->capacity; i++) {
            if (map->entries[i].occupied) {
                uint64_t hash = liberty_hash_fast(map->entries[i].key, strlen(map->entries[i].key));
                size_t idx = hash & (new_cap - 1);
                while (new_entries[idx].occupied) {
                    idx = (idx + 1) & (new_cap - 1);
                }
                new_entries[idx] = map->entries[i];
            }
        }
        
        free(map->entries);
        map->entries = new_entries;
        map->capacity = new_cap;
    }
    
    size_t idx = hashmap_find_slot(map, key);
    
    if (!map->entries[idx].occupied) {
        map->entries[idx].key = strdup(key);
        if (!map->entries[idx].key) return LIBERTY_ERROR_INVALID_INPUT;
        map->entries[idx].occupied = true;
        map->size++;
    }
    
    map->entries[idx].value = value;
    return LIBERTY_OK;
}

void* liberty_hashmap_get(const liberty_hashmap_t* map, const char* key) {
    if (!map || !key) return NULL;
    
    size_t idx = hashmap_find_slot(map, key);
    if (map->entries[idx].occupied) {
        return map->entries[idx].value;
    }
    return NULL;
}

liberty_error_t liberty_hashmap_remove(liberty_hashmap_t* map, const char* key) {
    if (!map || !key) return LIBERTY_ERROR_NULL_POINTER;
    
    size_t idx = hashmap_find_slot(map, key);
    if (!map->entries[idx].occupied) return LIBERTY_ERROR_NOT_FOUND;
    
    free(map->entries[idx].key);
    map->entries[idx].occupied = false;
    map->entries[idx].key = NULL;
    map->entries[idx].value = NULL;
    map->size--;
    
    return LIBERTY_OK;
}

size_t liberty_hashmap_size(const liberty_hashmap_t* map) {
    return map ? map->size : 0;
}

/* ============================================
 * String Operations Implementation
 * ============================================ */

int liberty_strcasecmp_fast(const char* a, const char* b) {
    if (!a || !b) return a ? 1 : (b ? -1 : 0);
    
    while (*a && *b) {
        int ca = (int)(unsigned char)*a;
        int cb = (int)(unsigned char)*b;
        
        if (ca >= 'A' && ca <= 'Z') ca += 32;
        if (cb >= 'A' && cb <= 'Z') cb += 32;
        
        if (ca != cb) return ca - cb;
        
        a++;
        b++;
    }
    
    return (int)(unsigned char)*a - (int)(unsigned char)*b;
}

int64_t liberty_strstr_fast(const char* haystack, size_t haystack_len,
                            const char* needle, size_t needle_len) {
    if (!haystack || !needle || needle_len == 0) return -1;
    if (needle_len > haystack_len) return -1;
    
    /* Build bad character table */
    size_t bad_char[256];
    for (size_t i = 0; i < 256; i++) {
        bad_char[i] = needle_len;
    }
    for (size_t i = 0; i < needle_len - 1; i++) {
        bad_char[(unsigned char)needle[i]] = needle_len - 1 - i;
    }
    
    /* Search */
    size_t i = 0;
    while (i <= haystack_len - needle_len) {
        size_t j = needle_len - 1;
        
        while (j < needle_len && haystack[i + j] == needle[j]) {
            j--;
        }
        
        if (j == (size_t)-1) {
            return (int64_t)i;
        }
        
        i += bad_char[(unsigned char)haystack[i + needle_len - 1]];
    }
    
    return -1;
}

bool liberty_glob_match(const char* str, const char* pattern) {
    if (!str || !pattern) return false;
    
    while (*pattern) {
        if (*pattern == '*') {
            pattern++;
            if (!*pattern) return true;
            
            while (*str) {
                if (liberty_glob_match(str, pattern)) {
                    return true;
                }
                str++;
            }
            return false;
        }
        
        if (*pattern == '?') {
            if (!*str) return false;
            str++;
            pattern++;
            continue;
        }
        
        if (*pattern != *str) return false;
        str++;
        pattern++;
    }
    
    return !*str;
}

int liberty_i64_to_str(int64_t value, char* buffer, size_t buffer_size) {
    if (!buffer || buffer_size == 0) return -1;
    
    char tmp[21];
    int pos = 20;
    tmp[pos] = '\0';
    
    bool negative = value < 0;
    if (negative) value = -value;
    
    if (value == 0) {
        tmp[--pos] = '0';
    } else {
        while (value > 0) {
            tmp[--pos] = '0' + (value % 10);
            value /= 10;
        }
    }
    
    if (negative) {
        tmp[--pos] = '-';
    }
    
    size_t len = 20 - pos;
    if (len >= buffer_size) return -1;
    
    memcpy(buffer, tmp + pos, len + 1);
    return (int)len;
}

int liberty_u64_to_str(uint64_t value, char* buffer, size_t buffer_size) {
    if (!buffer || buffer_size == 0) return -1;
    
    char tmp[21];
    int pos = 20;
    tmp[pos] = '\0';
    
    if (value == 0) {
        tmp[--pos] = '0';
    } else {
        while (value > 0) {
            tmp[--pos] = '0' + (value % 10);
            value /= 10;
        }
    }
    
    size_t len = 20 - pos;
    if (len >= buffer_size) return -1;
    
    memcpy(buffer, tmp + pos, len + 1);
    return (int)len;
}

int64_t liberty_str_to_i64(const char* str, size_t len, bool* success) {
    if (!str || len == 0) {
        if (success) *success = false;
        return 0;
    }
    
    int64_t result = 0;
    bool negative = false;
    size_t i = 0;
    
    if (str[0] == '-') {
        negative = true;
        i = 1;
    } else if (str[0] == '+') {
        i = 1;
    }
    
    for (; i < len; i++) {
        if (str[i] < '0' || str[i] > '9') {
            if (success) *success = false;
            return 0;
        }
        result = result * 10 + (str[i] - '0');
    }
    
    if (success) *success = true;
    return negative ? -result : result;
}

uint64_t liberty_str_to_u64(const char* str, size_t len, bool* success) {
    if (!str || len == 0) {
        if (success) *success = false;
        return 0;
    }
    
    uint64_t result = 0;
    size_t i = 0;
    
    if (str[0] == '+') {
        i = 1;
    }
    
    for (; i < len; i++) {
        if (str[i] < '0' || str[i] > '9') {
            if (success) *success = false;
            return 0;
        }
        result = result * 10 + (str[i] - '0');
    }
    
    if (success) *success = true;
    return result;
}

/* ============================================
 * Base64 Implementation
 * ============================================ */

static const char base64_table[] = 
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static const int base64_decode_table[256] = {
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
    52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
    -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
    15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
    -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
    41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
};

size_t liberty_base64_encoded_len(size_t input_len) {
    return ((input_len + 2) / 3) * 4;
}

size_t liberty_base64_decoded_len(const char* input, size_t input_len) {
    size_t padding = 0;
    if (input_len >= 2) {
        if (input[input_len - 1] == '=') padding++;
        if (input[input_len - 2] == '=') padding++;
    }
    return (input_len / 4) * 3 - padding;
}

int liberty_base64_encode(const uint8_t* input, size_t input_len,
                          char* output, size_t output_size) {
    if (!input || !output) return -1;
    
    size_t out_len = liberty_base64_encoded_len(input_len);
    if (output_size <= out_len) return -1;
    
    size_t i, j;
    for (i = 0, j = 0; i < input_len; i += 3, j += 4) {
        uint32_t octet_a = i < input_len ? input[i] : 0;
        uint32_t octet_b = i + 1 < input_len ? input[i + 1] : 0;
        uint32_t octet_c = i + 2 < input_len ? input[i + 2] : 0;
        
        uint32_t triple = (octet_a << 16) | (octet_b << 8) | octet_c;
        
        output[j] = base64_table[(triple >> 18) & 0x3F];
        output[j + 1] = base64_table[(triple >> 12) & 0x3F];
        output[j + 2] = (i + 1 < input_len) ? base64_table[(triple >> 6) & 0x3F] : '=';
        output[j + 3] = (i + 2 < input_len) ? base64_table[triple & 0x3F] : '=';
    }
    
    output[j] = '\0';
    return (int)j;
}

int liberty_base64_decode(const char* input, size_t input_len,
                          uint8_t* output, size_t output_size) {
    if (!input || !output) return -1;
    if (input_len % 4 != 0) return -1;
    
    size_t out_len = liberty_base64_decoded_len(input, input_len);
    if (output_size < out_len) return -1;
    
    size_t i, j;
    for (i = 0, j = 0; i < input_len; i += 4) {
        int a = base64_decode_table[(unsigned char)input[i]];
        int b = base64_decode_table[(unsigned char)input[i + 1]];
        int c = base64_decode_table[(unsigned char)input[i + 2]];
        int d = base64_decode_table[(unsigned char)input[i + 3]];
        
        if (a < 0 || b < 0 || c < -1 || d < -1) return -1;
        
        uint32_t triple = (a << 18) | (b << 12) | ((c >= 0 ? c : 0) << 6) | (d >= 0 ? d : 0);
        
        output[j++] = (triple >> 16) & 0xFF;
        if (input[i + 2] != '=') {
            output[j++] = (triple >> 8) & 0xFF;
        }
        if (input[i + 3] != '=') {
            output[j++] = triple & 0xFF;
        }
    }
    
    return (int)j;
}

/* ============================================
 * UUID Implementation
 * ============================================ */

void liberty_uuid_v4(char* buffer) {
    static atomic_int seeded = 0;
    if (!seeded) {
        srand((unsigned int)time(NULL));
        seeded = 1;
    }
    
    uint64_t a = ((uint64_t)rand() << 32) | rand();
    uint64_t b = ((uint64_t)rand() << 32) | rand();
    
    /* Set version (4) and variant */
    a = (a & 0xFFFFFFFFFFFF0FFFULL) | 0x0000000000004000ULL;
    b = (b & 0x3FFFFFFFFFFFFFFFULL) | 0x8000000000000000ULL;
    
    snprintf(buffer, 37, "%08x-%04x-%04x-%04x-%012llx",
             (uint32_t)(a >> 32),
             (uint16_t)(a >> 16),
             (uint16_t)a,
             (uint16_t)(b >> 48),
             (unsigned long long)(b & 0xFFFFFFFFFFFFULL));
}

bool liberty_uuid_is_valid(const char* uuid) {
    if (!uuid) return false;
    
    /* Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx */
    for (int i = 0; i < 36; i++) {
        if (i == 8 || i == 13 || i == 18 || i == 23) {
            if (uuid[i] != '-') return false;
        } else {
            char c = uuid[i];
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) {
                return false;
            }
        }
    }
    
    return uuid[36] == '\0';
}

int liberty_uuid_to_bytes(const char* uuid, uint8_t* bytes) {
    if (!uuid || !bytes) return -1;
    if (!liberty_uuid_is_valid(uuid)) return -1;
    
    const char* p = uuid;
    for (int i = 0; i < 16; i++) {
        if (*p == '-') p++;
        
        char hex[3] = {p[0], p[1], 0};
        bytes[i] = (uint8_t)strtol(hex, NULL, 16);
        p += 2;
    }
    
    return 0;
}

int liberty_bytes_to_uuid(const uint8_t* bytes, char* uuid) {
    if (!bytes || !uuid) return -1;
    
    snprintf(uuid, 37, "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
             bytes[0], bytes[1], bytes[2], bytes[3],
             bytes[4], bytes[5],
             bytes[6], bytes[7],
             bytes[8], bytes[9],
             bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
    
    return 0;
}

/* ============================================
 * Token Bucket Implementation
 * ============================================ */

struct liberty_token_bucket {
    double rate;        /* Tokens per second */
    double burst;       /* Maximum tokens */
    double tokens;      /* Current tokens */
    double last_update; /* Last update time in seconds */
};

liberty_token_bucket_t* liberty_token_bucket_create(double rate, double burst) {
    liberty_token_bucket_t* bucket = (liberty_token_bucket_t*)malloc(sizeof(liberty_token_bucket_t));
    if (!bucket) return NULL;
    
    bucket->rate = rate;
    bucket->burst = burst;
    bucket->tokens = burst;
    bucket->last_update = (double)clock() / CLOCKS_PER_SEC;
    
    return bucket;
}

void liberty_token_bucket_destroy(liberty_token_bucket_t* bucket) {
    free(bucket);
}

bool liberty_token_bucket_consume(liberty_token_bucket_t* bucket, double tokens) {
    if (!bucket) return false;
    
    liberty_token_bucket_refill(bucket);
    
    if (bucket->tokens >= tokens) {
        bucket->tokens -= tokens;
        return true;
    }
    
    return false;
}

void liberty_token_bucket_refill(liberty_token_bucket_t* bucket) {
    if (!bucket) return;
    
    double now = (double)clock() / CLOCKS_PER_SEC;
    double elapsed = now - bucket->last_update;
    
    bucket->tokens += elapsed * bucket->rate;
    if (bucket->tokens > bucket->burst) {
        bucket->tokens = bucket->burst;
    }
    
    bucket->last_update = now;
}

/* ============================================
 * Memory Pool Implementation
 * ============================================ */

struct liberty_mempool {
    uint8_t* memory;
    size_t block_size;
    size_t num_blocks;
    size_t* free_list;
    size_t free_count;
};

liberty_mempool_t* liberty_mempool_create(size_t block_size, size_t num_blocks) {
    liberty_mempool_t* pool = (liberty_mempool_t*)malloc(sizeof(liberty_mempool_t));
    if (!pool) return NULL;
    
    pool->memory = (uint8_t*)malloc(block_size * num_blocks);
    pool->free_list = (size_t*)malloc(sizeof(size_t) * num_blocks);
    
    if (!pool->memory || !pool->free_list) {
        free(pool->memory);
        free(pool->free_list);
        free(pool);
        return NULL;
    }
    
    pool->block_size = block_size;
    pool->num_blocks = num_blocks;
    
    /* Initialize free list */
    for (size_t i = 0; i < num_blocks; i++) {
        pool->free_list[i] = i;
    }
    pool->free_count = num_blocks;
    
    return pool;
}

void liberty_mempool_destroy(liberty_mempool_t* pool) {
    if (!pool) return;
    free(pool->memory);
    free(pool->free_list);
    free(pool);
}

void* liberty_mempool_alloc(liberty_mempool_t* pool) {
    if (!pool || pool->free_count == 0) return NULL;
    
    size_t idx = pool->free_list[--pool->free_count];
    return pool->memory + idx * pool->block_size;
}

void liberty_mempool_free(liberty_mempool_t* pool, void* ptr) {
    if (!pool || !ptr) return;
    
    size_t offset = (uint8_t*)ptr - pool->memory;
    size_t idx = offset / pool->block_size;
    
    if (idx < pool->num_blocks) {
        pool->free_list[pool->free_count++] = idx;
    }
}

void liberty_mempool_reset(liberty_mempool_t* pool) {
    if (!pool) return;
    
    for (size_t i = 0; i < pool->num_blocks; i++) {
        pool->free_list[i] = i;
    }
    pool->free_count = pool->num_blocks;
}
