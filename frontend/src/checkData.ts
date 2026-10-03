export type CheckDefinition = {
	name: string;
	help: string;
};

export const checkDefinitions: CheckDefinition[] = [
	{ name: 'unzip', help: 'Opens and extracts the submitted ZIP archive. The archive must be valid and safely decompressible.' },
	{ name: 'sanity', help: 'Checks that the archive contains at least 1 PDF, 2 C source files, 2 header files, and 1 debugmalloc.h file.' },
	{
		name: 'compile',
		help: 'Compiles the program with GCC using -Wall, -Wextra, -Wpedantic, and -Wvla. SDL2 or SDL3 headers must be included, and supported SDL libraries are linked.'
	},
	{
		name: 'debugmalloc',
		help: 'Compares every included debugmalloc.h with the provided InfoC reference. A mismatch is reported, and the checker can replace it for later checks.'
	},
	{ name: 'cg3-complete', help: 'Runs the complete CG3 static-analysis set, including arityck, bugmalloc, chonktion, fio, fleak, globus, hunction, and t.' },
	{ name: 'cg3-arityck', help: 'Lists functions with suspiciously many parameters. Currently, functions with 5 or more parameters are reported.' },
	{
		name: 'cg3-bugmalloc',
		help: 'Finds allocation calls that do not go through debugmalloc.h, including malloc, calloc, realloc, free, strdup, and related allocation APIs.'
	},
	{
		name: 'cg3-chonktion',
		help: 'Finds functions that are probably larger than necessary. It reports functions with at least 64, 128, or 256 instructions.'
	},
	{ name: 'cg3-fio', help: 'Lists file operations found in the source code. This check reports operations rather than judging them as errors.' },
	{
		name: 'cg3-fleak',
		help: 'Looks for likely file-handle leaks, such as functions that obtain a FILE pointer but neither close it nor pass responsibility onward.'
	},
	{ name: 'cg3-globus', help: 'Checks whether the program contains global variables.' },
	{ name: 'cg3-hunction', help: 'Collects functions defined in header files.' },
	{ name: 'cg3-t', help: 'Runs the additional CG3 t analysis check.' },
	{ name: 'cg', help: 'Creates a call graph from the functions in the program.' }
];
