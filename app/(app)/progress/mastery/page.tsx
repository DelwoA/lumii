import { requireDbUser } from "@/lib/auth";
import { getMasteryOverview } from "@/lib/mastery/service";
import { MasteryMap } from "@/components/progress/mastery-map";

export default async function MasteryPage() {
  const user = await requireDbUser();
  const overview = await getMasteryOverview(user.id);
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
          Learning intelligence
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Mastery map
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          See which concepts are taking root, what needs another pass, and how
          likely your next answer is to be correct.
        </p>
      </header>
      <MasteryMap overview={overview} />
    </main>
  );
}
