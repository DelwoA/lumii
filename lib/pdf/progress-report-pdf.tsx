import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SessionHistoryEntry } from "@/lib/progress/types";

const colors = {
  parchment: "#F3F0E8",
  paper: "#FBFAF6",
  ink: "#223128",
  forest: "#2F6048",
  sage: "#DCE8DC",
  muted: "#607067",
  border: "#CDD8CF",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    paddingTop: 42,
    paddingHorizontal: 42,
    paddingBottom: 66,
    fontSize: 9,
    lineHeight: 1.45,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 18,
    marginBottom: 22,
  },
  eyebrow: {
    color: colors.forest,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    marginTop: 6,
    marginBottom: 8,
    lineHeight: 1.15,
  },
  muted: { color: colors.muted },
  summary: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 22,
  },
  metric: {
    flexGrow: 1,
    backgroundColor: colors.parchment,
    borderRadius: 8,
    padding: 12,
    minHeight: 58,
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 17,
    fontWeight: 700,
    color: colors.forest,
    lineHeight: 1.15,
    marginBottom: 5,
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 9 },
  row: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 8,
  },
  sessionMain: { flexGrow: 1, flexBasis: 240 },
  score: { width: 58, textAlign: "right", fontWeight: 700 },
  duration: { width: 70, textAlign: "right" },
  reflection: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 8,
  },
  note: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    color: colors.muted,
    fontSize: 8,
  },
});

function minutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}

export function ProgressReportDocument({
  displayName,
  timezone,
  generatedAtISO,
  sessions,
  includeReflections,
}: {
  displayName: string;
  timezone: string;
  generatedAtISO: string;
  sessions: SessionHistoryEntry[];
  includeReflections: boolean;
}) {
  const scored = sessions.filter((session) => session.qualityScore != null);
  const average =
    scored.length > 0
      ? Math.round(
          scored.reduce(
            (sum, session) => sum + (session.qualityScore ?? 0),
            0,
          ) / scored.length,
        )
      : null;
  const totalSeconds = sessions.reduce(
    (sum, session) => sum + session.durationSec,
    0,
  );

  return (
    <Document
      title={`${displayName} — LUMII Progress Report`}
      author="LUMII"
      subject="Private study progress report"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>LUMII · Progress report</Text>
          <Text style={styles.title}>{displayName}</Text>
          <Text style={styles.muted}>
            Generated {new Date(generatedAtISO).toLocaleDateString("en-US")} ·{" "}
            {timezone}
          </Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{sessions.length}</Text>
            <Text style={styles.muted}>Sessions</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{minutes(totalSeconds)}</Text>
            <Text style={styles.muted}>Study time</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {average == null ? "—" : `${average}/100`}
            </Text>
            <Text style={styles.muted}>Average quality</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Session history</Text>
        {sessions.length === 0 ? (
          <Text style={styles.muted}>No sessions in this date range.</Text>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.row} wrap={false}>
              <View style={styles.sessionMain}>
                <Text>{session.title}</Text>
                <Text style={styles.muted}>
                  {new Date(session.startedAtISO).toLocaleDateString("en-US")}
                  {session.subjectName ? ` · ${session.subjectName}` : ""}
                  {session.topicName ? ` · ${session.topicName}` : ""}
                </Text>
                {includeReflections && session.reflection ? (
                  <Text style={styles.reflection}>
                    Reflection: {session.reflection}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.duration}>
                {minutes(session.durationSec)}
              </Text>
              <Text style={styles.score}>
                {session.qualityScore == null
                  ? "Not scored"
                  : `${session.qualityScore}/100`}
              </Text>
            </View>
          ))
        )}
        <Text style={styles.note}>
          Quality reflects study habits, follow-through, and verified LUMII
          activity—not intelligence, attention, or subject mastery.
        </Text>
      </Page>
    </Document>
  );
}
