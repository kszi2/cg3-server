# Worker and checker

The worker is a background Go service that consumes check requests from RabbitMQ, runs the configured checker container, and stores the resulting check data in PostgreSQL.

The checker is a separate container image used by the worker. It contains the CG3 analysis environment and the project's check script.

## Worker

The worker:

- Connects to PostgreSQL without running schema migrations.
- Connects to the RabbitMQ quorum queue configured by `RABBITMQ_QUEUE`.
- Consumes messages containing a run's numeric database ID.
- Runs each check with a 120-second timeout.
- Stores the generated check results in PostgreSQL.
- Automatically reconnects to RabbitMQ after connection loss.

The worker does not expose an HTTP port and does not require frontend configuration.

### Requirements

The worker requires:

- Access to the same PostgreSQL database as the backend.
- Access to the same RabbitMQ queue as the backend.
- Access to a Docker daemon, because each check is executed in a separate container.
- The checker image configured by `CG3_DOCKER_IMAGE`.

When running the worker in a container, the Docker API socket or another Docker endpoint must be made available to the worker. The worker uses the Docker client's environment-based configuration.

### Environment variables

The worker uses the database and RabbitMQ variables below. Missing variables use the listed defaults unless `PROD` is set to `true` or `1`; in production mode, missing variables terminate the process.

| Variable           | Default                 | Purpose                                               |
| ------------------ | ----------------------- | ----------------------------------------------------- |
| `PROD`             | unset                   | Makes missing configuration fatal when `true` or `1`. |
| `DB_HOST`          | `localhost`             | PostgreSQL host.                                      |
| `DB_PORT`          | `5432`                  | PostgreSQL port.                                      |
| `DB_USER`          | `gorm`                  | PostgreSQL user.                                      |
| `DB_PASS`          | `gorm`                  | PostgreSQL password.                                  |
| `DB_NAME`          | `gorm`                  | PostgreSQL database name.                             |
| `RABBITMQ_USER`    | `rabbit`                | RabbitMQ username.                                    |
| `RABBITMQ_PASS`    | `rabbit`                | RabbitMQ password.                                    |
| `RABBITMQ_HOST`    | `localhost`             | RabbitMQ host.                                        |
| `RABBITMQ_PORT`    | `5672`                  | RabbitMQ AMQP port.                                   |
| `RABBITMQ_QUEUE`   | `check`                 | Queue consumed by the worker.                         |
| `CG3_DOCKER_IMAGE` | `kisbogdan/cg3-checker` | Checker image launched for each run.                  |

### Queue messages

The message body is the decimal numeric database ID of a `CGRun`:

```text
42
```

The backend publishes teacher submissions with priority `10` and student submissions with priority `0`.

## Checker container

The checker image is based on the [CG3 project](https://github.com/bodand/cg3). It provides the CG3 analysis tools and the dependencies needed to compile and analyze C/C++ submissions.

The image also includes:

- SDL2 and SDL3 development libraries.
- GCC.
- Graphviz.
- PHP.
- `rsvg-convert`.
- `unzip`.
- The project's `callgraph.php` and `debugmalloc.h` tools.

The container entrypoint is `/cg3/cg.sh`.

### Checker input and output

The worker creates a temporary checker container with:

- `/cg3/input.zip`: the submitted ZIP archive.
- `/cg3/work`: extracted submission files.
- `/cg3/out`: check output files.

The checker script writes one directory per check under `/cg3/out`, including `out` and `error` files where applicable. The worker reads the output directory after the container exits and stores the resulting checks in PostgreSQL.

The checker container is run with these restrictions:

- No network access.
- 1 GiB memory limit.
- 2 CPU limit.
- Maximum 50 processes.
- All Linux capabilities dropped.
- Temporary containers are removed after processing.

### Checks performed

The checker currently performs these high-level checks:

1. Extract the ZIP archive.
2. Check basic submission contents, including PDF, C, H, and `debugmalloc.h` files.
3. Validate and replace `debugmalloc.h` with the known-good version.
4. Compile and link C sources with the configured SDL libraries.
5. Run CG3 analysis and produce a JSON report.
6. Generate a call graph and convert it to PDF when possible.

Individual check output is kept under its numbered output directory, such as `/cg3/out/0110-sanity` or `/cg3/out/0300-cg3`.

## Building the checker image

The checker image is built with `Dockerfile-checker`. Its base image is the CG3 image from the [bodand/cg3 project](https://github.com/bodand/cg3).

From the repository root:

```bash
docker build -f Dockerfile-checker -t kisbogdan/cg3-checker:latest .
```

The resulting image must be available to the worker's Docker daemon. Configure a different image name or tag with `CG3_DOCKER_IMAGE`.
