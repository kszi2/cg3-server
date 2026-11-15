#ifndef DEBUGMALLOC_H
#define DEBUGMALLOC_H

#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>
#include <ctype.h>
#include <string.h>
#include <stdarg.h>

#define debugmalloc_singleton(...)

#define debugmalloc_strlcpy(...)

#define debugmalloc_log_file(...)

#define debugmalloc_max_block_size(...)

#define debugmalloc_log(...)

#define debugmalloc_memory_init(...)

#define debugmalloc_canary_ok(...)

#define debugmalloc_dump_memory(...)

#define debugmalloc_dump_elem(...)

#define debugmalloc_dump(...)

#define debugmalloc_atexit_dump(...)

#define debugmalloc_hash(...)

#define debugmalloc_insert(...)

#define debugmalloc_remove(...)

#define debugmalloc_find(...)

#define debugmalloc_malloc_full(...)

#define debugmalloc_free_inner(...)

#define debugmalloc_free_full(...)

#define debugmalloc_realloc_full(...)

#define debugmalloc_create(...)

#define debugmalloc_strdup(...)
 
#define debugmalloc_strndup(...)

#endif
