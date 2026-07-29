import type { WebsiteState } from '../types';

/** Empty permanent WebsiteState — Prompt 1 does not populate generation yet. */
export function createEmptyWebsiteState(): WebsiteState {
  return {
    brand: {
      name: '',
      tagline: '',
      primaryColor: '#D9632D',
      secondaryColor: '#141B2B',
      accentColor: '#D9632D',
      logoUrl: '',
      fontDisplay: 'Plus Jakarta Sans',
      fontBody: 'DM Sans',
    },
    theme: {
      mode: 'light',
      radius: 'soft',
      density: 'comfortable',
      tokens: {},
    },
    navigation: {
      items: [],
      ctaLabel: '',
      ctaHref: '',
    },
    pages: [],
    sections: [],
    products: [],
    collections: [],
    assets: [],
    settings: {
      locale: 'en-US',
      currency: 'USD',
      timezone: 'America/New_York',
      published: false,
      domain: '',
    },
  };
}
