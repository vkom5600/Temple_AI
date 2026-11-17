// The temple's name and wording, in one place.
// To rename, set VITE_TEMPLE_NAME in frontend/.env (no code change), or edit the defaults here.
// Colours and artwork live in styles.css ("Temple theme" section) and components/Ornaments.tsx.
export const BRAND = {
  templeName: import.meta.env.VITE_TEMPLE_NAME || 'VHP Ilford Temple',
  // Under the name in the sidebar and on the sign-in page.
  tagline: 'Daily operations',
  appName: 'Temple AI',
}
