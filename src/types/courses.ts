/** CTA type presets for quick configuration */
export type VideoCTAType = 'book-call' | 'webinar' | 'offer' | 'custom';

/** Position of the CTA overlay on the video */
export type VideoCTAPosition = 'bottom-bar' | 'bottom-right' | 'top-bar' | 'center-modal';

/** Visual style preset for the CTA */
export type VideoCTAStyle = 'gradient' | 'glass' | 'pulse' | 'solid';

/** Animated entrance effect */
export type VideoCTAAnimation = 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'bounce' | 'confetti';

/** Engagement trigger mode */
export type VideoCTAEngagementTrigger = 'time' | 'percent' | 'pause';

/**
 * A single CTA (Call-to-Action) overlay configuration for a lesson video.
 * Stored as part of a JSONB array in the lessons.ctas column.
 */
export interface VideoCTA {
  id: string;
  type: VideoCTAType;
  title: string;
  subtitle?: string;
  buttonText: string;
  link: string;
  linkTarget: '_blank' | '_self';
  showAfterSeconds: number;
  autoHideSeconds?: number | null;
  position: VideoCTAPosition;
  style: VideoCTAStyle;
  dismissable: boolean;
  showOnce: boolean;
  exitIntent?: boolean;
  engagementTrigger?: VideoCTAEngagementTrigger;
  engagementPercent?: number;
  abVariants?: VideoCTAVariant[];
  countdownSeconds?: number;
  entranceAnimation?: VideoCTAAnimation;
  sequenceFallbackId?: string;
  sequenceFallbackDelay?: number;
}

/** A/B test variant — lightweight override of key CTA fields */
export interface VideoCTAVariant {
  id: string;
  title: string;
  subtitle?: string;
  buttonText: string;
  link: string;
  style?: VideoCTAStyle;
}

/** Analytics record for a single CTA (stored in localStorage) */
export interface VideoCTAAnalytics {
  ctaId: string;
  impressions: number;
  clicks: number;
  dismissals: number;
  lastSeen?: number;
}

/** Row shape of the `courses` table */
export interface Course {
  id: string;
  title: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  preview_video_url: string | null;
  instructor_name: string | null;
  instructor_avatar: string | null;
  lesson_count: number;
  total_duration_minutes: number;
  price_cents: number;
  stripe_price_id: string | null;
  is_free: boolean;
  requires_subscription: boolean;
  required_plan_id: string | null;
  sort_order: number;
  is_published: boolean;
  is_featured: boolean;
  badge_text: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** A single attached resource on a lesson (link / pdf / file) */
export interface LessonResource {
  id?: string;
  type: 'link' | 'pdf' | 'file' | 'video';
  title: string;
  url: string;
  description?: string;
}

/** Row shape of the `lessons` table */
export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_duration_seconds: number;
  content_markdown: string | null;
  resources: LessonResource[];
  chapter_number: number;
  lesson_number: number;
  is_preview: boolean;
  thumbnail_url: string | null;
  status: 'draft' | 'published' | 'private';
  ctas: VideoCTA[];
  created_at: string;
  updated_at: string;
}

/** Row shape of `user_course_access` */
export interface UserCourseAccess {
  id: string;
  user_id: string;
  course_id: string;
  access_type: 'purchase' | 'subscription' | 'license' | 'gift' | 'admin';
  stripe_payment_id: string | null;
  amount_cents: number | null;
  license_key: string | null;
  granted_at: string;
  expires_at: string | null;
}

/** Row shape of `user_lesson_progress` */
export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  progress_seconds: number;
  is_completed: boolean;
  completed_at: string | null;
  last_watched_at: string;
}

/** Row shape of `product_course_assignments` (Stripe product → course bridge) */
export interface ProductCourseAssignment {
  id: string;
  product_id: string;
  course_id: string;
  created_at: string;
}
