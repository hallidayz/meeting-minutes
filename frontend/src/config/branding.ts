export const BRAND = {
  name: 'AI GUARDIAN',
  shortName: 'AI Guardian',
  taglinePrimary: 'ADVANCING INTELLIGENCE',
  taglineSecondary: 'PROTECTING HUMANITY',
  privacyBadge: 'End-to-End Encrypted · Local AI · Protecting Humanity',
  colors: {
    primary: '#02295b',
    accent: '#fda700',
    background: '#d6d6d6',
    textOnDark: '#ffffff',
    textOnLight: '#02295b',
  },
  appId: 'com.aiguardian.desktop',
  repoUrl: 'https://github.com/hallidayz/ai-guardian',
} as const;

export const INDUSTRIES = [
  'General',
  'Medical',
  'Legal',
  'Therapy',
  'Business',
  'Education',
] as const;

export type Industry = (typeof INDUSTRIES)[number];
