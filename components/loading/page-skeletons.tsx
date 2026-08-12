import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthCardSkeleton() {
  return (
    <div
      className="bg-card w-full max-w-[25rem] space-y-6 rounded-xl border p-8 shadow-sm"
      aria-label="Loading account form"
      role="status"
    >
      <div className="space-y-2 text-center">
        <Skeleton className="mx-auto h-7 w-36" />
        <Skeleton className="mx-auto h-4 w-56" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <Skeleton className="mx-auto h-4 w-44" />
    </div>
  );
}

function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action ? <Skeleton className="h-9 w-32 rounded-full" /> : null}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="space-y-3 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            {index === 0 ? <Skeleton className="h-1.5 w-full" /> : null}
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-16 w-full" />
        </Card>
        <Card className="space-y-3 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
        </Card>
      </div>
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeaderSkeleton action />
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <Card className="grid gap-3 p-4 md:grid-cols-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </Card>
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="flex items-center gap-4 p-5">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function NewMaterialSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)]">
        <Card className="space-y-5 p-6">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </Card>
        <Card className="space-y-4 p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full rounded-full" />
        </Card>
      </div>
    </div>
  );
}

export function MaterialDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-4 w-48" />
      <PageHeaderSkeleton action />
      <Card className="space-y-3 p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-64" />
      </Card>
      <Card className="space-y-4 p-5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export function SubjectDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-4 w-56" />
      <PageHeaderSkeleton action />
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TimetableSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <PageHeaderSkeleton action />
      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ProgressPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeaderSkeleton action />
      <Card className="h-32 p-5">
        <Skeleton className="h-full w-full" />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="space-y-3 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </Card>
        ))}
      </div>
      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-56 w-full" />
      </Card>
    </div>
  );
}

export function AchievementsSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-full" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="flex gap-4 p-4">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <PageHeaderSkeleton />
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="space-y-4 p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-3/5" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-9 w-32 rounded-full" />
        </Card>
      ))}
    </div>
  );
}

export function PublicProfileSkeleton() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl space-y-6">
        <Card className="space-y-4 p-6 text-center">
          <Skeleton className="mx-auto size-16 rounded-full" />
          <Skeleton className="mx-auto h-7 w-44" />
          <Skeleton className="mx-auto h-4 w-24" />
          <div className="flex justify-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </Card>
        <Card className="space-y-4 p-6">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
