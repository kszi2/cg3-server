# Basics of Programming 1 homework static checker

## What is this?

This is a program that started out simple but has grown rather complicated. It tries to provide plenty of help for Prog 1 homework using various static analysis tools.

### Where did the name come from?

TL;DR: cg = call graph, meaning the program was originally intended to generate a call graph, and this is already its third version.

## How to use it

1. Upload a ZIP file on the 'Checks' page
2. Enter your Neptun code
3. Click the upload button
4. Wait for the check to finish, which ideally takes 5–10 seconds. The page automatically retries every 5 seconds while it is running, so please do not spam the reload button.
5. Analyze the results

You can use the program as a student too; in fact, it is recommended that you upload your homework here before submitting it, because the system can filter out quite a few errors.

The program primarily expects ZIP files that meet the requirements of Prog 1, with the following restrictions:

- the ZIP may be at most 1 MiB
- it must not contain files indicating a ZIP bomb
- it must contain C source code
- it must contain at least 2 C files, 2 H files, 1 PDF file, and debugmalloc

After uploading, the program redirects you to the results page. If you want to view your result later, it is recommended that you save the URL. If you upload the same ZIP again, you will optionally receive the result of the original run, because the system analyzes the same ZIP only once.

Please do not upload the program after every change, because the server has a strictly limited amount of storage, and I do not want to install more SSDs in it because they are expensive.

### Neptun codes

The program uses your Neptun code only to accept uploads from students who currently attend (or previously attended) Prog 1, in order to prevent overload attacks. The Neptun code is not stored, only its hash. Even during upload, only the hashed version of your Neptun code leaves your browser. The six-character “value” shown in the evaluation is the first 6 characters of the hash.

Although the hash can be reversed, it is unlikely that anyone would do so, since there is not much point and it is not possible to extract much useful information from it. There are much simpler ways to obtain people's Neptun codes.

## Checks

The program runs quite a few checks, and they may depend on one another; if one fails, the others may not run either.

A failed check by itself does not mean that you will fail the course; it only indicates that something may potentially be wrong with the program. For example, even if globus reports an issue, the program may still be accepted if the global variable is not the program's essential data structure. However, if bugmalloc reports an issue, that almost certainly means failure.

### unzip

Opens and extracts the submitted ZIP archive. The archive must be valid and safe to extract.

### sanity

Checks whether the archive contains at least 1 PDF, 2 C source files, 2 header files, and 1 debugmalloc.h file.

### compile

Compiles the program with GCC using the `-Wall`, `-Wextra`, `-Wpedantic`, and `-Wvla` flags. SDL2 or SDL3 headers must be present, and the supported SDL libraries are linked.

### debugmalloc

Compares every included debugmalloc.h file with the specified InfoC reference. It reports differences and may replace the file for subsequent checks.

### cg3-complete

Runs the complete CG3 static analysis suite, including the arityck, bugmalloc, chonktion, fio, fleak, globus, hunction, and t checks.

### cg3-arityck

Lists functions with a suspiciously large number of parameters. It currently reports functions with at least 5 parameters.

### cg3-bugmalloc

Looks for memory allocation calls that do not go through debugmalloc.h, such as malloc, calloc, realloc, free, and strdup.

### cg3-chonktion

Looks for functions that are probably unnecessarily large. It reports functions containing at least 64, 128, or 256 statements.

### cg3-fio

Lists file operations found in the source code. This check reports the operations; it does not judge them as incorrect.

### cg3-fleak

Looks for probable file handle leaks, for example when a function receives a FILE pointer but does not close it or return it.

### cg3-globus

Checks whether the program contains global variables.

### cg3-hunction

Collects functions defined in header files.

### cg3-t

Surely very useful.

### cg

Creates a call graph from the program's functions. You can read more about analyzing call graphs [here](https://github.com/czirkoszoltan/call-graph-generator).

## Other useful things

### CG3-server

CG3-server is the web framework for running the various tests.

Developed by [Kolos Kis-Bogdán](https://pek.sch.bme.hu/profiles/kisbogdan)

[GitHub repository](https://github.com/kszi2/cg3-server)

Report bugs through [GitHub issues](https://github.com/kszi2/cg3-server/issues).

### CG3

This is the static code analysis tool itself.

Developed by [bodand](https://github.com/bodand/cg3)

[GitHub repository](https://github.com/bodand/cg3)

### Debugmalloc

Hopefully this does not need an introduction.

[Original version](https://github.com/czirkoszoltan/debugmalloc)

[Version used in the course](https://infoc.eet.bme.hu/debugmalloc/debugmalloc.h)

### Call graph generator

This was originally intended to be CGn (1 <= n >= 2), but the program currently still uses the original version written by Zoltán Czirkos. More precisely, a slightly modified version that also handles includes correctly.

[GitHub repository](https://github.com/czirkoszoltan/call-graph-generator)

### Where does it run?

It currently runs on an old computer somewhere in Schönherz. I will not give more information, because someone might eventually try to shut it down in anger. The server has a very limited amount of storage, so please do not upload programs for checking after every modification.
