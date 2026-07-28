import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

interface CliOptions {
  baseUrl: string;
  polls: number;
}

function readOptions(): CliOptions {
  const args = process.argv.slice(2);
  const valueAfter = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const baseUrl = (valueAfter("--base-url") ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const polls = Number(valueAfter("--polls") ?? "3");
  if (
    !baseUrl.startsWith("https://") &&
    !baseUrl.startsWith("http://localhost:")
  ) {
    throw new Error("Use HTTPS unless the API is running on localhost");
  }
  if (!Number.isInteger(polls) || polls < 1 || polls > 20) {
    throw new Error("--polls must be an integer from 1 to 20");
  }
  return { baseUrl, polls };
}

async function responseJson(
  response: Response,
): Promise<Record<string, unknown>> {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `HTTP ${response.status}${retryAfter ? `, retry after ${retryAfter}s` : ""}: ` +
        JSON.stringify(body),
    );
  }
  return body;
}

async function main() {
  const options = readOptions();
  const prompt = createInterface({ input: stdin, output: stdout });
  const pairingCode = (
    await prompt.question("Enter the 8-digit pairing code: ")
  ).trim();
  prompt.close();
  if (!/^\d{8}$/.test(pairingCode)) {
    throw new Error("The pairing code must contain 8 digits");
  }

  const pairResponse = await fetch(`${options.baseUrl}/api/device/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode }),
  });
  const paired = await responseJson(pairResponse);
  const token = paired.deviceToken;
  const initialCursor = paired.eventCursor;
  if (typeof token !== "string" || typeof initialCursor !== "string") {
    throw new Error("Pairing response did not contain a token and cursor");
  }
  let cursor = initialCursor;
  console.log(
    JSON.stringify(
      {
        paired: true,
        deviceId: paired.deviceId,
        tokenReceived: true,
        cursorReceived: true,
      },
      null,
      2,
    ),
  );

  const headers = { Authorization: `Bearer ${token}` };
  const config = await responseJson(
    await fetch(`${options.baseUrl}/api/device/config`, { headers }),
  );
  console.log("Configuration:");
  console.log(JSON.stringify(config, null, 2));

  const configuredPollInterval = config["pollIntervalSec"];
  const intervalSec =
    typeof configuredPollInterval === "number" ? configuredPollInterval : 8;
  const seen = new Set<string>();
  for (let index = 0; index < options.polls; index += 1) {
    const status = await responseJson(
      await fetch(
        `${options.baseUrl}/api/device/status?cursor=${encodeURIComponent(cursor)}`,
        { headers },
      ),
    );
    const events = Array.isArray(status.events) ? status.events : [];
    const newEvents = events.filter((event) => {
      if (
        typeof event !== "object" ||
        event === null ||
        !("id" in event) ||
        typeof event.id !== "string"
      ) {
        return false;
      }
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
    console.log(
      JSON.stringify(
        {
          poll: index + 1,
          serverTime: status.serverTime,
          rank: status.rank,
          totalXp: status.totalXp,
          currentStreak: status.currentStreak,
          activeSession: status.activeSession,
          upcomingReminder: status.upcomingReminder,
          moodCheckinNeeded: status.moodCheckinNeeded,
          newEvents,
          hasMore: status.hasMore,
        },
        null,
        2,
      ),
    );
    if (typeof status.nextCursor === "string") cursor = status.nextCursor;
    if (status.hasMore === true) {
      index -= 1;
      continue;
    }
    if (index + 1 < options.polls) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(1, intervalSec) * 1000),
      );
    }
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "IoT smoke test failed",
  );
  process.exitCode = 1;
});
