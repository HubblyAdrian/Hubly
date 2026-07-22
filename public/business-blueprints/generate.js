/**
 * Hubly AI Blueprint Generator
 *
 * Permanent rule: Hubly supports businesses — not blueprint files.
 * Official blueprints improve quality. When none exists, generate a temporary
 * Business Blueprint in the same schema and continue Build My Business.
 *
 * Confidence:
 *   Official (handled elsewhere) → ~99%
 *   Known trade seed (AI generated) → ~84%
 *   Generic from description → ~62–78%
 *   Low confidence → clarifying questions before publish (never silent guess).
 */
(function (global) {
  const OFFICIAL_CONFIDENCE = 99;
  const KNOWN_SEED_CONFIDENCE = 84;
  const GENERIC_BASE_CONFIDENCE = 68;
  const LOW_CONFIDENCE_THRESHOLD = 75;

  const STOCK = {
    home: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=80',
    tools: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1400&q=80',
    van: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1400&q=80',
    handshake: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1400&q=80',
    paint: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1400&q=80',
    junk: 'https://images.unsplash.com/photo-1558618047-f4b511aab0b4?auto=format&fit=crop&w=1400&q=80',
    electrical: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1400&q=80',
    plumbing: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1400&q=80',
    crew: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1400&q=80',
  };

  function titleCase(s) {
    return String(s || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'local_service';
  }

  function svc(name, category, price, dur, desc, image, upsells) {
    return {
      name,
      category,
      defaultPrice: String(price),
      dur: String(dur),
      desc,
      image: image || STOCK.home,
      upsells: upsells || [],
    };
  }

  function lifecycle() {
    return [
      { id: 'new', name: 'New' },
      { id: 'growing', name: 'Growing' },
      { id: 'established', name: 'Established' },
    ];
  }

  function defaultRules(trade) {
    return [
      {
        id: 'ask_review',
        if: { daysSinceLastReviewAsk: { gt: 7 } },
        then: { recommend: `Ask a recent ${trade} customer for a review` },
      },
      {
        id: 'stale_portfolio',
        if: { portfolioAgeDays: { gt: 21 } },
        then: { recommend: 'Upload 5 recent job photos' },
      },
    ];
  }

  function defaultPlaybooks() {
    return [
      {
        id: 'job_complete',
        trigger: 'jobComplete',
        actions: ['Request Review', 'Upload Before/After', 'Offer Follow-up'],
      },
    ];
  }

  /** Known home-service seeds — AI-generated quality, not handcrafted official files. */
  const TRADE_SEEDS = {
    electrical: {
      id: 'electrical',
      name: 'Electrical',
      slug: 'electrical',
      description: 'Residential and light commercial electrical service',
      hint: 'Repair, install & panel work',
      synonyms: [
        'electrician',
        'electrical company',
        'electrical contractor',
        'wiring',
        'panel upgrade',
        'outlet',
        'breaker',
      ],
      emptyIcon: '⚡',
      pickerImage: STOCK.electrical,
      catalog: [
        svc('Outlet & Switch Repair', 'Repair', '129', '1', 'Safe diagnosis and replacement for outlets, switches, and GFCI.', STOCK.electrical, ['Surge protection']),
        svc('Lighting Install', 'Install', '189', '2', 'Ceiling fans, fixtures, and recessed lighting done clean and code-aware.', STOCK.home, ['Smart switch']),
        svc('Panel / Breaker Service', 'Electrical', '249', '2.5', 'Breaker replacement and panel troubleshooting for safe power.', STOCK.tools, ['Whole-home surge']),
        svc('EV Charger Install', 'Install', '699', '4', 'Level 2 charger install with proper circuit and permitting guidance.', STOCK.van, ['Panel upgrade']),
        svc('Emergency Call', 'Emergency', '199', '1.5', 'Priority response when power or safety can’t wait.', STOCK.crew, []),
      ],
      knowledge: {
        brandVoice: 'Clear, calm, and safety-first — like a licensed electrician explaining options without scare tactics.',
        customerPsychology: 'Homeowners fear shocks, fires, and surprise bills. Licensing, neat work photos, and upfront ranges build trust.',
        homepageGoals: ['Lead with safety and licensing', 'Show real job photos', 'Make booking or call easy'],
        buyingBehavior: 'Calls for emergencies; compares quotes for installs; books once trust and timing feel clear.',
        trustSignals: ['Licensed & insured', 'Code-compliant', 'Clean job sites'],
        faq: [
          'Are you licensed and insured?',
          'Do you handle panel upgrades?',
          'Can you install EV chargers?',
        ],
        copyRules: ['Never invent licenses or certifications', 'Lead with safety and clarity'],
        galleryRules: ['Show neat panels and finished installs', 'Avoid cluttered unfinished shots as hero'],
        seoTopics: ['electrician near me', 'panel upgrade', 'EV charger install', 'outlet repair'],
        salesStyle: 'Consultative — diagnose, explain options, recommend the safe path',
        pricingPosition: 'mid',
        marketingTone: 'Trustworthy and practical',
        brandPersonality: ['Reliable', 'Safety-minded', 'Straight-talking'],
        targetCustomer: 'Homeowners and small commercial spaces that need trusted electrical work',
        seasonality: 'Storm season and holiday lighting drive spikes; EV installs steady year-round',
        businessGoals: ['More booked installs', 'Faster emergency response', 'Repeat maintenance customers'],
        suggestedUpsells: ['GFCI upgrades', 'Surge protection', 'Smart switches', 'Panel labeling'],
        recommendedCtas: ['Book electrical service', 'Request a quote', 'Call for emergencies'],
      },
      decisionFactors: ['Licensing', 'Safety', 'Availability', 'Clear pricing'],
      customerExpectations: ['Licensed work', 'Clean job site', 'Honest diagnosis', 'On-time arrival'],
      customerJourney: ['Discovery', 'Diagnosis', 'Quote', 'Service', 'Invoice', 'Review'],
      successMetrics: ['bookings', 'averageTicket', 'responseTime', 'reviewCount'],
      homepagePriority: ['hero', 'services', 'reviews', 'about', 'booking', 'contact'],
      trustSignals: ['Licensed', 'Insured', 'Code-aware', 'Clean work'],
      sectionCopy: {
        servicesTitle: 'Electrical Services',
        servicesSub: 'Repairs, installs, and panel work — licensed, neat, and explained in plain English.',
        galleryTitle: 'Recent Jobs',
        gallerySub: 'Finished installs and clean panels from homes we keep safe.',
        reviewsTitle: 'Customer Reviews',
        reviewsSub: 'Homeowners who wanted it done right the first time.',
        whyTitle: 'Why call us',
        whySub: 'Safety first, clear options, and work that looks as good as it performs.',
        reviewPlaceholder: 'They fixed our panel the same week and explained every option without pressure.',
        heroSubFallback: 'Licensed electrical repair and install — done clean, done right.',
        footerCtaTitle: 'Book electrical service',
      },
      bookingMode: 'appointments',
      bookingSteps: [
        { id: 'issue', fields: ['issueType', 'emergency', 'notes'] },
        { id: 'schedule', fields: ['date', 'time', 'address'] },
        { id: 'contact', fields: ['name', 'phone', 'email'] },
        { id: 'review', fields: ['confirm'] },
      ],
      defaultAddons: [
        { name: 'Surge protector', price: 89 },
        { name: 'Same-day priority', price: 75 },
      ],
      layout: 'calm-service',
      styles: ['calm-service', 'classic-trust', 'grid-tech', 'clean-modern'],
      capabilities: {
        appointments: true,
        estimates: true,
        emergencyBanner: true,
        stickyPhone: true,
        portfolio: true,
      },
      performance: {
        prioritize: ['phone', 'booking'],
        flags: { stickyPhone: true, emergencyBanner: true, prioritizeCta: true, prioritizeBooking: true },
      },
      galleryBuckets: ['Repairs', 'Lighting', 'Panels', 'EV Chargers'],
      seedImages: [STOCK.electrical, STOCK.tools, STOCK.home, STOCK.van, STOCK.crew, STOCK.handshake],
    },
    plumbing: {
      id: 'plumbing',
      name: 'Plumbing',
      slug: 'plumbing',
      description: 'Residential plumbing repair and install',
      hint: 'Leaks, drains & installs',
      synonyms: ['plumber', 'plumbing company', 'drain', 'water heater', 'leak', 'pipe'],
      emptyIcon: '🔧',
      pickerImage: STOCK.plumbing,
      catalog: [
        svc('Leak Repair', 'Repair', '149', '1.5', 'Find and fix leaks before they damage floors and walls.', STOCK.plumbing, ['Shutoff upgrade']),
        svc('Drain Clearing', 'Drains', '129', '1', 'Clear stubborn drains without the guesswork.', STOCK.tools, ['Camera inspection']),
        svc('Water Heater Service', 'Install', '349', '3', 'Repair or replace tank and tankless water heaters.', STOCK.home, ['Expansion tank']),
        svc('Fixture Install', 'Install', '189', '2', 'Faucets, toilets, and disposals installed cleanly.', STOCK.handshake, ['Supply lines']),
        svc('Emergency Plumbing', 'Emergency', '219', '1.5', 'Priority help when water won’t wait.', STOCK.crew, []),
      ],
      knowledge: {
        brandVoice: 'Practical and reassuring — stop the water, explain the fix, no upsell scare.',
        customerPsychology: 'Customers panic about water damage and surprise invoices. Speed plus transparent ranges win.',
        homepageGoals: ['Show emergency availability', 'Prove neat, finished work', 'Easy call or book'],
        buyingBehavior: 'Emergency calls first; planned installs compare reviews and arrival windows.',
        trustSignals: ['Licensed & insured', 'Upfront ranges', 'Respectful of the home'],
        faq: ['Do you offer same-day service?', 'Are estimates free?', 'Do you replace water heaters?'],
        copyRules: ['Never invent certifications', 'Lead with speed and care'],
        galleryRules: ['Show finished bathrooms and clean work areas'],
        seoTopics: ['plumber near me', 'leak repair', 'water heater install', 'drain cleaning'],
        salesStyle: 'Direct and calm — diagnose, quote options, fix',
        pricingPosition: 'mid',
        marketingTone: 'Reassuring and local',
        brandPersonality: ['Dependable', 'Clean', 'Honest'],
        targetCustomer: 'Homeowners dealing with leaks, drains, and fixture upgrades',
        seasonality: 'Freeze thaw and holiday hosting drive spikes',
        businessGoals: ['Faster response', 'More water heater installs', 'Repeat maintenance'],
        suggestedUpsells: ['Camera inspection', 'Shutoff valves', 'Water heater flush'],
        recommendedCtas: ['Book a plumber', 'Call for leaks', 'Get a quote'],
      },
      decisionFactors: ['Speed', 'Trust', 'Price clarity', 'Cleanliness'],
      customerExpectations: ['Fast arrival', 'No mess left behind', 'Honest diagnosis'],
      customerJourney: ['Call', 'Dispatch', 'Diagnosis', 'Repair', 'Invoice', 'Review'],
      successMetrics: ['emergencyCalls', 'averageTicket', 'responseTime', 'reviewCount'],
      homepagePriority: ['hero', 'services', 'reviews', 'about', 'booking', 'contact'],
      trustSignals: ['Licensed', 'Insured', 'Same-day options', 'Clean crews'],
      sectionCopy: {
        servicesTitle: 'Plumbing Services',
        servicesSub: 'Leaks, drains, water heaters, and installs — fixed right, explained clearly.',
        galleryTitle: 'Recent Jobs',
        gallerySub: 'Clean finishes from bathrooms, kitchens, and water heater installs.',
        reviewsTitle: 'Customer Reviews',
        reviewsSub: 'Neighbors who needed it fixed today — and stayed for the next project.',
        whyTitle: 'Why call us',
        whySub: 'Show up fast, protect your floors, and leave the job tidy.',
        reviewPlaceholder: 'They stopped the leak the same day and left the bathroom cleaner than they found it.',
        heroSubFallback: 'Plumbing done right — leaks, drains, and installs without the runaround.',
        footerCtaTitle: 'Book a plumber',
      },
      bookingMode: 'appointments',
      bookingSteps: [
        { id: 'issue', fields: ['issueType', 'emergency', 'notes'] },
        { id: 'schedule', fields: ['date', 'time', 'address'] },
        { id: 'contact', fields: ['name', 'phone', 'email'] },
        { id: 'review', fields: ['confirm'] },
      ],
      defaultAddons: [
        { name: 'Camera inspection', price: 99 },
        { name: 'After-hours fee', price: 85 },
      ],
      layout: 'calm-service',
      styles: ['calm-service', 'classic-trust', 'clean-modern'],
      capabilities: {
        appointments: true,
        estimates: true,
        emergencyBanner: true,
        stickyPhone: true,
        portfolio: true,
      },
      performance: {
        prioritize: ['phone', 'booking'],
        flags: { stickyPhone: true, emergencyBanner: true, prioritizeCta: true },
      },
      galleryBuckets: ['Leaks', 'Drains', 'Water Heaters', 'Fixtures'],
      seedImages: [STOCK.plumbing, STOCK.tools, STOCK.home, STOCK.van, STOCK.crew, STOCK.handshake],
    },
    painting: {
      id: 'painting',
      name: 'Painting',
      slug: 'painting',
      description: 'Interior and exterior painting for homes',
      hint: 'Interior & exterior',
      synonyms: ['painter', 'painting company', 'house painter', 'interior paint', 'exterior paint'],
      emptyIcon: '🎨',
      pickerImage: STOCK.paint,
      catalog: [
        svc('Interior Room Paint', 'Interior', '449', '6', 'Prep, prime, and paint one room with clean lines.', STOCK.paint, ['Trim package']),
        svc('Whole-Home Interior', 'Interior', '2499', '40', 'Coordinated interior refresh with consistent color and finish.', STOCK.home, ['Cabinet paint']),
        svc('Exterior Paint', 'Exterior', '3499', '48', 'Weather-ready exterior coating with careful prep.', STOCK.van, ['Deck stain']),
        svc('Cabinet Refinish', 'Specialty', '1899', '24', 'Kitchen cabinets refreshed without a full remodel.', STOCK.handshake, ['Hardware upgrade']),
        svc('Accent Wall', 'Interior', '299', '4', 'One bold wall done clean for a quick refresh.', STOCK.paint, []),
      ],
      knowledge: {
        brandVoice: 'Warm and visual — help people picture the finished room, not paint jargon.',
        customerPsychology: 'Buyers fear mess, uneven coverage, and delayed timelines. Photos and prep talk win jobs.',
        homepageGoals: ['Show finished rooms', 'Explain prep quality', 'Easy estimate request'],
        buyingBehavior: 'Requests quotes with photos; books after seeing past work and timeline clarity.',
        trustSignals: ['Careful prep', 'Clean job sites', 'Color guidance'],
        faq: ['Do you move furniture?', 'How long does a room take?', 'Interior and exterior?'],
        copyRules: ['Lead with finished spaces', 'Never invent awards'],
        galleryRules: ['Bright finished rooms', 'Before/after when available'],
        seoTopics: ['house painters near me', 'interior painting', 'exterior painting', 'cabinet refinishing'],
        salesStyle: 'Visual consult — walk the space, recommend finish, set a clear timeline',
        pricingPosition: 'mid',
        marketingTone: 'Warm and local',
        brandPersonality: ['Careful', 'Visual', 'Reliable'],
        targetCustomer: 'Homeowners refreshing rooms, exteriors, and cabinets',
        seasonality: 'Exterior peaks in dry months; interiors steady year-round',
        businessGoals: ['More whole-home jobs', 'Stronger portfolio', 'Referral reviews'],
        suggestedUpsells: ['Trim package', 'Cabinet paint', 'Deck stain'],
        recommendedCtas: ['Get a painting estimate', 'Book a color consult', 'See our work'],
      },
      decisionFactors: ['Quality', 'Photos', 'Timeline', 'Cleanliness'],
      customerExpectations: ['Clean edges', 'Protected floors', 'On-schedule finish'],
      customerJourney: ['Discovery', 'Estimate', 'Prep', 'Paint', 'Walkthrough', 'Review'],
      successMetrics: ['quotes', 'bookings', 'averageTicket', 'reviewCount'],
      homepagePriority: ['hero', 'gallery', 'services', 'reviews', 'about', 'booking', 'contact'],
      trustSignals: ['Careful prep', 'Insured', 'Clean crews', 'Color help'],
      sectionCopy: {
        servicesTitle: 'Painting Services',
        servicesSub: 'Interior, exterior, and cabinets — prep that lasts and finishes that look sharp.',
        galleryTitle: 'Finished Spaces',
        gallerySub: 'Rooms and exteriors that feel new again.',
        reviewsTitle: 'Customer Reviews',
        reviewsSub: 'Homeowners who wanted it neat, on time, and done once.',
        whyTitle: 'Why choose us',
        whySub: 'Prep, protection, and clean lines — the difference you notice for years.',
        reviewPlaceholder: 'Our living room looks brand new and they left zero mess.',
        heroSubFallback: 'Beautiful paint work with careful prep — interiors, exteriors, and cabinets.',
        footerCtaTitle: 'Get a painting estimate',
      },
      bookingMode: 'quote',
      bookingSteps: [
        { id: 'project', fields: ['rooms', 'interiorExterior', 'notes'] },
        { id: 'schedule', fields: ['date', 'address'] },
        { id: 'contact', fields: ['name', 'phone', 'email'] },
        { id: 'review', fields: ['confirm'] },
      ],
      defaultAddons: [
        { name: 'Trim package', price: 150 },
        { name: 'Furniture move assist', price: 75 },
      ],
      layout: 'clean-modern',
      styles: ['clean-modern', 'classic-trust', 'obsidian-gold'],
      capabilities: { appointments: true, estimates: true, portfolio: true },
      performance: {
        prioritize: ['gallery', 'booking'],
        flags: { progressiveGalleries: true, prioritizeCta: true },
      },
      galleryBuckets: ['Interior', 'Exterior', 'Cabinets', 'Before After'],
      seedImages: [STOCK.paint, STOCK.home, STOCK.handshake, STOCK.crew, STOCK.van, STOCK.tools],
    },
    junk_removal: {
      id: 'junk_removal',
      name: 'Junk Removal',
      slug: 'junk-removal',
      description: 'Haul-away and cleanout for homes and small businesses',
      hint: 'Haul-away & cleanouts',
      synonyms: [
        'junk removal',
        'junk hauling',
        'trash removal',
        'cleanout',
        'haul away',
        'debris removal',
      ],
      emptyIcon: '🛻',
      pickerImage: STOCK.junk,
      catalog: [
        svc('Single-Item Pickup', 'Haul', '99', '1', 'Couches, appliances, and bulky items gone same week.', STOCK.junk, ['Donation drop']),
        svc('Garage Cleanout', 'Cleanout', '349', '3', 'Clear the garage so you can park again.', STOCK.van, ['Donation sorting']),
        svc('Estate / Whole-Home Cleanout', 'Cleanout', '899', '8', 'Respectful full-property cleanouts with sorting help.', STOCK.home, ['Recycling']),
        svc('Construction Debris', 'Debris', '449', '3', 'Post-reno debris hauled responsibly.', STOCK.tools, ['Extra load']),
        svc('Same-Day Haul', 'Priority', '179', '1.5', 'Priority truck when you need it gone today.', STOCK.crew, []),
      ],
      knowledge: {
        brandVoice: 'Friendly and no-nonsense — show up, load fast, leave the space clear.',
        customerPsychology: 'Customers feel overwhelmed by clutter. Speed, fair volume pricing, and respectful crews matter most.',
        homepageGoals: ['Show before/after clear spaces', 'Simple booking', 'Transparent load pricing'],
        buyingBehavior: 'Books after a quick photo quote or volume estimate; urgency drives same-day.',
        trustSignals: ['Careful with property', 'Transparent pricing', 'Responsible disposal'],
        faq: ['How is pricing calculated?', 'Do you donate usable items?', 'Same-day available?'],
        copyRules: ['Lead with clear spaces', 'Avoid shame language about clutter'],
        galleryRules: ['Before/after empty rooms and driveways'],
        seoTopics: ['junk removal near me', 'garage cleanout', 'furniture haul away', 'estate cleanout'],
        salesStyle: 'Fast quote — volume, access, and timing',
        pricingPosition: 'mid',
        marketingTone: 'Helpful and energetic',
        brandPersonality: ['Efficient', 'Respectful', 'Straightforward'],
        targetCustomer: 'Homeowners and small businesses clearing space fast',
        seasonality: 'Spring cleanouts and move season peak',
        businessGoals: ['More same-day jobs', 'Higher average load', 'Referral reviews'],
        suggestedUpsells: ['Donation drop', 'Extra load', 'Appliance disconnect'],
        recommendedCtas: ['Book a haul', 'Get a photo quote', 'Clear my space'],
      },
      decisionFactors: ['Speed', 'Price clarity', 'Care for property', 'Availability'],
      customerExpectations: ['On-time truck', 'Fair volume price', 'Clean left-behind'],
      customerJourney: ['Request', 'Estimate', 'Haul', 'Payment', 'Review'],
      successMetrics: ['bookings', 'averageTicket', 'sameDayRate', 'reviewCount'],
      homepagePriority: ['hero', 'services', 'gallery', 'reviews', 'booking', 'contact'],
      trustSignals: ['Insured', 'Careful crews', 'Responsible disposal'],
      sectionCopy: {
        servicesTitle: 'Junk Removal',
        servicesSub: 'Single items to full cleanouts — booked fast, hauled clean.',
        galleryTitle: 'Before & After',
        gallerySub: 'Spaces cleared so you can use them again.',
        reviewsTitle: 'Customer Reviews',
        reviewsSub: 'Neighbors who needed it gone — without the headache.',
        whyTitle: 'Why us',
        whySub: 'Show up on time, price the load fairly, and leave the driveway clean.',
        reviewPlaceholder: 'They cleared our garage in under two hours and recycled what they could.',
        heroSubFallback: 'Junk gone fast — cleanouts and haul-away without the hassle.',
        footerCtaTitle: 'Book a haul',
      },
      bookingMode: 'appointments',
      bookingSteps: [
        { id: 'load', fields: ['itemType', 'photos', 'notes'] },
        { id: 'schedule', fields: ['date', 'time', 'address'] },
        { id: 'contact', fields: ['name', 'phone', 'email'] },
        { id: 'review', fields: ['confirm'] },
      ],
      defaultAddons: [
        { name: 'Donation drop', price: 40 },
        { name: 'Appliance disconnect', price: 55 },
      ],
      layout: 'clean-modern',
      styles: ['clean-modern', 'garage-industrial', 'classic-trust'],
      capabilities: { appointments: true, estimates: true, portfolio: true },
      performance: {
        prioritize: ['booking', 'gallery'],
        flags: { prioritizeBooking: true, prioritizeCta: true },
      },
      galleryBuckets: ['Cleanouts', 'Furniture', 'Debris', 'Before After'],
      seedImages: [STOCK.junk, STOCK.van, STOCK.home, STOCK.crew, STOCK.tools, STOCK.handshake],
    },
  };

  const TRADE_ALIASES = {
    electrician: 'electrical',
    electrical: 'electrical',
    plumbing: 'plumbing',
    plumber: 'plumbing',
    painting: 'painting',
    painter: 'painting',
    junk_removal: 'junk_removal',
    'junk-removal': 'junk_removal',
    junk: 'junk_removal',
    hauling: 'junk_removal',
  };

  function inferTradeKey(text) {
    const t = String(text || '').toLowerCase();
    if (!t) return null;
    for (const [alias, key] of Object.entries(TRADE_ALIASES)) {
      if (t === alias || t.includes(alias.replace(/_/g, ' ')) || t.includes(alias)) return key;
    }
    for (const [key, seed] of Object.entries(TRADE_SEEDS)) {
      if (t.includes(key.replace(/_/g, ' ')) || t.includes(seed.name.toLowerCase())) return key;
      for (const syn of seed.synonyms || []) {
        if (syn.length >= 4 && t.includes(syn.toLowerCase())) return key;
      }
    }
    return null;
  }

  function buildFromSeed(seed, opts) {
    const answers = (opts && opts.answers) || {};
    const name = answers.displayName || seed.name;
    const confidence = Math.min(
      92,
      KNOWN_SEED_CONFIDENCE + (answers.mainServices ? 4 : 0) + (answers.idealCustomer ? 3 : 0) + (answers.bookingStyle ? 2 : 0),
    );
    const catalog = answers.mainServices && Array.isArray(answers.mainServices) && answers.mainServices.length
      ? answers.mainServices.map((s, i) => {
          if (typeof s === 'string') {
            return svc(s, 'Services', seed.catalog[i]?.defaultPrice || '149', seed.catalog[i]?.dur || '2', `Professional ${s.toLowerCase()} for local customers.`, seed.catalog[i]?.image || STOCK.home);
          }
          return s;
        })
      : seed.catalog;

    const k = seed.knowledge;
    const bp = {
      version: '1.0',
      runtimeMinVersion: '1.0',
      id: seed.id,
      identity: {
        name,
        slug: seed.slug,
        description: seed.description,
        hint: seed.hint,
        pickerImage: seed.pickerImage,
        specialties: [
          { id: 'residential', name: 'Residential', default: true, overrides: {} },
          { id: 'commercial', name: 'Commercial', default: false, overrides: {} },
        ],
        synonyms: seed.synonyms || [],
      },
      knowledge: {
        brandVoice: k.brandVoice,
        customerPsychology: k.customerPsychology,
        homepageGoals: k.homepageGoals,
        buyingBehavior: k.buyingBehavior,
        trustSignals: k.trustSignals,
        faq: k.faq || [],
        copyRules: k.copyRules || [],
        galleryRules: k.galleryRules || [],
        seoTopics: k.seoTopics || [],
        salesStyle: k.salesStyle,
        pricingPosition: k.pricingPosition,
        marketingTone: k.marketingTone,
        brandPersonality: k.brandPersonality,
        targetCustomer: answers.idealCustomer || k.targetCustomer,
        seasonality: k.seasonality,
        businessGoals: k.businessGoals,
        suggestedUpsells: k.suggestedUpsells,
        recommendedCtas: k.recommendedCtas,
        commonQuestions: k.faq || [],
      },
      capabilities: Object.assign(
        {
          appointments: true,
          estimates: true,
          memberships: false,
          inventory: false,
          portfolio: true,
          vehicleDetails: false,
          dirtySurcharge: false,
          clientGalleries: false,
          contracts: false,
          printStore: false,
          staffScheduling: false,
          giftCards: false,
          emergencyBanner: false,
          stickyPhone: false,
          hubly_pro: true,
        },
        seed.capabilities || {},
      ),
      customerJourney: seed.customerJourney,
      decisionFactors: seed.decisionFactors,
      customerExpectations: seed.customerExpectations,
      successMetrics: seed.successMetrics,
      businessLifecycle: lifecycle(),
      homepage: { priority: seed.homepagePriority },
      website: {
        defaultLayout: seed.layout,
        recommendedStyles: seed.styles,
        sections: {
          required: ['hero', 'services', 'about', 'contact'],
          optional: ['faq', 'gallery', 'pricing'],
          recommended: ['reviews', 'booking'],
        },
        sectionConfig: {},
        trustSignals: seed.trustSignals,
        emptyIcon: seed.emptyIcon || '◆',
        sectionCopy: seed.sectionCopy,
      },
      booking: {
        mode: answers.bookingStyle || seed.bookingMode || 'appointments',
        steps: seed.bookingSteps,
        defaultAddons: seed.defaultAddons || [],
      },
      services: { catalog },
      gallery: {
        mode: 'before_after',
        buckets: seed.galleryBuckets || ['Recent Work'],
        seedImages: seed.seedImages,
      },
      growth: {
        weeklyGoals: ['Upload recent job photos', 'Ask for a review', 'Follow up on open quotes'],
        businessHealth: ['reviewCount', 'responseTime', 'bookingRate', 'portfolioFreshness'],
        seasonalCampaigns: [],
        byLifecycle: {},
      },
      decisionRules: defaultRules(seed.name),
      playbooks: defaultPlaybooks(),
      automation: { enabledTriggers: ['jobComplete'] },
      dashboard: { widgets: ['todays_jobs', 'new_bookings', 'reviews'] },
      performance: seed.performance || {
        prioritize: ['booking'],
        flags: { prioritizeBooking: true, prioritizeCta: true },
      },
      _meta: {
        source: 'ai_generated',
        confidence,
        generatedAt: new Date().toISOString(),
        seedId: seed.id,
        temporary: true,
      },
    };
    return { blueprint: bp, confidence, source: 'ai_generated', clarifyingQuestions: [], needsClarification: false };
  }

  function buildGeneric(description, opts) {
    const answers = (opts && opts.answers) || {};
    const raw = String(description || 'local service').trim();
    const id = slugify(answers.tradeId || raw);
    const name = answers.displayName || titleCase(raw.replace(/\b(i own|i run|we are|we run|my|an?|company|business)\b/gi, ' ').replace(/\s+/g, ' ').trim() || 'Local Service');
    const services = (answers.mainServices && answers.mainServices.length)
      ? answers.mainServices
      : [`${name} Visit`, `${name} Package`, `${name} Consult`];
    const catalog = services.slice(0, 6).map((s, i) => {
      const label = typeof s === 'string' ? s : s.name;
      return svc(
        label,
        'Services',
        [129, 189, 249, 99][i % 4],
        [1.5, 2, 3, 1][i % 4],
        `Professional ${String(label).toLowerCase()} for customers in your area.`,
        [STOCK.home, STOCK.tools, STOCK.van, STOCK.handshake][i % 4],
        i === 0 ? ['Priority scheduling'] : [],
      );
    });

    let confidence = GENERIC_BASE_CONFIDENCE;
    if (raw.length >= 12) confidence += 4;
    if (answers.mainServices && answers.mainServices.length >= 2) confidence += 8;
    if (answers.idealCustomer) confidence += 5;
    if (answers.bookingStyle) confidence += 3;
    if (raw.split(/\s+/).length <= 2 && !answers.mainServices) confidence -= 10;
    confidence = Math.max(40, Math.min(88, confidence));

    const questions = [];
    if (!answers.mainServices || answers.mainServices.length < 2) {
      questions.push('What are your 2–3 main services customers book most?');
    }
    if (!answers.idealCustomer) {
      questions.push('Who is your ideal customer — homeowners, property managers, or commercial?');
    }
    if (!answers.bookingStyle) {
      questions.push('How do customers usually start — book an appointment, request a quote, or call first?');
    }

    const needsClarification = confidence < LOW_CONFIDENCE_THRESHOLD && questions.length > 0;
    const target = answers.idealCustomer || `Local customers who need ${name.toLowerCase()}`;
    const voice = `Warm, clear, and local — speak like a trusted ${name.toLowerCase()} owner, not an agency.`;

    const bp = {
      version: '1.0',
      runtimeMinVersion: '1.0',
      id,
      identity: {
        name,
        slug: id.replace(/_/g, '-'),
        description: `${name} for local customers`,
        hint: raw.slice(0, 60),
        pickerImage: STOCK.home,
        specialties: [{ id: 'general', name: 'General', default: true, overrides: {} }],
        synonyms: [raw.toLowerCase(), name.toLowerCase()].filter(Boolean),
      },
      knowledge: {
        brandVoice: voice,
        customerPsychology: `Customers want to trust that ${name.toLowerCase()} will show up, communicate clearly, and deliver what was promised.`,
        homepageGoals: ['Show what you do clearly', 'Build local trust', 'Make contact or booking easy'],
        buyingBehavior: 'Compares services and reviews, then books or messages when the next step feels simple.',
        trustSignals: ['Insured', 'Local', 'Clear communication'],
        faq: questions.length ? questions : ['What areas do you serve?', 'How do I book?', 'What’s included?'],
        copyRules: ['Never invent awards or fake reviews', 'Stay inside this trade'],
        galleryRules: ['Prefer real job photos when available'],
        seoTopics: [`${name.toLowerCase()} near me`, `${name.toLowerCase()} services`, `book ${name.toLowerCase()}`],
        salesStyle: 'Friendly consult — listen, recommend, book',
        pricingPosition: 'mid',
        marketingTone: 'Local and helpful',
        brandPersonality: ['Reliable', 'Clear', 'Helpful'],
        targetCustomer: target,
        seasonality: 'Demand follows local seasons and weather',
        businessGoals: ['More booked jobs', 'Faster replies', 'More reviews'],
        suggestedUpsells: ['Priority scheduling', 'Maintenance plan', 'Add-on visit'],
        recommendedCtas: [`Book ${name}`, 'Get a quote', 'Contact us'],
        commonQuestions: ['What’s included?', 'How soon can you come?', 'Do you serve my area?'],
      },
      capabilities: {
        appointments: true,
        estimates: true,
        memberships: false,
        inventory: false,
        portfolio: true,
        vehicleDetails: false,
        dirtySurcharge: false,
        clientGalleries: false,
        contracts: false,
        printStore: false,
        staffScheduling: false,
        giftCards: false,
        emergencyBanner: false,
        stickyPhone: true,
        hubly_pro: true,
      },
      customerJourney: ['Discovery', 'Inquiry', 'Booking', 'Service', 'Payment', 'Review'],
      decisionFactors: ['Trust', 'Reviews', 'Price clarity', 'Availability'],
      customerExpectations: ['Clear packages', 'On-time arrival', 'Easy booking', 'Good communication'],
      successMetrics: ['bookings', 'averageTicket', 'reviewCount', 'responseTime'],
      businessLifecycle: lifecycle(),
      homepage: { priority: ['hero', 'services', 'reviews', 'about', 'booking', 'contact'] },
      website: {
        defaultLayout: 'clean-modern',
        recommendedStyles: ['clean-modern', 'classic-trust', 'calm-service'],
        sections: {
          required: ['hero', 'services', 'about', 'contact'],
          optional: ['faq', 'gallery', 'pricing'],
          recommended: ['reviews', 'booking'],
        },
        sectionConfig: {},
        trustSignals: ['Local', 'Insured', 'Easy booking'],
        emptyIcon: '◆',
        sectionCopy: {
          servicesTitle: 'Our Services',
          servicesSub: `Professional ${name.toLowerCase()} offerings, ready to book.`,
          galleryTitle: 'Recent Work',
          gallerySub: 'Real jobs from customers in your area.',
          reviewsTitle: 'Customer Reviews',
          reviewsSub: 'Trusted by neighbors who booked and came back.',
          whyTitle: 'Why choose us',
          whySub: 'Clear packages, careful work, and easy next steps.',
          reviewPlaceholder: `Great experience with ${name} — would book again.`,
          heroSubFallback: `${name} done right — clear packages and easy booking.`,
          footerCtaTitle: `Book ${name}`,
        },
      },
      booking: {
        mode: answers.bookingStyle || 'appointments',
        steps: [
          { id: 'service', fields: ['service', 'notes'] },
          { id: 'schedule', fields: ['date', 'time', 'address'] },
          { id: 'contact', fields: ['name', 'phone', 'email'] },
          { id: 'review', fields: ['confirm'] },
        ],
        defaultAddons: [{ name: 'Priority scheduling', price: 45 }],
      },
      services: { catalog },
      gallery: {
        mode: 'before_after',
        buckets: ['Recent Work', 'Before After'],
        seedImages: [STOCK.home, STOCK.tools, STOCK.van, STOCK.handshake, STOCK.crew, STOCK.paint],
      },
      growth: {
        weeklyGoals: ['Upload recent job photos', 'Ask for a review', 'Follow up on leads'],
        businessHealth: ['reviewCount', 'responseTime', 'bookingRate', 'portfolioFreshness'],
        seasonalCampaigns: [],
        byLifecycle: {},
      },
      decisionRules: defaultRules(name),
      playbooks: defaultPlaybooks(),
      automation: { enabledTriggers: ['jobComplete'] },
      dashboard: { widgets: ['todays_jobs', 'new_bookings', 'reviews'] },
      performance: {
        prioritize: ['booking', 'reviews'],
        flags: { prioritizeBooking: true, prioritizeCta: true, stickyPhone: true },
      },
      _meta: {
        source: 'ai_generated',
        confidence,
        generatedAt: new Date().toISOString(),
        temporary: true,
        fromDescription: raw.slice(0, 200),
      },
    };

    return {
      blueprint: bp,
      confidence,
      source: 'ai_generated',
      clarifyingQuestions: needsClarification ? questions.slice(0, 3) : [],
      needsClarification,
    };
  }

  /**
   * Generate a temporary Business Blueprint in the official schema.
   * @param {string|object} input description string or { description, tradeKey, answers }
   */
  function generate(input, opts) {
    const options = Object.assign({}, typeof input === 'object' && input && !Array.isArray(input) ? input : null, opts || {});
    const description = typeof input === 'string' ? input : options.description || options.tradeKey || '';
    const tradeKey = options.tradeKey || inferTradeKey(description) || inferTradeKey(options.id);
    if (tradeKey && TRADE_SEEDS[tradeKey]) {
      return buildFromSeed(TRADE_SEEDS[tradeKey], options);
    }
    return buildGeneric(description || options.id || 'local service', options);
  }

  function ensure(idOrDescription, opts) {
    const result = generate(idOrDescription, opts);
    const V = global.HublyBlueprintValidator;
    if (V) {
      const check = V.validateBlueprint(result.blueprint, { runtimeVersion: '1.0' });
      if (!check.ok) {
        console.error('HublyBlueprintGenerator: invalid generated blueprint', result.blueprint.id, check.errors);
        return null;
      }
    }
    return result;
  }

  /** Apply owner edits → evolve generated blueprint; mark Hybrid when starting from AI. */
  function evolve(blueprint, patch) {
    if (!blueprint || typeof blueprint !== 'object') return null;
    const bp = JSON.parse(JSON.stringify(blueprint));
    const p = patch || {};
    if (Array.isArray(p.services) && p.services.length) {
      bp.services = bp.services || {};
      bp.services.catalog = p.services.map((s, i) => ({
        name: s.name || `Service ${i + 1}`,
        category: s.category || 'Services',
        defaultPrice: String(s.price != null ? s.price : s.defaultPrice != null ? s.defaultPrice : '0'),
        dur: String(s.dur != null ? s.dur : '2'),
        desc: s.desc || s.description || `Professional ${String(s.name || 'service').toLowerCase()}.`,
        image: s.image || s.imgUrl || STOCK.home,
        upsells: s.upsells || [],
      }));
    }
    if (p.pricingPosition || p.pricingTier) {
      bp.knowledge = bp.knowledge || {};
      bp.knowledge.pricingPosition = p.pricingPosition || bp.knowledge.pricingPosition;
    }
    if (p.messaging || p.heroSub || p.brandVoice) {
      bp.knowledge = bp.knowledge || {};
      if (p.brandVoice) bp.knowledge.brandVoice = p.brandVoice;
      if (p.messaging) bp.knowledge.marketingTone = p.messaging;
      if (p.heroSub && bp.website && bp.website.sectionCopy) {
        bp.website.sectionCopy.heroSubFallback = p.heroSub;
      }
    }
    if (p.positioning || p.targetCustomer) {
      bp.knowledge = bp.knowledge || {};
      bp.knowledge.targetCustomer = p.targetCustomer || p.positioning || bp.knowledge.targetCustomer;
    }
    const prev = (bp._meta && bp._meta.source) || 'ai_generated';
    const nextSource = prev === 'official' ? 'hybrid' : prev === 'hybrid' ? 'hybrid' : 'hybrid';
    bp._meta = Object.assign({}, bp._meta || {}, {
      source: nextSource,
      confidence: Math.min(95, ((bp._meta && bp._meta.confidence) || KNOWN_SEED_CONFIDENCE) + 3),
      evolvedAt: new Date().toISOString(),
      temporary: prev !== 'official',
    });
    return { blueprint: bp, source: nextSource, confidence: bp._meta.confidence };
  }

  function dnaFieldsFromResult(result) {
    if (!result || !result.blueprint) {
      return { blueprintSource: null, blueprintConfidence: null, blueprintId: null };
    }
    const src = (result.blueprint._meta && result.blueprint._meta.source) || result.source || 'ai_generated';
    const map = { official: 'official', ai_generated: 'ai_generated', hybrid: 'hybrid' };
    return {
      blueprintSource: map[src] || 'ai_generated',
      blueprintConfidence: result.confidence != null ? result.confidence : (result.blueprint._meta && result.blueprint._meta.confidence) || null,
      blueprintId: result.blueprint.id || null,
    };
  }

  function officialMeta(bp) {
    return {
      blueprint: Object.assign({}, bp, {
        _meta: Object.assign({}, (bp && bp._meta) || {}, {
          source: 'official',
          confidence: OFFICIAL_CONFIDENCE,
          temporary: false,
        }),
      }),
      source: 'official',
      confidence: OFFICIAL_CONFIDENCE,
      clarifyingQuestions: [],
      needsClarification: false,
    };
  }

  global.HublyBlueprintGenerator = {
    OFFICIAL_CONFIDENCE,
    KNOWN_SEED_CONFIDENCE,
    LOW_CONFIDENCE_THRESHOLD,
    TRADE_SEEDS,
    slugify,
    inferTradeKey,
    generate,
    ensure,
    evolve,
    dnaFieldsFromResult,
    officialMeta,
    listSeedIds: () => Object.keys(TRADE_SEEDS),
  };
})(typeof window !== 'undefined' ? window : globalThis);
