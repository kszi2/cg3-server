# Backend

The backend is a Go application built with Gin, GORM, and PostgreSQL. It exposes the HTTP API under `/api`, serves the frontend static files, stores check submissions in PostgreSQL, and uses RabbitMQ to queue check processing.

## Running facts

- The HTTP server listens on `SERVER_ADDRESS` and defaults to `0.0.0.0:8080`.
- Database schema migration is performed at startup with GORM's `AutoMigrate`.
- The backend connects to PostgreSQL using `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, and `DB_NAME`.
- Check source archives and result attachments are stored as PostgreSQL `bytea` values with `STORAGE EXTERNAL`.
- RabbitMQ is used for asynchronous check processing. Queue messages contain the numeric database ID of a run.
- The RabbitMQ queue is declared as a durable quorum queue.
- RabbitMQ connections and consumers automatically reconnect after connection loss.
- The frontend directory is read from `FRONTEND_DIR`, which defaults to `../frontend/dist`.

## Authentication

Authenticated endpoints expect an `Authorization` header containing a JWT:

```text
Authorization: Bearer <token>
```

JWTs contain the user ID, admin flag, and expiration time. The secret is configured with `JWT_SECRET`; expiration is configured in seconds with `JWT_EXPIRATION`.

Invalid or missing authorization headers return `400` with an error object. Authenticated non-admin users receive `403` from admin-only endpoints.

## Data Model

### User

- `id`: database ID
- `username`: unique username
- `password`: Argon2 password hash
- `displayName`: display name
- `admin`: administrator flag
- `createdAt`, `updatedAt`, `deletedAt`: GORM timestamps

### Student

- `id`: database ID
- `neptunHash`: student identifier
- `createdAt`, `updatedAt`, `deletedAt`: GORM timestamps

### CGRun

- `id`: database ID used in RabbitMQ messages
- `guestUpload`: whether the run was submitted through the student endpoint
- `source`: decoded ZIP archive
- `sourceMD5`: indexed MD5 hash used to detect duplicate uploads
- `runId`: public UUID
- `createdBy`: optional submitting user
- `studentId`: optional associated student
- `checkTime`: completion timestamp; `null` means the run is pending

### CheckResult

- `id`: database ID
- `check`: check name
- `result`: numeric check result
- `notes`: optional notes
- `attachment`: optional binary attachment
- `attachmentType`: optional attachment media type
- `runId`: owning run's database ID

## API

Successful endpoints return their documented JSON value. Errors use this shape:

```json
{
	"error": "error message"
}
```

### Response fields and nullability

Unless stated otherwise, fields below are present in the JSON response. A field described as nullable is returned as `null` when its value is unavailable; fields are not omitted by the response structs.

#### User objects

| Field         | Type    | Null           | Values                                        |
| ------------- | ------- | -------------- | --------------------------------------------- |
| `username`    | string  | No             | User's unique username.                       |
| `id`          | number  | No             | Database ID.                                  |
| `displayname` | string  | No             | User's display name.                          |
| `registered`  | string  | No             | RFC 3339 timestamp from `createdAt`.          |
| `admin`       | boolean | No             | `true` for administrators, otherwise `false`. |
| `token`       | string  | No, login only | Signed JWT returned by login.                 |

Password hashes are never included in user response objects.

#### Student objects

| Field        | Type   | Null | Values                                                                                |
| ------------ | ------ | ---- | ------------------------------------------------------------------------------------- |
| `id`         | number | No   | Database ID. This is returned by student-management and student-submission endpoints. |
| `neptunHash` | string | No   | Student's Neptun hash.                                                                |

Teacher run summaries contain a student object with only `neptunHash`; the `id` field is not serialized there. The student object itself can be `null` for a teacher run uploaded without `neptunHash`.

#### Run summary objects

| Field       | Type    | Null | Values                                                                                |
| ----------- | ------- | ---- | ------------------------------------------------------------------------------------- |
| `guest`     | boolean | No   | `true` for submissions through `/api/student/check`; `false` for teacher submissions. |
| `uuid`      | string  | No   | Public run UUID.                                                                      |
| `createdAt` | string  | No   | RFC 3339 creation timestamp.                                                          |
| `user`      | object  | Yes  | Submitting user. `null` when the run has no associated user.                          |
| `student`   | object  | Yes  | Associated student. `null` for teacher uploads without a Neptun hash.                 |
| `checkedAt` | string  | Yes  | RFC 3339 processing completion timestamp; `null` while pending.                       |

The `GET /api/teacher/check/student/:id` and `GET /api/teacher/check/all` responses are arrays of run summaries. Source data and attachments are not included.

#### Full run objects

Full teacher run responses contain all summary fields plus:

| Field          | Type   | Null | Values                                                                     |
| -------------- | ------ | ---- | -------------------------------------------------------------------------- |
| `source`       | string | No   | Base64-encoded ZIP source. The database source column is non-null.         |
| `checkResults` | array  | No   | Result objects; may be an empty array when no results have been generated. |

Each `checkResults` item contains:

| Field            | Type   | Null | Values                                                                     |
| ---------------- | ------ | ---- | -------------------------------------------------------------------------- |
| `check`          | string | No   | Check name.                                                                |
| `result`         | number | No   | Numeric check result; positive for success, negative for fail, 0 for skip. |
| `notes`          | string | Yes  | Check notes, or `null`.                                                    |
| `attachment`     | string | Yes  | Base64-encoded attachment, or `null`.                                      |
| `attachmentType` | string | Yes  | Attachment media type, or `null`.                                          |

Student full run responses omit `guest`, `uuid`, `user`, and `source`. They contain `createdAt`, `student`, `checkedAt`, and `checkResults`. The student object can be `null` according to the response model, although successful student uploads associate a student.

#### Status objects

| Field       | Type   | Null | Values                                         |
| ----------- | ------ | ---- | ---------------------------------------------- |
| `status`    | string | No   | `pending` or `done`                            |
| `checkedAt` | string | Yes  | Completion timestamp, or `null` while pending. |

#### Operation responses

Delete endpoints return `{ "status": "deleted" }`. Recheck returns `{ "status": "queued" }`. These `status` fields are non-null fixed strings.

### Teacher users

#### `POST /api/teacher/user/login`

Authenticate a user.

Request:

```json
{
	"username": "admin",
	"password": "Almafa12"
}
```

Response:

```json
{
	"username": "admin",
	"id": 1,
	"displayname": "Admin",
	"registered": "2026-03-02T07:05:42Z",
	"admin": true,
	"token": "<jwt>"
}
```

Invalid credentials return `401`.

#### `POST /api/teacher/user/create`

Create a user. Admin authentication is required.

Request:

```json
{
	"username": "teacher",
	"password": "password",
	"displayname": "Teacher",
	"admin": false
}
```

Returns the created user without the password. Duplicate usernames return `409`.

Response:

```json
{
	"username": "teacher",
	"id": 2,
	"displayname": "Teacher",
	"registered": "2026-09-24T09:00:00Z",
	"admin": false
}
```

#### `GET /api/teacher/user/me`

Return the currently authenticated user. Authentication is required.

Response:

```json
{
	"username": "teacher",
	"id": 2,
	"displayname": "Teacher",
	"registered": "2026-09-24T09:00:00Z",
	"admin": false
}
```

#### `PATCH /api/teacher/user/:id`

Modify a user by database ID. Admin authentication is required. All fields are optional:

```json
{
	"password": "new password",
	"displayname": "New display name",
	"admin": true
}
```

Response:

```json
{
	"username": "teacher",
	"id": 2,
	"displayname": "New display name",
	"registered": "2026-09-24T09:00:00Z",
	"admin": true
}
```

#### `GET /api/teacher/user/all`

Return all users without password hashes. Admin authentication is required.

Response:

```json
[
	{
		"username": "admin",
		"id": 1,
		"displayname": "Administrator",
		"registered": "2026-09-23T09:00:00Z",
		"admin": true
	},
	{
		"username": "teacher",
		"id": 2,
		"displayname": "Teacher",
		"registered": "2026-09-24T09:00:00Z",
		"admin": false
	}
]
```

### Teacher students

#### `POST /api/teacher/students`

Create students in a batch. Admin authentication is required.

Request:

```json
[{ "neptunHash": "ABC123" }, { "neptunHash": "DEF456" }]
```

The request must contain at least one student. Empty hashes, duplicate hashes within the request, and hashes already present in the database are rejected. Duplicate conflicts return `409`.

Response:

```json
[
	{
		"id": 1,
		"neptunHash": "ABC123"
	},
	{
		"id": 2,
		"neptunHash": "DEF456"
	}
]
```

#### `GET /api/teacher/students/all`

Return all students. Admin authentication is required.

Response:

```json
[
	{
		"id": 1,
		"neptunHash": "ABC123"
	}
]
```

#### `DELETE /api/teacher/students/:id`

Soft-delete a student by numeric database ID. The path parameter is not a Neptun hash. Admin authentication is required.

Response:

```json
{
	"status": "deleted"
}
```

### Teacher checks

#### `POST /api/teacher/check`

Submit a check source archive. Authentication is required.

Request:

```json
{
	"neptunHash": "ABC123",
	"source": "<base64-encoded ZIP>"
}
```

`neptunHash` is optional for teacher submissions. When provided, it must match an existing student. `source` is decoded and stored as binary data.

The decoded archive must:

- Be no larger than 1 MiB.
- Be a non-empty ZIP file.
- Expand to no more than 64 MiB.
- Have no entry with a compression ratio above 100:1.
- Successfully decompress all entries during validation.

The source MD5 is used to return an existing run instead of creating a duplicate. New runs are queued for asynchronous processing with priority `10`.

Response:

```json
{
	"guest": false,
	"uuid": "e2832166-8a57-47c4-9adc-595775ac12ad",
	"createdAt": "2026-09-24T10:00:00Z",
	"user": {
		"username": "teacher",
		"id": 1,
		"displayname": "Teacher",
		"registered": "2026-09-24T09:00:00Z",
		"admin": false
	},
	"student": {
		"neptunHash": "ABC123"
	},
	"checkedAt": null
}
```

#### `GET /api/teacher/check/student/:id`

Return summary results for all runs belonging to the student identified by Neptun hash. Authentication is required. Source archives and attachments are not returned.

Response:

```json
[
	{
		"guest": false,
		"uuid": "e2832166-8a57-47c4-9adc-595775ac12ad",
		"createdAt": "2026-09-24T10:00:00Z",
		"user": {
			"username": "teacher",
			"id": 2,
			"displayname": "Teacher",
			"registered": "2026-09-24T09:00:00Z",
			"admin": false
		},
		"student": {
			"neptunHash": "ABC123"
		},
		"checkedAt": "2026-09-24T10:02:00Z"
	}
]
```

#### `GET /api/teacher/check/all`

Return summary results for all runs. Admin authentication is required. Source archives and attachments are not returned.

Response:

The response has the same array shape as `GET /api/teacher/check/student/:id`.

#### `GET /api/teacher/check/:id`

Return a full run by public UUID. Authentication is required. The response includes source and result attachments as base64 strings.

Response:

```json
{
	"guest": false,
	"uuid": "e2832166-8a57-47c4-9adc-595775ac12ad",
	"createdAt": "2026-09-24T10:00:00Z",
	"user": {
		"username": "teacher",
		"id": 2,
		"displayname": "Teacher",
		"registered": "2026-09-24T09:00:00Z",
		"admin": false
	},
	"student": {
		"neptunHash": "ABC123"
	},
	"checkedAt": "2026-09-24T10:02:00Z",
	"source": "<base64-encoded ZIP>",
	"checkResults": [
		{
			"check": "example-check",
			"result": 1,
			"notes": null,
			"attachment": "<base64-encoded attachment>",
			"attachmentType": "text/plain"
		}
	]
}
```

#### `GET /api/teacher/check/:id/status`

Return the processing status of a run by public UUID. Authentication is required.

Response while queued:

```json
{
	"status": "pending",
	"checkedAt": null
}
```

Response after processing:

```json
{
	"status": "done",
	"checkedAt": "2026-09-24T10:02:00Z"
}
```

#### `POST /api/teacher/check/:id/recheck`

Queue an existing run for processing again by public UUID. Authentication is required. The run is marked pending before its database ID is sent to RabbitMQ.

Response:

```json
{
	"status": "queued"
}
```

#### `DELETE /api/teacher/check/:id`

Delete a run by public UUID. Admin authentication is required. The run is soft-deleted. The endpoint returns:

```json
{
	"status": "deleted"
}
```

### Student checks

Student submissions and result lookup use the `/api/student/check` namespace.

#### `POST /api/student/check`

Submit a check source archive for a known student. This endpoint does not validate a JWT.

Request:

```json
{
	"neptunHash": "ABC123",
	"source": "<base64-encoded ZIP>"
}
```

Unlike teacher submissions, `neptunHash` is required. The same ZIP size, ZIP-bomb, and duplicate-source validation applies. New runs are queued with priority `0`.

Response:

```json
{
	"uuid": "e2832166-8a57-47c4-9adc-595775ac12ad",
	"createdAt": "2026-09-24T10:00:00Z",
	"student": {
		"id": 1,
		"neptunHash": "ABC123"
	}
}
```

#### `GET /api/student/check/:id`

Return a run and its check results by public UUID. This endpoint does not validate a JWT.

Response:

```json
{
	"createdAt": "2026-09-24T10:00:00Z",
	"student": {
		"id": 1,
		"neptunHash": "ABC123"
	},
	"checkedAt": "2026-09-24T10:02:00Z",
	"checkResults": [
		{
			"check": "example-check",
			"result": 1,
			"notes": null,
			"attachment": "<base64-encoded attachment>",
			"attachmentType": "text/plain"
		}
	]
}
```

#### `GET /api/student/check:id/status`

Return the run status by public UUID. This is the path currently registered by the backend. The likely intended path is `/api/student/check/:id/status`; the student handler currently omits the slash before `:id`. This endpoint does not validate a JWT.

Response while queued:

```json
{
	"status": "pending",
	"checkedAt": null
}
```

Response after processing:

```json
{
	"status": "done",
	"checkedAt": "2026-09-24T10:02:00Z"
}
```

## Environment variables

| Variable         | Default            | Purpose                                                                  |
| ---------------- | ------------------ | ------------------------------------------------------------------------ |
| `PROD`           | unset              | When `true` or `1`, missing environment variables terminate the process. |
| `GIN_MODE`       | Gin default        | Gin runtime mode.                                                        |
| `DB_HOST`        | `localhost`        | PostgreSQL host.                                                         |
| `DB_PORT`        | `5432`             | PostgreSQL port.                                                         |
| `DB_USER`        | `gorm`             | PostgreSQL user.                                                         |
| `DB_PASS`        | `gorm`             | PostgreSQL password.                                                     |
| `DB_NAME`        | `gorm`             | PostgreSQL database name.                                                |
| `SERVER_ADDRESS` | `0.0.0.0:8080`     | HTTP listen address.                                                     |
| `FRONTEND_DIR`   | `../frontend/dist` | Directory for frontend static files.                                     |
| `JWT_SECRET`     | `Almafa12`         | JWT signing secret.                                                      |
| `JWT_EXPIRATION` | `1800`             | JWT lifetime in seconds.                                                 |
| `RABBITMQ_USER`  | `rabbit`           | RabbitMQ username.                                                       |
| `RABBITMQ_PASS`  | `rabbit`           | RabbitMQ password.                                                       |
| `RABBITMQ_HOST`  | `localhost`        | RabbitMQ host.                                                           |
| `RABBITMQ_PORT`  | `5672`             | RabbitMQ AMQP port.                                                      |
| `RABBITMQ_QUEUE` | `check`            | RabbitMQ queue name.                                                     |

## Error responses

Most handlers return an object containing an `error` field. Common status codes are:

- `400`: malformed JSON, invalid authorization header, invalid JWT, invalid UUID, invalid base64, or invalid ZIP.
- `401`: invalid username or password.
- `403`: authentication succeeded but the user is not an administrator.
- `404`: requested user, student, or run does not exist.
- `409`: duplicate username or student.
- `413`: decoded check source exceeds 1 MiB.
- `500`: database, queue, or other internal failure.
