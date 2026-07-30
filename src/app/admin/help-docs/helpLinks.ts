/**
 * Maps admin routes to the most relevant admin help-doc slug, so each screen
 * can show a contextual help icon that opens the right guide. Falls back to
 * the docs index when a route has no specific article.
 */
export const ADMIN_HELP_LINKS: Record<string, string> = {
  '/admin': 'what-is-mothermode',
  '/admin/assets': 'brand-bible-and-assets',
  '/admin/sales-funnels': 'sales-funnel-builder',
  '/admin/funnels': 'optin-funnels',
  '/admin/funnel-stats': 'lead-capture-and-funnel-stats',
  '/admin/brand-bible': 'brand-bible-and-assets',
  '/admin/content': 'content-hub-overview',
  '/admin/planner': 'planner-board',
  '/admin/community': 'community-kit',
  '/admin/high-ticket': 'high-ticket-kit',
  '/admin/lead-gen': 'lead-gen-kit',
  '/admin/email-marketing': 'email-marketing-kit',
  '/admin/deliverables': 'deliverables-and-resources',
  '/admin/email-templates': 'email-templates-and-flows',
  '/admin/integrations': 'integrations-and-keys',
  '/admin/help': 'help-center-guide',
  '/admin/help-docs': 'what-is-mothermode',
};

/** The in-app docs index to link to from a help icon. */
export function adminHelpDocHref(route: string): string {
  const slug = ADMIN_HELP_LINKS[route];
  // Link to the in-app docs browser; it renders the article by slug via query
  // when present, otherwise the index.
  return slug ? `/admin/help-docs?article=${slug}` : '/admin/help-docs';
}
