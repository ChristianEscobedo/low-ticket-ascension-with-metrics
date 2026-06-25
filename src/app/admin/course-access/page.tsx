import CourseAccessPanel from '@/components/admin/CourseAccessPanel';

export const dynamic = 'force-dynamic';

export default function AdminCourseAccessPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.25em] text-amber-200/80 font-semibold mb-2">
          Course Area
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Course Access</h1>
      </div>
      <CourseAccessPanel />
    </div>
  );
}
