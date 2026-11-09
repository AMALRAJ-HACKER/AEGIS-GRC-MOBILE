export const colors = {
  navy: '#0A1931',
  navyLight: '#162447',
  white: '#FFFFFF',
  lightBlue: '#E6F0FF',
  lightBlue2: '#F4F8FF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  teal: '#0FA3B1',
  tealLight: '#E0F7FA',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  red: '#EF4444',
  redLight: '#FEE2E2',
  success: '#10B981',
  bg: '#F8FAFC',
};

// Water theme colors - aqua/fluid aesthetic
export const water = {
  // Light water colors
  water100: '#F0FDFF',   // Very light water
  water200: '#D6F0FA',   // Light water  
  water300: '#A5EAF2',   // Water medium
  water400: '#5AC8E1',   // Water main
  water500: '#0FA3B1',   // Teal/cyan main (primary)
  water600: '#0A8FA6',   // Water dark
  water700: '#087B95',   // Water deeper
  water800: '#066A84',   // Water deep
  water900: '#055A73',   // Water very deep

  // Dark water colors
  waterDark100: '#0D1320',   // Very dark water
  waterDark200: '#141B2A',   // Dark water
  waterDark300: '#1A2535',   // Medium-dark water
  waterDark400: '#213045',   // Water dark medium
  waterDark500: '#0FA3B1',   // Teal (same as light)
  waterDark600: '#0A8FA6',   // Water dark
  waterDark700: '#087B95',   // Water deeper
  waterDark800: '#066A84',   // Water deep
  waterDark900: '#055A73',   // Water very deep
};

export const spacing = { xs:4, sm:8, md:16, lg:24, xl:32, xxl:48 };
export const radius = { sm:8, md:12, lg:16, xl:24, full:999 };
export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};