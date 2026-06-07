import { Metadata } from 'next'
import { BRAND } from '@/config/branding'

export const metadata: Metadata = {
  title: BRAND.shortName,
  description: `${BRAND.taglinePrimary}. ${BRAND.taglineSecondary}. Privacy-first local meeting assistant.`,
}
