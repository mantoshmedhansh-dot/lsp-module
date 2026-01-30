import { redirect } from "next/navigation";

/**
 * Redirect to Allocation Engine Rules
 *
 * Allocation rules are now centralized in the Logistics > Allocation Engine section.
 */
export default function SetupAllocationRulesPage() {
  redirect("/logistics/allocation/rules");
}
