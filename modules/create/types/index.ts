/**
 * Hubly Create — domain types.
 * CreateSession is the single source of truth for a Create conversation.
 */

export type MessageRole = 'assistant' | 'user' | 'system';

export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error';

export interface CreateAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Local object URL or data URL for preview — never sent as binary to OpenAI in Prompt 1. */
  previewUrl?: string;
}

export interface CreateMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  status: MessageStatus;
  attachments?: CreateAttachment[];
  /** OpenAI Responses API id for this assistant turn (conversation continuity). */
  responseId?: string;
}

export interface BrandState {
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  fontDisplay: string;
  fontBody: string;
}

export interface ThemeState {
  mode: 'light' | 'dark' | 'auto';
  radius: 'sharp' | 'soft' | 'round';
  density: 'compact' | 'comfortable' | 'airy';
  tokens: Record<string, string>;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: NavItem[];
}

export interface NavigationState {
  items: NavItem[];
  ctaLabel: string;
  ctaHref: string;
}

export interface SectionState {
  id: string;
  type: string;
  title: string;
  body: string;
  props: Record<string, unknown>;
}

export interface PageState {
  id: string;
  path: string;
  title: string;
  sections: SectionState[];
  seo: {
    title: string;
    description: string;
  };
}

export interface ProductState {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  status: 'draft' | 'active' | 'archived';
}

export interface CollectionState {
  id: string;
  name: string;
  slug: string;
  productIds: string[];
}

export interface AssetState {
  id: string;
  kind: 'image' | 'video' | 'file' | 'font';
  name: string;
  url: string;
  alt: string;
}

export interface WebsiteSettingsState {
  locale: string;
  currency: string;
  timezone: string;
  published: boolean;
  domain: string;
}

/**
 * Permanent representation of every website Hubly Create builds.
 * Owned exclusively by CreateSession / CreateEngine.
 */
export interface WebsiteState {
  brand: BrandState;
  theme: ThemeState;
  navigation: NavigationState;
  pages: PageState[];
  sections: SectionState[];
  products: ProductState[];
  collections: CollectionState[];
  assets: AssetState[];
  settings: WebsiteSettingsState;
}

export interface CreateSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  conversation: CreateMessage[];
  websiteState: WebsiteState;
  /** Last OpenAI response id for Responses API chaining. */
  lastResponseId: string | null;
}

export type CreateEngineEvent =
  | { type: 'session'; session: CreateSession }
  | { type: 'message'; message: CreateMessage }
  | { type: 'delta'; messageId: string; content: string }
  | { type: 'streaming'; active: boolean }
  | { type: 'error'; error: string };

export type CreateEngineListener = (event: CreateEngineEvent) => void;

export interface StreamChatRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  previousResponseId?: string | null;
  sessionId: string;
}

export interface StreamChatHandlers {
  onDelta: (text: string) => void;
  onResponseId?: (id: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}
