export const SITE_URL = 'https://loona.ph'
export const SITE_NAME = 'Loona'
export const SITE_DESCRIPTION =
  'Track loans, collect payments, and manage your lending business — all in one place.'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-default.png`

export function buildMeta(opts: {
  title: string
  description: string
  url: string
  ogType?: string
  ogImage?: string
}) {
  const { title, description, url, ogType = 'website', ogImage = DEFAULT_OG_IMAGE } = opts

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:type', content: ogType },
      { property: 'og:image', content: ogImage },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}
