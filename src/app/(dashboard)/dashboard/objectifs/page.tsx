import { getGoalsWithProgress } from "@/lib/actions/goals";
import { listProfilesForPicker } from "@/lib/actions/pickers";
import { ObjectifsClient } from "@/components/objectifs/ObjectifsClient";

export const dynamic = "force-dynamic";

export default async function ObjectifsPage() {
  const [goals, profiles] = await Promise.all([
    getGoalsWithProgress(),
    listProfilesForPicker(),
  ]);
  return <ObjectifsClient initialGoals={goals} profiles={profiles} />;
}
