# LUMII device API test report

Test date: 29 July 2026

## Result

The device API passed its automated, database, build, and browser tests.

The full local flow worked:

1. Generate a pairing code in LUMII Settings
2. Exchange the code for a device token and event cursor
3. Read device configuration
4. Poll the current student status
5. Read two pages containing 26 events
6. Save device settings in the web app
7. Read the new settings through the device API
8. Unpair the device
9. Confirm that the old token stops working

No device token, pairing code, event cursor, account credential, quiz content, mood text, learning material, or private profile field is stored in this report.

## Environments tested

| Part            | Environment                               |
| --------------- | ----------------------------------------- |
| Application     | Local Next.js development server          |
| Browser         | Chrome controlled through Chrome DevTools |
| Database        | Connected Neon PostgreSQL database        |
| Authentication  | Dedicated Clerk test account              |
| Device API flag | Enabled only for the local test process   |

The database migration `20260729010000_iot_device_api` was applied successfully.

## Automated checks

| Check                       | Result                        |
| --------------------------- | ----------------------------- |
| TypeScript                  | Passed                        |
| ESLint                      | Passed                        |
| Vitest                      | 26 files and 153 tests passed |
| Next.js production build    | Passed                        |
| Prisma client generation    | Passed                        |
| Prisma migration deployment | Passed                        |
| OpenAPI JSON parsing        | Passed                        |
| Neon retention boundary     | Passed                        |

The automated tests cover:

- Credential hashing and domain separation
- Secure random device tokens and pairing codes
- One-hour pairing-code retention and cleanup boundaries
- Signed event cursor creation and tamper rejection
- Cursor clamping to the device pairing time
- Reminder title cleaning
- Event allowlisting and private data removal
- Quiz score and perfect-score projection
- Bearer token parsing
- Small JSON request limits
- Private no-store response headers
- Pairing request validation
- Pairing throttling responses
- Missing and revoked token responses
- Invalid cursor responses
- Public status projection
- Public config projection
- Owner-only unpairing

The live Neon retention check inserted two temporary tagged records. The record
older than one hour was deleted, while the record inside the one-hour window was
retained. Both temporary records were removed after the assertion.

After the retention change, Chrome repeated the complete pairing regression:
generate a code in Settings, pair a device, read config and status, reject reuse
of the consumed code, refresh the connected-device list, unpair the device, and
reject the old token with `401 UNAUTHORIZED`. A tagged stale pairing row was
inserted before code generation and the normal generation request deleted it,
which verified that the cleanup is connected to the real UI and service flow.

## Browser API results

### Pair

`POST /api/device/pair`

| Check                         | Result                         |
| ----------------------------- | ------------------------------ |
| Valid one-time code           | `200`                          |
| API version returned          | `1`                            |
| Device ID returned            | Yes                            |
| Device token returned once    | Yes                            |
| Initial event cursor returned | Yes                            |
| Cache policy                  | `private, no-store, max-age=0` |
| Reusing the code              | `400 INVALID_PAIRING_CODE`     |

### Config

`GET /api/device/config`

| Check                         | Result                         |
| ----------------------------- | ------------------------------ |
| Valid device token            | `200`                          |
| Poll interval                 | 8 seconds                      |
| Default brightness            | 20                             |
| Default volume                | 40                             |
| Default mood nudge            | Off                            |
| Updated brightness            | 74                             |
| Updated volume                | 18                             |
| Updated mood nudge            | On                             |
| Token or token digest exposed | No                             |
| Cache policy                  | `private, no-store, max-age=0` |

### Status

`GET /api/device/status`

The seeded status response contained:

| Field             | Observed result                      |
| ----------------- | ------------------------------------ |
| Rank              | `GOLD`                               |
| Total XP          | Integer value returned               |
| Current streak    | Integer value returned               |
| Active session    | ID, start time, and elapsed seconds  |
| Upcoming reminder | ID, cleaned title, and planned start |
| Mood nudge        | Boolean value                        |
| Rank-up flag      | `true` when a rank event was present |

The first event page returned 20 events and `hasMore: true`. The second page returned 6 events and `hasMore: false`.

The two pages contained 26 unique event IDs with no duplicates. A third request with the saved cursor returned zero events and the same cursor.

Observed event types:

- `rank_up`
- `trophy_unlocked`
- `quiz_completed`
- `adherent_day`
- `perfect_day`

### Authentication and request safety

| Check                          | Result                     |
| ------------------------------ | -------------------------- |
| Missing bearer token           | `401 UNAUTHORIZED`         |
| Invalid bearer token           | `401 UNAUTHORIZED`         |
| Revoked bearer token           | `401 UNAUTHORIZED`         |
| Invalid-token challenge header | Present                    |
| Tampered event cursor          | `400 INVALID_CURSOR`       |
| Reused pairing code            | `400 INVALID_PAIRING_CODE` |
| Old token after unpairing      | Rejected immediately       |

## Settings checks

Chrome verified that the Connected devices card can:

- Show an empty device state
- Generate a ten-minute pairing code
- Show a paired device and its online state
- Edit the device name
- Edit brightness and volume
- Enable the optional evening mood nudge
- Save settings
- Show a confirmation before unpairing
- Unpair a device
- Return to the empty device state

A consumed pairing code is now cleared when the user refreshes the connected device list.

## Test data cleanup

The QA fixture created:

- One temporary active session
- One temporary near-term reminder
- Twenty-six temporary allowlisted events

The fixture cleanup removed all of those rows. Both test devices were unpaired. The final check found:

- No active fixture session
- No fixture reminder
- No fixture events
- No active test devices
- No tagged stale pairing-code test rows

During the run, the application’s normal trophy check recognized seven
previously earned QA achievements and added 200 XP through the standard
gamification ledger. Those valid trophy records were not removed by fixture
cleanup.

## Production rollout state

The code is linked to the existing Vercel project, but this local environment is not authenticated with the Vercel command-line tool. No new project was created.

The API remains safe by default because `IOT_DEVICE_API_ENABLED` defaults to `false`. Before enabling it in production:

1. Add a new random `DEVICE_AUTH_PEPPER` with at least 32 characters
2. Set `IOT_DEVICE_API_ENABLED` to `true`
3. Deploy the reviewed code to the linked Vercel project
4. Run the same pair, config, status, and unpair checks on the deployment
5. Keep the previous deployment available for rollback
