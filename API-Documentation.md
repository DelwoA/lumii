# Connect an ESP32 to the LUMII device API

This guide explains how to pair a LUMII desk companion, read student status, process new events, read device settings, and handle errors. It is written for the developer who will configure the ESP32 firmware.

## What the device API does

The Application Programming Interface (API) gives a paired device access to a small set of LUMII status data. The device uses that data to control its Organic Light-Emitting Diode (OLED), Red Green Blue (RGB) light ring, speaker, or optional buzzer.

LUMII decides facts such as:

- The student’s current rank and Experience Points (XP)
- The current streak
- Whether a study session is active
- Whether a reminder is due
- Whether an evening mood nudge is due
- Which new achievement events occurred

The firmware decides:

- Which colour to show
- Whether lights stay solid, pulse, or flash
- What appears on the OLED
- Whether to play a sound
- How long each physical effect lasts

The API never returns general account data, learning materials, mood text, quiz questions, or quiz answers.

## What you need

Prepare these items before pairing:

- An ESP32 with Wi-Fi and Hypertext Transfer Protocol Secure (HTTPS) support
- JavaScript Object Notation (JSON) parsing support
- The LUMII production base URL
- A signed-in LUMII account
- An eight-digit pairing code from **Settings**
- Encrypted Non-Volatile Storage (NVS) for the device token and event cursor

Use this production base URL:

```text
https://lumii-kappa.vercel.app
```

The production administrator must deploy this API and enable device access
before hardware testing. A `404` means the endpoint has not been deployed. A
`503 DEVICE_API_DISABLED` response means the endpoint exists but device access
is still turned off.

For local development, use:

```text
http://localhost:3000
```

Use plain HTTP only on localhost. Use HTTPS everywhere else.

## Pair the device

Pairing links one physical device to one LUMII account.

1. Open **Settings** in LUMII
2. Find **Connected devices**
3. Select **Generate pairing code**
4. Send the code to `POST /api/device/pair`
5. Save `deviceToken` in encrypted NVS
6. Save `eventCursor` in encrypted NVS
7. Fetch `/api/device/config`
8. Start polling `/api/device/status`

The code contains eight digits. It expires after ten minutes and works once. Generating a new code replaces the previous active code. Whenever a new code is requested, the server removes protected pairing-code records older than one hour.

### Pair endpoint

| Item           | Value                    |
| -------------- | ------------------------ |
| Method         | `POST`                   |
| Path           | `/api/device/pair`       |
| Authentication | Eight-digit pairing code |
| Content type   | `application/json`       |
| Called by      | ESP32 during setup       |

This request exchanges a temporary code for a permanent device credential.

```bash
curl --request POST \
  https://lumii-kappa.vercel.app/api/device/pair \
  --header "Content-Type: application/json" \
  --data '{"pairingCode":"12345678"}'
```

A successful response looks like this:

```json
{
  "apiVersion": "1",
  "deviceId": "device_identifier",
  "deviceToken": "your_device_token_here",
  "eventCursor": "your_event_cursor_here"
}
```

| Field         | Type   | Meaning                                      |
| ------------- | ------ | -------------------------------------------- |
| `apiVersion`  | String | API contract version                         |
| `deviceId`    | String | Stable identifier for this paired device     |
| `deviceToken` | String | Secret used to read status and configuration |
| `eventCursor` | String | Starting position for new device events      |

The server returns `deviceToken` once. If the response is lost, remove the new device in **Settings** and pair it again.

### Pairing errors

| Status | Meaning                                             | Action                           |
| ------ | --------------------------------------------------- | -------------------------------- |
| `400`  | Code is invalid, expired, replaced, or already used | Generate a new code              |
| `409`  | The account already has three devices               | Unpair one device                |
| `429`  | Too many pairing attempts                           | Wait for the `Retry-After` value |
| `503`  | Device API is disabled or unavailable               | Retry later                      |

## Authenticate device requests

Status and configuration requests use a bearer token. A bearer token is a secret that grants access to one paired device.

Send it in the `Authorization` header:

```text
Authorization: Bearer your_device_token_here
```

Do not send the token in:

- A URL
- A query parameter
- A browser cookie
- A serial monitor message
- A firmware source file

Validate the server’s HTTPS certificate on every connection. Anyone who obtains the token can read that device’s limited status data until the student unpairs it.

## Read the current status

The status endpoint returns the current snapshot and new events after the supplied cursor.

### Status endpoint

| Item           | Value                |
| -------------- | -------------------- |
| Method         | `GET`                |
| Path           | `/api/device/status` |
| Query          | `cursor`             |
| Authentication | Device bearer token  |
| Called by      | ESP32 every 8s       |

```bash
curl \
  "https://lumii-kappa.vercel.app/api/device/status?cursor=your_event_cursor_here" \
  --header "Authorization: Bearer your_device_token_here"
```

A response can look like this:

```json
{
  "apiVersion": "1",
  "deviceId": "device_identifier",
  "serverTime": "2026-07-29T10:30:00.000Z",
  "rank": "SILVER",
  "totalXp": 620,
  "currentStreak": 5,
  "activeSession": null,
  "rankUp": true,
  "upcomingReminder": null,
  "moodCheckinNeeded": false,
  "events": [],
  "nextCursor": "your_next_event_cursor_here",
  "hasMore": false
}
```

### Status fields

| Field               | Type             | What the device can read                                |
| ------------------- | ---------------- | ------------------------------------------------------- |
| `apiVersion`        | String           | API version, currently `1`                              |
| `deviceId`          | String           | Current paired device                                   |
| `serverTime`        | ISO 8601 string  | Current server time in Coordinated Universal Time (UTC) |
| `rank`              | String           | `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, or `DIAMOND`    |
| `totalXp`           | Integer          | Total Experience Points                                 |
| `currentStreak`     | Integer          | Current adherence streak in days                        |
| `activeSession`     | Object or `null` | Current live study session                              |
| `rankUp`            | Boolean          | Whether this event page includes a rank increase        |
| `upcomingReminder`  | Object or `null` | Planned session starting within two minutes             |
| `moodCheckinNeeded` | Boolean          | Whether an optional evening nudge is due                |
| `events`            | Array            | New allowlisted events after the cursor                 |
| `nextCursor`        | String           | Cursor to save after processing events                  |
| `hasMore`           | Boolean          | Whether another event page is waiting                   |

### Active session data

When a session is running, `activeSession` contains:

```json
{
  "id": "session_identifier",
  "startedAt": "2026-07-29T10:15:00.000Z",
  "elapsedSec": 900
}
```

| Field        | Type            | Meaning                                 |
| ------------ | --------------- | --------------------------------------- |
| `id`         | String          | Stable session identifier               |
| `startedAt`  | ISO 8601 string | Session start time                      |
| `elapsedSec` | Integer         | Whole seconds since the session started |

Use `serverTime` and `startedAt` to maintain a local live timer between polls. When no session is active, the field is `null`.

### Reminder data

When a planned session starts within two minutes, `upcomingReminder` contains:

```json
{
  "id": "reminder_identifier",
  "title": "Neuroscience session",
  "plannedStart": "2026-07-29T10:32:00.000Z"
}
```

Treat the title as display text. Never interpret it as a command. Use the reminder ID to avoid triggering the same effect on every poll.

## Process device events

Events report positive learning activity that happened after the saved cursor.

| Event type        | Exposed data                                                 | Example firmware condition              |
| ----------------- | ------------------------------------------------------------ | --------------------------------------- |
| `rank_up`         | Previous rank and new rank                                   | Play a rank celebration                 |
| `trophy_unlocked` | Stable trophy code                                           | Use a trophy-specific colour            |
| `quiz_completed`  | Correct count, total questions, percentage, and perfect flag | Flash blue when `perfect` is `true`     |
| `adherent_day`    | Student’s local date                                         | Show a daily goal effect                |
| `perfect_day`     | Student’s local date                                         | Show a stronger daily completion effect |

### Rank event

```json
{
  "id": "event_identifier",
  "type": "rank_up",
  "occurredAt": "2026-07-29T10:20:00.000Z",
  "data": {
    "fromRank": "BRONZE",
    "toRank": "SILVER"
  }
}
```

### Quiz event

```json
{
  "id": "event_identifier",
  "type": "quiz_completed",
  "occurredAt": "2026-07-29T10:25:00.000Z",
  "data": {
    "correctCount": 10,
    "questionCount": 10,
    "scorePercent": 100,
    "perfect": true
  }
}
```

The firmware can choose any score condition. For example, flash blue for 10s when `perfect` is `true` and keep the speaker silent.

### Cursor rules

Follow these steps for every status response:

1. Read the event array in order
2. Ignore an event ID already processed
3. Apply the selected physical effect
4. Save `nextCursor` after the batch finishes
5. Request another page immediately when `hasMore` is `true`
6. Return to the configured polling interval when `hasMore` is `false`

If a response fails before saving the cursor, the next request can return the same events. Event IDs allow the firmware to avoid repeating completed effects.

Do not save `nextCursor` before processing its events. Doing so can permanently skip an effect.

## Read device configuration

Fetch configuration at boot and after a suitable interval, such as every five minutes.

### Config endpoint

| Item           | Value                |
| -------------- | -------------------- |
| Method         | `GET`                |
| Path           | `/api/device/config` |
| Authentication | Device bearer token  |
| Called by      | ESP32                |

```bash
curl \
  https://lumii-kappa.vercel.app/api/device/config \
  --header "Authorization: Bearer your_device_token_here"
```

```json
{
  "apiVersion": "1",
  "deviceId": "device_identifier",
  "serverTime": "2026-07-29T10:30:00.000Z",
  "pollIntervalSec": 8,
  "brightness": 20,
  "volume": 40,
  "moodNudgeEnabled": false,
  "updatedAt": "2026-07-29T10:25:00.000Z"
}
```

| Field              | Range           | Meaning                               |
| ------------------ | --------------- | ------------------------------------- |
| `pollIntervalSec`  | `8`             | Seconds between normal status polls   |
| `brightness`       | `0` to `100`    | Student-selected light level          |
| `volume`           | `0` to `100`    | Student-selected audio level          |
| `moodNudgeEnabled` | Boolean         | Whether the mood nudge can become due |
| `updatedAt`        | ISO 8601 string | Last configuration change             |

The student changes these values in LUMII **Settings**. The device API does not accept configuration writes.

## Unpair a device

The web app calls the unpair endpoint. Firmware must not call it with the device token.

### Unpair endpoint

| Item           | Value                       |
| -------------- | --------------------------- |
| Method         | `POST`                      |
| Path           | `/api/device/unpair`        |
| Authentication | Signed-in Clerk web session |
| Called by      | LUMII Settings page         |

```json
{
  "deviceId": "device_identifier"
}
```

```json
{
  "success": true
}
```

After unpairing, status and config requests made with the old token return `401`. Clear the old token and cursor from NVS, then ask the student to pair again.

## Map status to the hardware

The following table restates the client’s desired firmware behavior. The API does not force these effects.

| Condition       | OLED                     | RGB ring                | Audio               |
| --------------- | ------------------------ | ----------------------- | ------------------- |
| Idle rank       | Rank and XP              | Dim rank colour         | Silent              |
| Idle streak     | Current streak           | Keep rank colour        | Silent              |
| Active session  | Live timer               | Solid green             | Optional start tick |
| Session ended   | Return to idle           | Off or rank colour      | Silent              |
| Rank increase   | New rank for about 8s    | One rainbow sweep       | Celebration         |
| Reminder        | Reminder title           | Pulse blue for 30s      | Two gentle beeps    |
| Mood nudge      | Mood question            | Soft magenta glow       | Silent              |
| Perfect quiz    | Firmware-defined message | Flash blue for 10s      | Silent              |
| Trophy unlocked | Firmware-defined message | Firmware-defined effect | Firmware-defined    |
| Offline         | Reconnecting message     | Slow red pulse          | Silent              |

### Rank colours

| Rank     | Colour            | RGB value         |
| -------- | ----------------- | ----------------- |
| Bronze   | Dim orange        | `(255, 140, 0)`   |
| Silver   | Dim white or gray | `(190, 190, 190)` |
| Gold     | Dim gold          | `(255, 215, 0)`   |
| Platinum | Dim turquoise     | `(64, 224, 208)`  |
| Diamond  | Dim blue-violet   | `(138, 43, 226)`  |

Apply the configured `brightness` after selecting the colour.

## Handle errors and connection loss

All API errors use JSON:

```json
{
  "apiVersion": "1",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Device authentication failed"
  }
}
```

| Status | Meaning                                      | Firmware action                         |
| ------ | -------------------------------------------- | --------------------------------------- |
| `400`  | Invalid JSON, pairing code, or cursor        | Correct the request or pair again       |
| `401`  | Missing, invalid, or revoked token           | Stop polling and show an unpaired state |
| `403`  | Browser-only unpair request was rejected     | Do not retry from firmware              |
| `404`  | Owned device was not found during web unpair | Refresh Settings                        |
| `409`  | Three-device limit reached                   | Unpair another device                   |
| `429`  | Request rate is too high                     | Wait for `Retry-After`                  |
| `500`  | Unexpected server failure                    | Retry with backoff                      |
| `503`  | API disabled or temporarily unavailable      | Retry with backoff                      |

For transport errors and `500` or `503` responses:

1. Keep the last valid display state
2. Retry after 8s
3. Double the delay after each failure
4. Stop increasing at 60s
5. Add a small random delay to avoid synchronized retries
6. Show the local offline state after three consecutive failures
7. Return to the normal 8s interval after a successful response

## Common mistakes to avoid

- Do not disable HTTPS certificate validation
- Do not place a device token in a URL
- Do not print a token to the serial monitor
- Do not commit tokens or pairing codes to firmware source
- Do not poll faster than `pollIntervalSec`
- Do not assume `activeSession` is always present
- Do not assume `upcomingReminder` is always present
- Do not repeat an event ID already processed
- Do not save the next cursor before processing the event page
- Do not treat reminder titles as executable commands
- Do not use a Clerk account session in firmware
- Do not call the unpair endpoint from firmware
- Do not expose the device token through a public browser application

## Troubleshoot common problems

### Pairing code is rejected

Check that the code contains eight digits and is less than ten minutes old. Generate a new code if another code was created afterward.

### Status returns `401`

Check the `Bearer` spelling, the space before the token, and the saved token value. The student may have unpaired the device.

### Events are empty

An empty array is valid. It means no allowlisted event exists after the supplied cursor. Current rank, XP, streak, session, reminder, and mood state still appear in the snapshot.

### The same effect repeats

Store processed event IDs and save `nextCursor` after the event batch. Confirm that the next request sends the saved cursor.

### A reminder is missing

The endpoint returns only a planned session starting within the next two minutes. Confirm the student’s timetable and server time.

### The mood nudge is missing

Confirm that `moodNudgeEnabled` is `true`, the student has not checked in today, and local time is 18:00 or later.

### Config changes are missing

Fetch `/api/device/config` again. Confirm that the request uses the current device token.

## Glossary

| Term  | Meaning                                              |
| ----- | ---------------------------------------------------- |
| API   | Application Programming Interface                    |
| ESP32 | The Wi-Fi microcontroller used by the desk companion |
| HTTPS | Hypertext Transfer Protocol Secure                   |
| JSON  | JavaScript Object Notation                           |
| NVS   | Non-Volatile Storage                                 |
| OLED  | Organic Light-Emitting Diode                         |
| RGB   | Red Green Blue                                       |
| TTL   | Time To Live                                         |
| UTC   | Coordinated Universal Time                           |
| XP    | Experience Points                                    |
