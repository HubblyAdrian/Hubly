/**
 * Provider lifecycle — single source of truth for marketplace visibility & actions.
 *
 * States:
 *   draft                 — business exists, Marketplace never configured
 *   hidden                — owner chose not to appear publicly
 *   pending_verification  — awaiting Hubly review
 *   verified              — public listing
 *   paused                — temporarily unavailable (vacation/busy)
 *   suspended             — hidden by Hubly
 *   rejected              — verification failed
 */

export const MARKETPLACE_STATUSES = [
  "draft",
  "hidden",
  "pending_verification",
  "verified",
  "paused",
  "suspended",
  "rejected",
] as const;

export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];

/** Legacy values from the first foundation migration. */
const LEGACY_STATUS_MAP: Record<string, MarketplaceStatus> = {
  active: "verified",
  paused: "paused",
  draft: "draft",
  suspended: "suspended",
};

export function normalizeMarketplaceStatus(raw: unknown): MarketplaceStatus {
  const s = String(raw || "draft").trim().toLowerCase();
  if ((MARKETPLACE_STATUSES as readonly string[]).includes(s)) {
    return s as MarketplaceStatus;
  }
  return LEGACY_STATUS_MAP[s] || "draft";
}

export function marketplaceStatusLabel(status: MarketplaceStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "hidden":
      return "Hidden";
    case "pending_verification":
      return "Pending Verification";
    case "verified":
      return "Verified";
    case "paused":
      return "Paused";
    case "suspended":
      return "Suspended";
    case "rejected":
      return "Rejected";
    default:
      return "Draft";
  }
}

/** Public consumer listing — only Verified. */
export function isPubliclyListed(status: MarketplaceStatus): boolean {
  return status === "verified";
}

/** Owner is participating in marketplace (not draft/hidden/rejected/suspended). */
export function isMarketplaceParticipating(status: MarketplaceStatus): boolean {
  return status === "pending_verification" || status === "verified" || status === "paused";
}

/** Can receive instant book / booking-request leads right now. */
export function canAcceptMarketplaceLeads(status: MarketplaceStatus): boolean {
  return status === "verified";
}

/** Owner-controlled transitions (Hubly ops can set suspended/rejected separately). */
export function isOwnerLockedStatus(status: MarketplaceStatus): boolean {
  return status === "suspended" || status === "rejected";
}

/**
 * Resolve next status from owner “Show in Marketplace” + optional pause.
 * Never overrides suspended/rejected.
 */
export function resolveOwnerStatusTransition(opts: {
  current: MarketplaceStatus;
  showInMarketplace: boolean;
  pause?: boolean;
  previouslyVerified?: boolean;
}): MarketplaceStatus {
  const current = normalizeMarketplaceStatus(opts.current);
  if (isOwnerLockedStatus(current)) return current;

  if (!opts.showInMarketplace) {
    // Leaving marketplace: draft stays draft until first configure; otherwise hidden
    if (current === "draft" && opts.pause !== true) return "draft";
    return "hidden";
  }

  // Show in marketplace ON
  if (opts.pause === true) return "paused";

  // Resume / enable (not pausing)
  if (current === "verified") return "verified";
  if (current === "pending_verification") return "pending_verification";
  if (current === "paused") {
    return opts.previouslyVerified ? "verified" : "pending_verification";
  }
  if (current === "hidden") {
    return opts.previouslyVerified ? "verified" : "pending_verification";
  }
  // draft → pending verification on first opt-in
  return "pending_verification";
}

/** Mirror verification_status from lifecycle for scoring / AI. */
export function verificationFromLifecycle(status: MarketplaceStatus): "pending" | "verified" | "rejected" {
  if (status === "verified" || status === "paused") return "verified";
  if (status === "rejected") return "rejected";
  if (status === "pending_verification") return "pending";
  return "pending";
}

export type LifecycleSnapshot = {
  status: MarketplaceStatus;
  label: string;
  is_public: boolean;
  is_participating: boolean;
  can_accept_leads: boolean;
  can_instant_book: boolean;
  /** @deprecated prefer can_booking_request — DB column still accept_quote_requests */
  can_quote_request: boolean;
  can_booking_request: boolean;
  owner_locked: boolean;
  marketplace_enabled: boolean;
};

export function buildLifecycleSnapshot(
  provider: Record<string, unknown>,
): LifecycleSnapshot {
  const status = normalizeMarketplaceStatus(provider.marketplace_status);
  const accepting = provider.accepting_new_jobs !== false;
  const instant = !!provider.instant_booking;
  const bookingRequests = provider.accept_quote_requests !== false;
  const leadsOk = canAcceptMarketplaceLeads(status) && accepting;

  return {
    status,
    label: marketplaceStatusLabel(status),
    is_public: isPubliclyListed(status),
    is_participating: isMarketplaceParticipating(status),
    can_accept_leads: leadsOk,
    can_instant_book: leadsOk && instant,
    can_quote_request: leadsOk && bookingRequests,
    can_booking_request: leadsOk && bookingRequests,
    owner_locked: isOwnerLockedStatus(status),
    marketplace_enabled: isMarketplaceParticipating(status) || isPubliclyListed(status),
  };
}
