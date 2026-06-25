import CoursesPanel from '@/components/admin/CoursesPanel';

export const dynamic = 'force-dynamic';

export default function AdminCoursesPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
          Course Area
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Courses</h1>
      </div>
      <CoursesPanel />
    </div>
  );
}
