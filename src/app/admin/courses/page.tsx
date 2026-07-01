import CoursesPanel from '@/components/admin/CoursesPanel';

export const dynamic = 'force-dynamic';

export default function AdminCoursesPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-brass/80 font-semibold mb-2">
          Course Area
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Courses</h1>
      </div>
      <CoursesPanel />
    </div>
  );
}
