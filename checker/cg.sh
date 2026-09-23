#!/bin/bash

SOURCE_FILE=/cg3/input.zip
WORKDIR=/cg3/work
OUT_DIR=/cg3/out
TOOLS_DIR=/cg3/tools

check-0100-unzip() {
	CHECK_DIR=$OUT_DIR/0100-unzip
	mkdir -p $CHECK_DIR

	unzip -o $SOURCE_FILE -d $WORKDIR > $CHECK_DIR/out 2> $CHECK_DIR/error

	cd $WORKDIR || exit
	rm -rf __MACOSX
}

check-0110-sanity() {
	CHECK_DIR=$OUT_DIR/0110-sanity
	mkdir -p $CHECK_DIR

	pdf_count=$(find "$WORKDIR" -type f -iname '*.pdf' | wc -l)
	c_count=$(find "$WORKDIR" -type f -name '*.c' | wc -l)
	h_count=$(find "$WORKDIR" -type f -name '*.h' | wc -l)
	debugmalloc_count=$(find "$WORKDIR" -type f -name 'debugmalloc.h' | wc -l)

	{
		echo "PDF files: $pdf_count (required: at least 1)"
		echo ".c files: $c_count (required: at least 2)"
		echo ".h files: $h_count (required: at least 2)"
		echo "debugmalloc.h files: $debugmalloc_count (required: at least 1)"
	} > "$CHECK_DIR/out"

	: > "$CHECK_DIR/error"
	[ "$pdf_count" -ge 1 ] || echo "Sanity check failed: must contain at least 1 PDF file." >> "$CHECK_DIR/error"
	[ "$c_count" -ge 2 ] || echo "Sanity check failed: must contain at least 2 .c files." >> "$CHECK_DIR/error"
	[ "$h_count" -ge 2 ] || echo "Sanity check failed: must contain at least 2 .h file." >> "$CHECK_DIR/error"
	[ "$debugmalloc_count" -ge 1 ] || echo "Sanity check failed: must contain at least 1 debugmalloc.h file." >> "$CHECK_DIR/error"
}

check-0120-debugmalloc() {
	CHECK_DIR=$OUT_DIR/0120-debugmalloc
	mkdir -p $CHECK_DIR

	: > "$CHECK_DIR/out"
	: > "$CHECK_DIR/error"

	tool_hash=$(md5sum "$TOOLS_DIR/debugmalloc.h" 2>> "$CHECK_DIR/error" | cut -d ' ' -f 1)
	if [ -z "$tool_hash" ]; then
		echo "Could not calculate the checksum of $TOOLS_DIR/debugmalloc.h." >> "$CHECK_DIR/error"
		return
	fi

	debugmalloc_count=0
	while IFS= read -r -d '' file; do
		debugmalloc_count=$((debugmalloc_count + 1))
		file_hash=$(md5sum "$file" 2>> "$CHECK_DIR/error" | cut -d ' ' -f 1)
		if [ "$file_hash" = "$tool_hash" ]; then
			echo "OK: $file matches $TOOLS_DIR/debugmalloc.h (md5: $file_hash)" >> "$CHECK_DIR/out"
		else
			echo "Mismatch: $file does not match $TOOLS_DIR/debugmalloc.h (md5: $file_hash, expected: $tool_hash)" >> "$CHECK_DIR/error"
		fi
	done < <(find "$WORKDIR" -type f -name 'debugmalloc.h' -print0)

	if [ "$debugmalloc_count" -eq 0 ]; then
		echo "No debugmalloc.h files found in $WORKDIR." >> "$CHECK_DIR/error"
		touch $WORKDIR/debugmalloc.h
	fi
}

check-0121-debugmalloc-replace() {
	CHECK_DIR=$OUT_DIR/0121-debugmalloc-replace
	mkdir -p $CHECK_DIR

	find "$WORKDIR" -type f -name "debugmalloc.h" -exec sh -c 'cp "$1"/debugmalloc.h "$2"' shell "$TOOLS_DIR" {} \;
	echo "Replaced all debugmalloc.h in $WORKDIR with known-good one." > $CHECK_DIR/out

}

check-0200-compile() {
	CHECK_DIR=$OUT_DIR/0200-compile
	mkdir -p $CHECK_DIR

	: > "$CHECK_DIR/out"
	: > "$CHECK_DIR/error"

	compile_flags=(
		-Wall -Wextra -Wpedantic -Wvla
		-I/usr/include/SDL2
		-I/usr/include/SDL3
		-I/usr/include/SDL3_image
		-I/usr/include/SDL3_ttf
		-D_REENTRANT
	)
	while IFS= read -r -d '' directory; do
		compile_flags+=("-I$directory")
	done < <(find "$WORKDIR" -type d -print0)

	link_flags=(
		-lSDL2 -lSDL3
		-lSDL2_gfx
		-lSDL2_image -lSDL3_image
		-lSDL2_mixer
		-lSDL2_net
		-lSDL2_ttf -lSDL3_ttf
	)

	echo "Compiling files." >> "$CHECK_DIR/out"

	compile_count=0
	while IFS= read -r -d '' source_file; do
		compile_count=$((compile_count + 1))
		object_file="$CHECK_DIR/$(printf '%s' "$source_file" | md5sum | cut -d ' ' -f 1).o"
		
		{
			printf '\nCommand:'
			printf ' %q' gcc "${compile_flags[@]}" -c "$source_file" -o "$object_file"
			printf '\n'
		} >> "$CHECK_DIR/out"

		if gcc "${compile_flags[@]}" -c "$source_file" -o "$object_file" >> "$CHECK_DIR/out" 2>> "$CHECK_DIR/error"; then
			echo "OK: $source_file" >> "$CHECK_DIR/out"
		else
			echo "Compilation failed: $source_file" >> "$CHECK_DIR/error"
		fi
	done < <(find "$WORKDIR" -type f -name '*.c' -print0)

	if [ "$compile_count" -eq 0 ]; then
		echo "No C source files found in $WORKDIR." >> "$CHECK_DIR/error"
	else
		binary_file="$CHECK_DIR/main"
		object_files=("$CHECK_DIR"/*.o)
		if [ -e "${object_files[0]}" ]; then
			{
				printf '\nCommand:'
				printf ' %q' gcc "${object_files[@]}" "${link_flags[@]}" -o "$binary_file"
				printf '\n'
			} >> "$CHECK_DIR/out"

			if gcc "${object_files[@]}" "${link_flags[@]}" -o "$binary_file" >> "$CHECK_DIR/out" 2>> "$CHECK_DIR/error"; then
				echo "OK: linked binary $binary_file" >> "$CHECK_DIR/out"
			else
				echo "Linking failed: $binary_file" >> "$CHECK_DIR/error"
			fi
		else
			echo "No object files were produced; linking skipped." >> "$CHECK_DIR/error"
		fi
	fi
}

check-0300-cg3() {
	CHECK_DIR=$OUT_DIR/0300-cg3
	mkdir -p $CHECK_DIR

	find $WORKDIR -type d -printf '-O -I -O "%p" ' | xargs cg3 db clang-18 -R \
	-O -I/usr/include/SDL2 -O -I/usr/include/SDL3 -O -I/usr/include/SDL3_image -O -I/usr/include/SDL3_ttf \
	-O -D_REENTRANT	-O -DSDL_DISABLE_IMMINTRIN_H -O -DSDL_DISABLE_XMMINTRIN_H -O -DSDL_DISABLE_EMMINTRIN_H \
	-O -DSDL_DISABLE_PMMINTRIN_H -O -DSDL_DISABLE_MMINTRIN_H "$WORKDIR" > $CHECK_DIR/compile_commands.json

	cg3 check --complete -R -j $CHECK_DIR/report.json -f debugmalloc . > $CHECK_DIR/out 2> $CHECK_DIR/error
}

check-0400-cg() {
	CHECK_DIR=$OUT_DIR/0400-cg
	mkdir -p $CHECK_DIR
	cd $CHECK_DIR || exit

	find $WORKDIR -name "debugmalloc.h" -exec sh -c 'echo '' > "$1"' shell {} \;

	find $WORKDIR -name '*.c' -print0 -o -name '*.cpp' -print0 | xargs -0 php $TOOLS_DIR/callgraph.php > $CHECK_DIR/out 2> $CHECK_DIR/error

	if [ -e "output.svg" ]; then
		rsvg-convert -f pdf output.svg -o $CHECK_DIR/cg.pdf
	else
		echo "Output file doesn't exist." >> $CHECK_DIR/error
	fi
}

mkdir -p $WORKDIR
mkdir -p $OUT_DIR

check-0100-unzip
check-0110-sanity
check-0120-debugmalloc
check-0121-debugmalloc-replace
check-0200-compile
check-0300-cg3
check-0400-cg
