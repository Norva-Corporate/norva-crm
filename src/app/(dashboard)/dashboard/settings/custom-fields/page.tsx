import React from "react";
import { Header } from "@/components/layout/header";
import { listFieldDefinitions } from "@/lib/actions/custom-fields";
import { CustomFieldsSettingsClient } from "@/components/custom-fields/custom-fields-settings-client";

export default async function CustomFieldsSettingsPage() {
  const [contact, company, deal, project, lead_import] = await Promise.all([
    listFieldDefinitions("contact"),
    listFieldDefinitions("company"),
    listFieldDefinitions("deal"),
    listFieldDefinitions("project"),
    listFieldDefinitions("lead_import"),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Champs personnalisés" />
      <CustomFieldsSettingsClient
        contact={contact}
        company={company}
        deal={deal}
        project={project}
        lead_import={lead_import}
      />
    </div>
  );
}
