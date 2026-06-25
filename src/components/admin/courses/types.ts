export interface Course {
  id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  instructor_name: string | null;
  price_cents: number | null;
  is_free: boolean | null;
  is_published: boolean | null;
  is_featured: boolean | null;
  badge_text: string | null;
  lesson_count: number | null;
  total_duration_minutes: number | null;
  sort_order: number | null;
  created_at?: string;
}

export type LessonResourceType = 'link' | 'pdf' | 'doc' | 'video' | 'file';

export interface LessonResource {
  name: string;
  url: string;
  type: LessonResourceType;
}

export type VideoCTAPosition =
  | 'bottom-bar'
  | 'bottom-right'
  | 'top-bar'
  | 'center-modal';
export type VideoCTAStyle = 'glass' | 'solid' | 'gradient' | 'pulse';
export type VideoCTAType = 'offer' | 'book-call' | 'webinar' | 'link';

export interface VideoCTA {
  id: string;
  title: string;
  subtitle?: string | null;
  buttonText: string;
  link: string;
  linkTarget?: '_blank' | '_self';
  type: VideoCTAType;
  style: VideoCTAStyle;
  position: VideoCTAPosition;
  showAfterSeconds: number;
  autoHideSeconds?: number | null;
  dismissable: boolean;
  showOnce?: boolean;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_duration_seconds: number | null;
  content_markdown: string | null;
  chapter_number: number | null;
  lesson_number: number;
  is_preview: boolean | null;
  status?: string | null;
  resources?: LessonResource[] | null;
  ctas?: VideoCTA[] | null;
}
