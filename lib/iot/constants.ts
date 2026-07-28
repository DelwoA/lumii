export const IOT_API_VERSION = "1" as const;
export const IOT_POLL_INTERVAL_SEC = 8;
export const IOT_MAX_ACTIVE_DEVICES = 3;
export const IOT_PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const IOT_PAIRING_WINDOW_MS = 10 * 60 * 1000;
export const IOT_PAIRING_ATTEMPTS_PER_WINDOW = 5;
export const IOT_PAIRING_CODES_PER_HOUR = 5;
export const IOT_MAX_EVENTS_PER_PAGE = 20;
export const IOT_LAST_SEEN_WRITE_INTERVAL_MS = 60 * 1000;
export const IOT_REMINDER_WINDOW_MS = 2 * 60 * 1000;

export const IOT_EVENT_TYPES = [
  "RANK_UP",
  "TROPHY_UNLOCKED",
  "QUIZ_COMPLETED",
  "ADHERENT_DAY",
  "PERFECT_DAY",
] as const;

export type IoTEventType = (typeof IOT_EVENT_TYPES)[number];
