import {
  Circle,
  Document,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { GradedQuestion } from "@/lib/quiz/types";

const colors = {
  parchment: "#F3F0E8",
  paper: "#FBFAF6",
  ink: "#223128",
  forest: "#2F6048",
  muted: "#607067",
  border: "#CDD8CF",
  sage: "#DCE8DC",
  success: "#2D7049",
  successSoft: "#E5F0E6",
  error: "#9A4B43",
  errorSoft: "#F3E2DE",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingHorizontal: 42,
    paddingBottom: 62,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mark: { width: 26, height: 26, marginRight: 9 },
  brand: {
    color: colors.forest,
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    letterSpacing: 1.2,
  },
  record: {
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  titleBlock: { marginTop: 18 },
  eyebrow: {
    color: colors.forest,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    lineHeight: 1.2,
  },
  summary: {
    marginTop: 14,
    marginBottom: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.parchment,
  },
  score: {
    color: colors.forest,
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
  },
  scoreOf: { color: colors.muted, fontSize: 12 },
  scoreCopy: { marginLeft: 16, flexGrow: 1 },
  scoreHeading: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  scoreDetail: { color: colors.muted, marginTop: 2 },
  question: {
    marginBottom: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  questionHeader: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.parchment,
  },
  questionMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  questionNumber: {
    color: colors.forest,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  statusCorrect: {
    marginLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  statusWrong: {
    marginLeft: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.errorSoft,
    color: colors.error,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  questionText: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  options: { paddingVertical: 8, paddingHorizontal: 12 },
  option: {
    marginBottom: 4,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 5,
    color: colors.ink,
  },
  correctOption: {
    backgroundColor: colors.successSoft,
    color: colors.success,
    fontFamily: "Helvetica-Bold",
  },
  wrongOption: { backgroundColor: colors.errorSoft, color: colors.error },
  explanation: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    color: colors.muted,
    fontSize: 8.8,
  },
  explanationLabel: { color: colors.ink, fontFamily: "Helvetica-Bold" },
  footerRule: {
    position: "absolute",
    left: 42,
    right: 42,
    bottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLeft: {
    position: "absolute",
    left: 42,
    bottom: 12,
    color: colors.muted,
    fontSize: 7.5,
  },
  footerRight: {
    position: "absolute",
    left: 420,
    bottom: 12,
    width: 133,
    textAlign: "right",
    color: colors.muted,
    fontSize: 7.5,
  },
});

function LumiiMark() {
  return (
    <Svg style={styles.mark} viewBox="0 0 24 24">
      <Path
        d="M11.7 2.5l1.45 6.05 5.85 1.5-5.85 1.5-1.45 6.05-1.45-6.05-5.85-1.5 5.85-1.5 1.45-6.05z"
        fill={colors.forest}
      />
      <Circle cx="19.1" cy="5.2" r="1.6" fill={colors.forest} />
    </Svg>
  );
}

export function QuizResultPdf({
  title,
  correctCount,
  questionCount,
  graded,
}: {
  title: string;
  correctCount: number;
  questionCount: number;
  graded: GradedQuestion[];
}) {
  const percentage = questionCount
    ? Math.round((correctCount / questionCount) * 100)
    : 0;

  return (
    <Document
      title={`Quiz result: ${title}`}
      author="LUMII"
      subject="Saved quiz result"
      keywords="LUMII, quiz, study, mastery"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.brandRow}>
          <LumiiMark />
          <View>
            <Text style={styles.brand}>LUMII</Text>
            <Text style={styles.record}>Private quiz record</Text>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Quiz result</Text>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.score}>{correctCount}</Text>
          <Text style={styles.scoreOf}> / {questionCount}</Text>
          <View style={styles.scoreCopy}>
            <Text style={styles.scoreHeading}>{percentage}% correct</Text>
            <Text style={styles.scoreDetail}>
              Your answers and explanations are saved in Quiz History.
            </Text>
          </View>
        </View>

        {graded.map((question, index) => {
          const isCorrect = question.chosen === question.correctAnswer;
          return (
            <View key={question.id} style={styles.question} wrap={false}>
              <View style={styles.questionHeader} minPresenceAhead={50}>
                <View style={styles.questionMeta}>
                  <Text style={styles.questionNumber}>
                    Question {index + 1}
                  </Text>
                  <Text
                    style={
                      isCorrect ? styles.statusCorrect : styles.statusWrong
                    }
                  >
                    {isCorrect ? "Correct" : "Review"}
                  </Text>
                </View>
                <Text style={styles.questionText}>{question.question}</Text>
              </View>
              <View style={styles.options}>
                {question.options.map((option, optionIndex) => {
                  const correct = optionIndex === question.correctAnswer;
                  const chosen = optionIndex === question.chosen;
                  const note = correct
                    ? " - Correct answer"
                    : chosen
                      ? " - Your answer"
                      : "";
                  return (
                    <Text
                      key={optionIndex}
                      style={[
                        styles.option,
                        correct ? styles.correctOption : {},
                        chosen && !correct ? styles.wrongOption : {},
                      ]}
                    >
                      {String.fromCharCode(65 + optionIndex)}. {option}
                      {note}
                    </Text>
                  );
                })}
              </View>
              {question.explanation ? (
                <Text style={styles.explanation}>
                  <Text style={styles.explanationLabel}>Why: </Text>
                  {question.explanation}
                </Text>
              ) : null}
            </View>
          );
        })}

        <View style={styles.footerRule} fixed />
        <Text style={styles.footerLeft} fixed>
          Saved privately in LUMII Quiz History.
        </Text>
        <Text style={styles.footerRight} fixed>
          LUMII study record
        </Text>
      </Page>
    </Document>
  );
}
