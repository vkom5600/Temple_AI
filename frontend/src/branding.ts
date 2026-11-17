// The temple's name, logo and wording, in one place.
// Colours come from the logo and the VHP (UK) website: indigo, with saffron and green accents.
// They live in styles.css (the tokens at the top); the faded gopuram is components/Ornaments.tsx.
export const BRAND = {
  templeName: import.meta.env.VITE_TEMPLE_NAME || 'Ilford Hindu Centre',
  // Under the name in the sidebar and on the sign-in page.
  tagline: 'Vishwa Hindu Parishad (UK)',
  logo: '/vhp-logo.png',
  appName: 'Temple AI',
}
