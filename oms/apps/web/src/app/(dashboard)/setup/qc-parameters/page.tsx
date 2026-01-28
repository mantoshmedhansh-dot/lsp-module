import { redirect } from "next/navigation";

// QC parameters are managed within QC templates
export default function SetupQCParametersPage() {
  redirect("/wms/qc/templates");
}
