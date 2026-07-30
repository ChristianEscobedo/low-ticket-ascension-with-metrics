import PlannerWorkspace from './PlannerWorkspace';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Planner · Admin' };

/**
 * /admin/planner
 *
 * Deliberately thin. The workspace is a client component because the whole
 * point of the planner is dragging, and the admin guard already lives on
 * /api/admin/mothermode-planner — so authorization is enforced where the data
 * actually crosses the boundary rather than duplicated here.
 */
export default function AdminPlannerPage() {
  return <PlannerWorkspace />;
}
