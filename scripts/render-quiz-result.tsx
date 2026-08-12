import path from "node:path";
import { renderToFile } from "@react-pdf/renderer";
import { QuizResultPdf } from "../lib/pdf/quiz-result-pdf";
import type { GradedQuestion } from "../lib/quiz/types";

const outputPath = path.resolve(
  process.argv[2] ?? "tmp/pdfs/lumii-quiz-result-sample.pdf",
);

const questions: GradedQuestion[] = Array.from({ length: 10 }, (_, index) => ({
  id: index,
  question:
    index === 7
      ? "A student repeats a measurement several times and gets slightly different readings. Which action best improves the reliability of the final result while preserving a clear record of the method used?"
      : `Which explanation best demonstrates concept ${index + 1} in a practical measurement scenario?`,
  options: [
    "Use a consistent method, repeat the reading, and compare the results.",
    "Change every variable at once and keep only the largest result.",
    "Ignore the units because the numerical value is sufficient.",
    "Round every observation before recording the original reading.",
  ],
  chosen: index % 3 === 0 ? 1 : 0,
  correctAnswer: 0,
  explanation:
    "Repeated measurements using the same method make variation visible and support a more reliable conclusion. Recording the original observations also keeps the reasoning auditable.",
  componentId: `component-${index + 1}`,
  componentName: `Measurement concept ${index + 1}`,
  difficulty: index % 2 === 0 ? "MEDIUM" : "HARD",
}));

async function main() {
  await renderToFile(
    <QuizResultPdf
      title="Making Measurements: Length, Volume, Density, and Experimental Reliability"
      correctCount={6}
      questionCount={questions.length}
      graded={questions}
    />,
    outputPath,
  );

  process.stdout.write(`${outputPath}\n`);
}

void main();
