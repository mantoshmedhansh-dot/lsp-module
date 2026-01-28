import { redirect } from "next/navigation";

// Alert rules are managed in Control Tower
export default function SetupAlertsPage() {
  redirect("/control-tower/rules");
}
