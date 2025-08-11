// Production/preview config for the marketing page
// Update this to point at your running backend
// Example: window.MARKETING_API_BASE = 'https://api.samtracker.com'
// Always point to production Cloudflare Pages origin for functions
window.MARKETING_API_BASE = "https://samtracker.com";
// Canonical production domain for SEO
window.MARKETING_CANONICAL = "https://samtracker.com/";
// Optional: Cloudflare Turnstile site key (set in Pages > Settings > Environment variables)
// If set, a widget can be rendered and token verified server-side.
window.MARKETING_TURNSTILE_SITEKEY = "0x4AAAAAABqphvAef4t6WKCX";
