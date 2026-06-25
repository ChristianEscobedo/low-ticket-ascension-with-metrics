import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Service-role client — lazy so module import never throws on missing env.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  _supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
  return _supabase;
}

export interface CtaPerformanceRow {
  lessonId: string;
  ctaId: string;
  lessonTitle: string | null;
  courseId: string | null;
  courseTitle: string | null;
  ctaTitle: string | null;
  ctaLink: string | null;
  ctaButtonText: string | null;
  clicks: number;
  views: number;
  /** clicks / views as a fraction in [0, 1]; null when views == 0. */
  ctr: number | null;
  lastClickAt: string | null;
}

interface EventRow {
  lesson_id: string;
  cta_id: string;
  created_at: string | null;
}

interface LessonRow {
  id: string;
  title: string;
  course_id: string;
  ctas: unknown;
}

export interface CourseRow {
  id: string;
  title: string;
}

export interface CtaPerformanceFilters {
  /** Inclusive ISO timestamp (or YYYY-MM-DD) lower bound on created_at. */
  startDate?: string | null;
  /** Inclusive ISO timestamp (or YYYY-MM-DD) upper bound on created_at. */
  endDate?: string | null;
  /** Restrict to a single course id. */
  courseId?: string | null;
}

/**
 * Aggregate CTA clicks across the entire platform, grouped by (lesson, cta).
 * Joins lesson title + course title + the CTA's own label fields by parsing
 * the `lessons.ctas` JSON. Best-effort: returns [] on any error or when the
 * service-role env vars are missing.
 */
export async function getTopCtaPerformance(
  limit = 100,
  filters: CtaPerformanceFilters = {}
): Promise<CtaPerformanceRow[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [];
  }
  const supabase = getSupabase();

  // Course filter: resolve to lesson IDs first so we can apply a single
  // .in() against the clicks table.
  let courseLessonIds: string[] | null = null;
  if (filters.courseId) {
    const { data: lessonRows } = await (supabase as any)
      .from('lessons')
      .select('id')
      .eq('course_id', filters.courseId);
    courseLessonIds = ((lessonRows as { id: string }[] | null) ?? []).map(
      (l) => l.id
    );
    if (courseLessonIds.length === 0) return [];
  }

  const endBound = filters.endDate
    ? /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)
      ? `${filters.endDate}T23:59:59.999Z`
      : filters.endDate
    : null;

  const buildEventQuery = (table: 'cta_click_events' | 'cta_view_events') => {
    let q = (supabase as any)
      .from(table)
      .select('lesson_id, cta_id, created_at')
      .order('created_at', { ascending: false })
      .limit(20_000);
    if (filters.startDate) q = q.gte('created_at', filters.startDate);
    if (endBound) q = q.lte('created_at', endBound);
    if (courseLessonIds) q = q.in('lesson_id', courseLessonIds);
    return q;
  };

  const [clicksRes, viewsRes] = await Promise.all([
    buildEventQuery('cta_click_events'),
    buildEventQuery('cta_view_events')
  ]);
  const { data: clicks, error: clickErr } = clicksRes;
  const { data: views } = viewsRes;

  if (clickErr) return [];
  if (!clicks?.length && !views?.length) return [];

  const agg = new Map<
    string,
    {
      lesson_id: string;
      cta_id: string;
      clicks: number;
      views: number;
      last: string | null;
    }
  >();
  const upsert = (e: EventRow) => {
    const key = `${e.lesson_id}::${e.cta_id}`;
    let row = agg.get(key);
    if (!row) {
      row = { lesson_id: e.lesson_id, cta_id: e.cta_id, clicks: 0, views: 0, last: null };
      agg.set(key, row);
    }
    return row;
  };
  for (const c of (clicks ?? []) as EventRow[]) {
    const row = upsert(c);
    row.clicks += 1;
    if (c.created_at && (!row.last || c.created_at > row.last)) {
      row.last = c.created_at;
    }
  }
  for (const v of (views ?? []) as EventRow[]) {
    upsert(v).views += 1;
  }

  const lessonIds = Array.from(new Set(Array.from(agg.values()).map((v) => v.lesson_id)));
  const { data: lessons } = await (supabase as any)
    .from('lessons')
    .select('id, title, course_id, ctas')
    .in('id', lessonIds);

  const lessonById = new Map<string, LessonRow>();
  for (const l of (lessons as LessonRow[] | null) ?? []) lessonById.set(l.id, l);

  const courseIds = Array.from(
    new Set(((lessons as LessonRow[] | null) ?? []).map((l) => l.course_id))
  );
  const { data: courses } = await (supabase as any)
    .from('courses')
    .select('id, title')
    .in('id', courseIds);
  const courseById = new Map<string, CourseRow>();
  for (const c of (courses as CourseRow[] | null) ?? []) courseById.set(c.id, c);

  const rows: CtaPerformanceRow[] = Array.from(agg.values()).map((row) => {
    const lesson = lessonById.get(row.lesson_id);
    const course = lesson ? courseById.get(lesson.course_id) : undefined;
    const ctaList = Array.isArray(lesson?.ctas) ? (lesson!.ctas as any[]) : [];
    const cta = ctaList.find((c) => c?.id === row.cta_id);
    return {
      lessonId: row.lesson_id,
      ctaId: row.cta_id,
      lessonTitle: lesson?.title ?? null,
      courseId: lesson?.course_id ?? null,
      courseTitle: course?.title ?? null,
      ctaTitle: cta?.title ?? null,
      ctaLink: cta?.link ?? null,
      ctaButtonText: cta?.buttonText ?? null,
      clicks: row.clicks,
      views: row.views,
      ctr: row.views > 0 ? row.clicks / row.views : null,
      lastClickAt: row.last
    };
  });

  rows.sort((a, b) => b.clicks - a.clicks);
  return rows.slice(0, limit);
}


export interface CtaCourseAggregate {
  courseId: string | null;
  courseTitle: string | null;
  ctaCount: number;
  lessonCount: number;
  clicks: number;
  views: number;
  ctr: number | null;
}

export interface CtaLessonAggregate {
  lessonId: string;
  lessonTitle: string | null;
  courseId: string | null;
  courseTitle: string | null;
  ctaCount: number;
  clicks: number;
  views: number;
  ctr: number | null;
}

/**
 * Roll the per-(lesson, cta) rows up into per-course and per-lesson totals.
 * Both arrays are sorted by clicks DESC. Rows with a null courseId are
 * collapsed under a single "unattributed" bucket (courseId = null).
 */
export function aggregateCtaRows(rows: CtaPerformanceRow[]): {
  byCourse: CtaCourseAggregate[];
  byLesson: CtaLessonAggregate[];
} {
  const courseMap = new Map<string, CtaCourseAggregate & { _lessons: Set<string> }>();
  const lessonMap = new Map<string, CtaLessonAggregate>();

  for (const r of rows) {
    const cKey = r.courseId ?? '__none__';
    let course = courseMap.get(cKey);
    if (!course) {
      course = {
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        ctaCount: 0,
        lessonCount: 0,
        clicks: 0,
        views: 0,
        ctr: null,
        _lessons: new Set()
      };
      courseMap.set(cKey, course);
    }
    course.ctaCount += 1;
    course.clicks += r.clicks;
    course.views += r.views;
    course._lessons.add(r.lessonId);

    let lesson = lessonMap.get(r.lessonId);
    if (!lesson) {
      lesson = {
        lessonId: r.lessonId,
        lessonTitle: r.lessonTitle,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        ctaCount: 0,
        clicks: 0,
        views: 0,
        ctr: null
      };
      lessonMap.set(r.lessonId, lesson);
    }
    lesson.ctaCount += 1;
    lesson.clicks += r.clicks;
    lesson.views += r.views;
  }

  const byCourse: CtaCourseAggregate[] = Array.from(courseMap.values()).map((c) => ({
    courseId: c.courseId,
    courseTitle: c.courseTitle,
    ctaCount: c.ctaCount,
    lessonCount: c._lessons.size,
    clicks: c.clicks,
    views: c.views,
    ctr: c.views > 0 ? c.clicks / c.views : null
  }));
  const byLesson: CtaLessonAggregate[] = Array.from(lessonMap.values()).map((l) => ({
    ...l,
    ctr: l.views > 0 ? l.clicks / l.views : null
  }));

  byCourse.sort((a, b) => b.clicks - a.clicks);
  byLesson.sort((a, b) => b.clicks - a.clicks);
  return { byCourse, byLesson };
}

/** RFC 4180-style escape: wrap when needed, double embedded quotes. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : value;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Serialize a CtaPerformanceRow[] as a CSV document. Column order is stable
 * so downstream pivot tools / sheets can rely on it. CTR is emitted as a
 * percentage with two decimals; null when there were no views.
 */
export function ctaPerformanceRowsToCsv(rows: CtaPerformanceRow[]): string {
  const header = [
    'cta_id',
    'cta_title',
    'cta_button_text',
    'cta_link',
    'lesson_id',
    'lesson_title',
    'course_id',
    'course_title',
    'views',
    'clicks',
    'ctr_pct',
    'last_click_at'
  ];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.ctaId),
        csvCell(r.ctaTitle),
        csvCell(r.ctaButtonText),
        csvCell(r.ctaLink),
        csvCell(r.lessonId),
        csvCell(r.lessonTitle),
        csvCell(r.courseId),
        csvCell(r.courseTitle),
        csvCell(r.views),
        csvCell(r.clicks),
        csvCell(r.ctr === null ? '' : (r.ctr * 100).toFixed(2)),
        csvCell(r.lastClickAt)
      ].join(',')
    );
  }
  return lines.join('\r\n') + '\r\n';
}

/**
 * Minimal id+title list of every course, used to populate the analytics
 * page filter dropdown. Returns [] when env is missing or the query fails.
 */
export async function getCourseFilterOptions(): Promise<CourseRow[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return [];
  }
  const supabase = getSupabase();
  const { data, error } = await (supabase as any)
    .from('courses')
    .select('id, title')
    .order('title', { ascending: true });
  if (error) return [];
  return (data as CourseRow[] | null) ?? [];
}
