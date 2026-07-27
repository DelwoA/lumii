import { renderToFile } from "@react-pdf/renderer";
import { ProgressReportDocument } from "../lib/pdf/progress-report-pdf";

const output = process.argv[2];
if (!output) throw new Error("Pass an output PDF path");

async function main() {
  await renderToFile(
    <ProgressReportDocument
      displayName="Sample Student"
      timezone="Asia/Colombo"
      generatedAtISO="2026-07-27T12:00:00.000Z"
      includeReflections
      sessions={[
        {
          id: "sample-1",
          title: "Cell biology revision",
          goal: "Review organelles and make a summary",
          subjectName: "Biology",
          topicName: "Cells",
          startedAtISO: "2026-07-27T08:00:00.000Z",
          endedAtISO: "2026-07-27T08:25:00.000Z",
          durationSec: 1500,
          targetDurationSec: 1500,
          scoreStatus: "SCORED",
          qualityScore: 86,
          qualityVersion: "2",
          qualityBreakdown: {
            durationAdherence: 50,
            goalCompletion: 20,
            intentionalStop: 10,
            learningActivity: 6,
            total: 86,
            activity: {
              summariesGenerated: 1,
              tutorQuestions: 1,
              quizzesCompleted: 0,
            },
          },
          goalCompleted: true,
          reflection:
            "The organelle comparison is clear now; revisit membrane transport next.",
          autoClosed: false,
        },
        {
          id: "sample-2",
          title: "Graph algorithms",
          goal: null,
          subjectName: "Computer Science",
          topicName: "Algorithms",
          startedAtISO: "2026-07-25T10:00:00.000Z",
          endedAtISO: "2026-07-25T10:08:00.000Z",
          durationSec: 480,
          targetDurationSec: 1500,
          scoreStatus: "TOO_SHORT",
          qualityScore: null,
          qualityVersion: null,
          qualityBreakdown: null,
          goalCompleted: false,
          reflection: null,
          autoClosed: false,
        },
      ]}
    />,
    output,
  );
}

void main();
