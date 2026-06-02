import { listTaskTemplates } from "@/lib/actions/task-templates";
import { TaskTemplatesClient } from "@/components/task-templates/TaskTemplatesClient";

export const dynamic = "force-dynamic";

export default async function TaskTemplatesPage() {
  const templates = await listTaskTemplates();
  return <TaskTemplatesClient initialTemplates={templates} />;
}
