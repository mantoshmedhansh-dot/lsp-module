import { redirect } from "next/navigation";

/**
 * Redirect to Allocation Engine Rules
 *
 * Allocation rules are now centralized at /logistics/allocation/rules
 * as part of the Allocation Engine section.
 */
export default function AllocationRulesRedirectPage() {
  redirect("/logistics/allocation/rules");
}
