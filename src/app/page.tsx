import { Suspense } from "react";
import SecQuest from "@/components/secquest";
export default function Page() {
  return (
    <Suspense
      fallback={<main className="boot">Initializing your workspace…</main>}
    >
      <SecQuest />
    </Suspense>
  );
}
