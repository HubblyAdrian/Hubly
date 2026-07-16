/**
 * Hubly Smart Quote — shared pricing framework.
 * Blueprint / trade recipes declare fields + rules.
 * Owner overrides (S.quoteConfig) can add/remove packages, fields, and rules.
 */
(function (global) {
  const CONTACT_FIELDS = [
    { id: 'name', type: 'text', label: 'Customer name', required: true },
    { id: 'phone', type: 'text', label: 'Phone', required: true },
    { id: 'email', type: 'text', label: 'Email', required: false },
    { id: 'notes', type: 'textarea', label: 'Notes', required: false },
  ];

  /** Trade recipes — open to owner overlay; photography never gets dirtiness. */
  const RECIPES = {
    detailing: {
      accent: '#7c3aed',
      title: 'Smart Quote',
      subtitle: 'Vehicle · packages · condition',
      includes: ['Pro products', 'Satisfaction guarantee', 'Mobile available'],
      tip: { title: 'AI tip', body: 'Ceramic coating converts well after Full Detail on SUVs.' },
      steps: [
        { id: 'subject', title: 'What are we working on?', blurb: 'Vehicle type drives size pricing.' },
        { id: 'packages', title: 'Choose packages', blurb: 'Pick one or more services.' },
        { id: 'modifiers', title: 'Condition & extras', blurb: 'Dirt level and add-ons.' },
        { id: 'customer', title: 'Customer', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        vehicleType: {
          step: 'subject',
          type: 'tiles',
          label: 'Vehicle type',
          options: [
            { id: 'sedan', label: 'Sedan', surcharge: 0 },
            { id: 'coupe', label: 'Coupe', surcharge: 0 },
            { id: 'crossover', label: 'Crossover', surcharge: 15 },
            { id: 'suv', label: 'SUV', surcharge: 36 },
            { id: 'truck', label: 'Truck', surcharge: 36 },
            { id: 'van', label: 'Van', surcharge: 50 },
          ],
        },
        year: { step: 'subject', type: 'text', label: 'Year', optional: true },
        make: { step: 'subject', type: 'text', label: 'Make', optional: true },
        model: { step: 'subject', type: 'text', label: 'Model', optional: true },
        color: { step: 'subject', type: 'text', label: 'Color', optional: true },
        condition: {
          step: 'modifiers',
          type: 'tiles',
          label: 'Dirtiness',
          options: [
            { id: 'light', label: 'Lightly dirty', desc: 'Dust, light crumbs', rule: { type: 'percent', value: 0 } },
            { id: 'moderate', label: 'Moderately dirty', desc: 'Average driver', rule: { type: 'percent', value: 10 } },
            { id: 'heavy', label: 'Heavily soiled', desc: 'Stains, grime', rule: { type: 'percent', value: 20 } },
            { id: 'extreme', label: 'Extreme', desc: 'Pets, sand, disaster', rule: { type: 'percent', value: 35 } },
          ],
        },
      },
    },
    windows: {
      accent: '#0284c7',
      title: 'Smart Quote',
      subtitle: 'Property · panes · stories',
      includes: ['Interior & exterior options', 'Ladder-safe habits', 'No-streak standard'],
      tip: { title: 'Save with recurring', body: 'Offer 15% off quarterly window plans.' },
      steps: [
        { id: 'subject', title: 'Property details', blurb: 'Type, height, and pane count set the math.' },
        { id: 'packages', title: 'Choose services', blurb: 'What are we quoting?' },
        { id: 'modifiers', title: 'Extras', blurb: 'Screens, tracks, and add-ons.' },
        { id: 'customer', title: 'Customer', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        propertyType: {
          step: 'subject',
          type: 'tiles',
          label: 'Property',
          options: [
            { id: 'residential', label: 'Residential', surcharge: 0 },
            { id: 'commercial', label: 'Commercial', surcharge: 40 },
          ],
        },
        stories: {
          step: 'subject',
          type: 'stepper',
          label: 'Stories',
          min: 1,
          max: 4,
          default: 1,
          rule: { type: 'per_unit_above', amount: 35, above: 1, unitLabel: 'extra story' },
        },
        paneCountApprox: {
          step: 'subject',
          type: 'range',
          label: 'Approx. panes',
          min: 6,
          max: 60,
          step: 2,
          default: 12,
          rule: { type: 'per_unit', amount: 7, unitLabel: 'pane', baseUnits: 8 },
        },
      },
    },
    photography: {
      accent: '#db2777',
      title: 'Smart Quote',
      subtitle: 'Session · hours · travel',
      includes: ['Edited gallery', 'Online delivery', 'Print rights options'],
      tip: { title: 'Most popular', body: 'Couples often book 9–12 months ahead — lock the date.' },
      steps: [
        { id: 'subject', title: 'Session type', blurb: 'What kind of shoot?' },
        { id: 'packages', title: 'Packages', blurb: 'Pick coverage.' },
        { id: 'modifiers', title: 'Hours & travel', blurb: 'Fine-tune the estimate.' },
        { id: 'customer', title: 'Client', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        sessionType: {
          step: 'subject',
          type: 'tiles',
          label: 'What kind of shoot?',
          options: [
            { id: 'wedding', label: 'Wedding', surcharge: 0 },
            { id: 'portrait', label: 'Portrait', surcharge: 0 },
            { id: 'family', label: 'Family', surcharge: 0 },
            { id: 'event', label: 'Event', surcharge: 50 },
            { id: 'brand', label: 'Brand / product', surcharge: 75 },
          ],
        },
        hours: {
          step: 'modifiers',
          type: 'stepper',
          label: 'How many hours of coverage?',
          min: 1,
          max: 12,
          default: 2,
          rule: { type: 'per_unit_above', amount: 150, above: 2, unitLabel: 'extra hour' },
        },
        travelMiles: {
          step: 'modifiers',
          type: 'range',
          label: 'Travel (miles)',
          min: 0,
          max: 120,
          step: 5,
          default: 0,
          optional: true,
          rule: { type: 'per_unit_above', amount: 1.5, above: 25, unitLabel: 'mile' },
        },
        secondShooter: {
          step: 'modifiers',
          type: 'toggle',
          label: 'Add a second shooter',
          rule: { type: 'flat', amount: 350 },
        },
      },
    },
    cleaning: {
      accent: '#059669',
      title: 'Smart Quote',
      subtitle: 'Home size · frequency',
      includes: ['Checklist clean', 'Background-checked crew', 'Supplies included'],
      tip: { title: 'Bundle & save', body: 'Weekly plans usually beat one-off deep cleans on cost.' },
      steps: [
        { id: 'subject', title: 'Home details', blurb: 'Rooms drive labor time.' },
        { id: 'packages', title: 'Cleaning plan', blurb: 'Standard, deep, or move-out.' },
        { id: 'modifiers', title: 'Frequency & extras', blurb: 'How often and any add-ons.' },
        { id: 'customer', title: 'Customer', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        bedrooms: {
          step: 'subject',
          type: 'stepper',
          label: 'Bedrooms',
          min: 1,
          max: 8,
          default: 3,
          rule: { type: 'per_unit_above', amount: 20, above: 2, unitLabel: 'bedroom' },
        },
        bathrooms: {
          step: 'subject',
          type: 'stepper',
          label: 'Bathrooms',
          min: 1,
          max: 6,
          default: 2,
          rule: { type: 'per_unit_above', amount: 25, above: 1, unitLabel: 'bath' },
        },
        pets: {
          step: 'subject',
          type: 'toggle',
          label: 'Pets in home',
          rule: { type: 'flat', amount: 20 },
        },
        frequency: {
          step: 'modifiers',
          type: 'tiles',
          label: 'Frequency',
          options: [
            { id: 'one_time', label: 'One-time', rule: { type: 'percent', value: 0 } },
            { id: 'biweekly', label: 'Biweekly', rule: { type: 'percent', value: -10 } },
            { id: 'weekly', label: 'Weekly', rule: { type: 'percent', value: -15 } },
          ],
        },
      },
    },
    hvac: {
      accent: '#ea580c',
      title: 'Smart Quote',
      subtitle: 'Issue · system · urgency',
      includes: ['Licensed techs', 'Clear diagnosis', 'Maintenance plans'],
      tip: { title: 'Emergency?', body: 'Same-day emergency visits often need a priority dispatch fee.' },
      steps: [
        { id: 'subject', title: 'What do they need?', blurb: 'Issue and system type.' },
        { id: 'packages', title: 'Service', blurb: 'Repair, tune-up, or install.' },
        { id: 'modifiers', title: 'Urgency', blurb: 'Emergency adds priority fee.' },
        { id: 'customer', title: 'Customer', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        issueType: {
          step: 'subject',
          type: 'tiles',
          label: 'Help needed',
          options: [
            { id: 'repair', label: 'Repair', surcharge: 0 },
            { id: 'maintenance', label: 'Maintenance', surcharge: 0 },
            { id: 'install', label: 'Installation', surcharge: 100 },
            { id: 'emergency', label: 'Emergency', surcharge: 75 },
          ],
        },
        systemType: {
          step: 'subject',
          type: 'tiles',
          label: 'System',
          options: [
            { id: 'ac', label: 'AC', surcharge: 0 },
            { id: 'furnace', label: 'Furnace', surcharge: 0 },
            { id: 'heat_pump', label: 'Heat pump', surcharge: 25 },
            { id: 'other', label: 'Other', surcharge: 0 },
          ],
        },
        emergency: {
          step: 'modifiers',
          type: 'toggle',
          label: 'After-hours / emergency dispatch',
          rule: { type: 'flat', amount: 95 },
        },
      },
    },
    pressure_washing: {
      accent: '#0f766e',
      title: 'Smart Quote',
      subtitle: 'Surface · size · stories',
      includes: ['Soft wash when needed', 'Careful around plants', 'Before/after photos'],
      tip: { title: 'House + driveway', body: 'Bundling house wash with driveway often lifts ticket size.' },
      steps: [
        { id: 'subject', title: 'What are we cleaning?', blurb: 'Surface and size.' },
        { id: 'packages', title: 'Services', blurb: 'House, driveway, deck…' },
        { id: 'modifiers', title: 'Scale', blurb: 'Stories and sq ft adjust price.' },
        { id: 'customer', title: 'Customer', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        surfaceType: {
          step: 'subject',
          type: 'tiles',
          label: 'Surface',
          options: [
            { id: 'siding', label: 'House / siding', surcharge: 0 },
            { id: 'driveway', label: 'Driveway', surcharge: 0 },
            { id: 'deck', label: 'Deck', surcharge: 25 },
            { id: 'roof', label: 'Roof soft wash', surcharge: 80 },
          ],
        },
        approxSqFt: {
          step: 'modifiers',
          type: 'range',
          label: 'Approx. sq ft',
          min: 200,
          max: 5000,
          step: 100,
          default: 1200,
          rule: { type: 'per_unit_above', amount: 0.08, above: 800, unitLabel: 'sq ft' },
        },
        stories: {
          step: 'modifiers',
          type: 'stepper',
          label: 'Stories',
          min: 1,
          max: 3,
          default: 1,
          rule: { type: 'per_unit_above', amount: 75, above: 1, unitLabel: 'story' },
        },
      },
    },
    landscaping: {
      accent: '#65a30d',
      title: 'Smart Quote',
      subtitle: 'Lot · frequency',
      includes: ['Edging & blow-off', 'Reliable routes', 'Seasonal plans'],
      tip: { title: 'Recurring wins', body: 'Weekly mowing keeps tickets predictable for both sides.' },
      steps: [
        { id: 'subject', title: 'Property', blurb: 'Lot size sets the base labor.' },
        { id: 'packages', title: 'Services', blurb: 'Mow, garden, mulch…' },
        { id: 'modifiers', title: 'Frequency', blurb: 'How often?' },
        { id: 'customer', title: 'Customer', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        lotSize: {
          step: 'subject',
          type: 'tiles',
          label: 'Lot size',
          options: [
            { id: 'small', label: 'Small', surcharge: 0 },
            { id: 'medium', label: 'Medium', surcharge: 15 },
            { id: 'large', label: 'Large', surcharge: 35 },
            { id: 'estate', label: 'Estate', surcharge: 75 },
          ],
        },
        frequency: {
          step: 'modifiers',
          type: 'tiles',
          label: 'Frequency',
          options: [
            { id: 'one_time', label: 'One-time', rule: { type: 'percent', value: 0 } },
            { id: 'biweekly', label: 'Biweekly', rule: { type: 'percent', value: -5 } },
            { id: 'weekly', label: 'Weekly', rule: { type: 'percent', value: -10 } },
          ],
        },
      },
    },
    spa: {
      accent: '#a855f7',
      title: 'Smart Quote',
      subtitle: 'Treatment · length',
      includes: ['Licensed practitioners', 'Quiet rooms', 'Membership options'],
      tip: { title: 'Upsell', body: 'Add-on mask or aromatherapy pairs well with facials.' },
      steps: [
        { id: 'subject', title: 'Treatment preferences', blurb: 'Service style and length.' },
        { id: 'packages', title: 'Menu', blurb: 'Pick treatments.' },
        { id: 'modifiers', title: 'Duration extras', blurb: 'Longer sessions and prefs.' },
        { id: 'customer', title: 'Guest', blurb: 'Who is this quote for?' },
        { id: 'review', title: 'Review & send', blurb: 'Confirm the estimate.' },
      ],
      fields: {
        serviceType: {
          step: 'subject',
          type: 'tiles',
          label: 'Focus',
          options: [
            { id: 'facial', label: 'Facial', surcharge: 0 },
            { id: 'massage', label: 'Massage', surcharge: 0 },
            { id: 'wellness', label: 'Wellness', surcharge: 20 },
          ],
        },
        duration: {
          step: 'modifiers',
          type: 'tiles',
          label: 'Duration',
          options: [
            { id: '60', label: '60 min', surcharge: 0 },
            { id: '90', label: '90 min', surcharge: 45 },
            { id: '120', label: '120 min', surcharge: 90 },
          ],
        },
        practitionerPref: {
          step: 'modifiers',
          type: 'text',
          label: 'Practitioner preference',
          optional: true,
        },
      },
    },
  };

  const ALIASES = {
    'window-cleaning': 'windows',
    windows: 'windows',
    house_cleaning: 'cleaning',
    'house-cleaning': 'cleaning',
    lawn_care: 'landscaping',
    'lawn-care': 'landscaping',
    pressure_washing: 'pressure_washing',
    'pressure-washing': 'pressure_washing',
  };

  function recipeId(businessType) {
    const raw = String(businessType || '').toLowerCase().trim();
    if (RECIPES[raw]) return raw;
    if (ALIASES[raw]) return ALIASES[raw];
    return 'detailing';
  }

  function deepClone(o) {
    return JSON.parse(JSON.stringify(o || {}));
  }

  function money(n) {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return v;
  }

  function formatMoney(n) {
    return '$' + money(n).toFixed(2).replace(/\.00$/, '');
  }

  /** Industry photos + blurbs for tile options (Book Now + Smart Quote). */
  const TILE_ART = {
    photography: {
      sessionType: {
        wedding: {
          image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80',
          desc: 'Ceremonies, elopements & wedding celebrations.',
        },
        portrait: {
          image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80',
          desc: 'Individual, headshots & personal branding.',
        },
        family: {
          image: 'https://images.unsplash.com/photo-1606216794074-735e91aa2c92?auto=format&fit=crop&w=600&q=80',
          desc: 'Families, kids & milestone moments.',
        },
        event: {
          image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=600&q=80',
          desc: 'Parties, corporate events & special occasions.',
        },
        brand: {
          image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
          desc: 'Products, branding & commercial shoots.',
        },
      },
    },
    detailing: {
      vehicleType: {
        sedan: {
          image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=600&q=80',
          desc: 'Sedans & everyday cars',
        },
        coupe: {
          image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
          desc: 'Coupes & sportier profiles',
        },
        crossover: {
          image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=600&q=80',
          desc: 'Crossovers & compact SUVs',
        },
        suv: {
          image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=600&q=80',
          desc: 'Full-size SUVs',
        },
        truck: {
          image: 'https://images.unsplash.com/photo-1601362840469-51e4d8be744f?auto=format&fit=crop&w=600&q=80',
          desc: 'Pickups & trucks',
        },
        van: {
          image: 'https://images.unsplash.com/photo-1527786356703-4b100091cd2c?auto=format&fit=crop&w=600&q=80',
          desc: 'Vans & large cabins',
        },
      },
      condition: {
        light: { desc: 'Dust, light crumbs' },
        moderate: { desc: 'Average daily driver' },
        heavy: { desc: 'Stains and deep grime' },
        extreme: { desc: 'Pets, sand, disaster-level' },
      },
    },
    windows: {
      propertyType: {
        residential: {
          image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80',
          desc: 'Homes & townhouses',
        },
        commercial: {
          image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
          desc: 'Offices & storefronts',
        },
      },
    },
    cleaning: {
      frequency: {
        one_time: {
          image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
          desc: 'One deep clean when you need it',
        },
        biweekly: {
          image: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=600&q=80',
          desc: 'Steady tidy every other week',
        },
        weekly: {
          image: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80',
          desc: 'Weekly care that stays ahead',
        },
      },
    },
    hvac: {
      issueType: {
        repair: {
          image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
          desc: 'Something isn’t working right',
        },
        maintenance: {
          image: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=600&q=80',
          desc: 'Tune-up & seasonal check',
        },
        install: {
          image: 'https://images.unsplash.com/photo-1631545806609-2adb8b34122a?auto=format&fit=crop&w=600&q=80',
          desc: 'New system or replacement',
        },
        emergency: {
          image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=600&q=80',
          desc: 'Same-day priority help',
        },
      },
    },
    pressure_washing: {
      surfaceType: {
        siding: {
          image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
          desc: 'Siding & exterior walls',
        },
        driveway: {
          image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=80',
          desc: 'Driveways & concrete',
        },
        deck: {
          image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
          desc: 'Decks & patios',
        },
        roof: {
          image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
          desc: 'Soft wash for roofs',
        },
      },
    },
    landscaping: {
      lotSize: {
        small: {
          image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=600&q=80',
          desc: 'Compact yards',
        },
        medium: {
          image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=600&q=80',
          desc: 'Typical suburban lots',
        },
        large: {
          image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80',
          desc: 'Large properties',
        },
        estate: {
          image: 'https://images.unsplash.com/photo-1558904541-efa843a96f01?auto=format&fit=crop&w=600&q=80',
          desc: 'Estates & acreage',
        },
      },
    },
  };

  const BOOKING_HEADLINES = {
    photography: {
      title: "Let's plan your perfect session",
      blurb: "We'll customize everything to fit your vision.",
    },
    detailing: {
      title: "Let's get your ride dialed in",
      blurb: 'Tell us about the vehicle — we’ll tailor the service.',
    },
    windows: {
      title: 'Clear glass starts here',
      blurb: 'A few property details so we show up ready.',
    },
    cleaning: {
      title: 'Let’s set up your clean',
      blurb: 'Home size and cadence shape the plan.',
    },
    hvac: {
      title: 'What do you need help with?',
      blurb: 'We’ll match the right tech visit.',
    },
    pressure_washing: {
      title: 'What are we washing?',
      blurb: 'Surface and scale make the quote accurate.',
    },
    landscaping: {
      title: 'Let’s map the outdoor work',
      blurb: 'Yard size and goals lock the plan.',
    },
  };

  function enrichTileOptions(cfg) {
    if (!cfg || !cfg.fields) return cfg;
    const artTrade = TILE_ART[cfg.trade] || {};
    Object.keys(cfg.fields).forEach((fieldId) => {
      const field = cfg.fields[fieldId];
      if (!field || field.type !== 'tiles' || !Array.isArray(field.options)) return;
      const artField = artTrade[fieldId] || {};
      field.options = field.options.map((opt) => {
        const art = artField[opt.id] || {};
        return Object.assign({}, opt, {
          image: opt.image || art.image || '',
          desc: opt.desc || art.desc || '',
        });
      });
    });
    return cfg;
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /** Shared rich / plain tile button markup for Book Now + Smart Quote. */
  function renderTileOptionHtml(opt, selected, onclickAttr, showPrice) {
    const o = opt || {};
    const sel = selected ? ' sel' : '';
    const img = o.image
      ? `<div class="sq-tile-media"><img src="${escAttr(o.image)}" alt="" loading="lazy" decoding="async"></div>`
      : '';
    const rich = !!o.image;
    const price =
      showPrice && o.surcharge
        ? `<em>+$${o.surcharge}</em>`
        : '';
    const desc = o.desc ? `<span>${escAttr(o.desc)}</span>` : '';
    return `<button type="button" class="sq-tile${rich ? ' sq-tile-rich' : ''}${sel}" ${onclickAttr}>
      ${img}
      <div class="${rich ? 'sq-tile-body' : ''}"><strong>${escAttr(o.label)}</strong>${desc}${price}</div>
    </button>`;
  }

  function bookingHeadline(trade) {
    return BOOKING_HEADLINES[trade] || {
      title: 'Let’s get a few details',
      blurb: 'So we can prepare for your visit.',
    };
  }

  /** Merge blueprint.smartQuote + recipe + owner quoteConfig. */
  function resolveConfig(opts) {
    const o = opts || {};
    const trade = recipeId(o.businessType);
    const base = deepClone(RECIPES[trade] || RECIPES.detailing);
    const fromBp = o.blueprint && o.blueprint.smartQuote ? deepClone(o.blueprint.smartQuote) : {};
    const owner = o.ownerConfig && typeof o.ownerConfig === 'object' ? deepClone(o.ownerConfig) : {};

    const cfg = Object.assign({}, base, fromBp, {
      fields: Object.assign({}, base.fields || {}, fromBp.fields || {}),
      steps: (fromBp.steps && fromBp.steps.length ? fromBp.steps : base.steps).slice(),
      accent: owner.accent || fromBp.accent || base.accent,
      includes: owner.includes || fromBp.includes || base.includes,
      tip: owner.tip || fromBp.tip || base.tip,
      trade,
    });

    // Optional reorder: packages before subject. Quick Quote / Book Now keep default false.
    // so step-1 chrome stays subject/"Details" while customer intake is subject+modifiers.
    if (o.packagesFirst) {
      const pkgIdx = cfg.steps.findIndex((s) => s && s.id === 'packages');
      if (pkgIdx > 0) {
        const pkg = cfg.steps.splice(pkgIdx, 1)[0];
        cfg.steps.unshift(pkg);
      }
    }

    // Owner custom fields
    (owner.customFields || []).forEach((f) => {
      if (f && f.id) cfg.fields[f.id] = f;
    });
    // Disable fields
    (owner.disabledFields || []).forEach((id) => {
      if (cfg.fields[id]) cfg.fields[id] = Object.assign({}, cfg.fields[id], { disabled: true });
    });
    // Owner field option / rule overrides (incl. per-choice surcharges)
    if (owner.fieldOverrides && typeof owner.fieldOverrides === 'object') {
      Object.keys(owner.fieldOverrides).forEach((id) => {
        if (!cfg.fields[id]) return;
        const ov = owner.fieldOverrides[id] || {};
        const optionSurcharges = ov.optionSurcharges;
        const rest = Object.assign({}, ov);
        delete rest.optionSurcharges;
        const merged = Object.assign({}, cfg.fields[id], rest);
        if (optionSurcharges && typeof optionSurcharges === 'object' && Array.isArray(merged.options)) {
          merged.options = merged.options.map((opt) => {
            if (!opt || opt.id == null || !(opt.id in optionSurcharges)) return opt;
            const n = Number(optionSurcharges[opt.id]);
            return Object.assign({}, opt, { surcharge: Number.isFinite(n) ? n : 0 });
          });
        }
        cfg.fields[id] = merged;
      });
    }

    cfg.customRules = Array.isArray(owner.customRules) ? owner.customRules.slice() : [];
    cfg.disabledPackageNames = Array.isArray(owner.disabledPackageNames)
      ? owner.disabledPackageNames.map((x) => String(x).toLowerCase())
      : [];
    cfg.customPackages = Array.isArray(owner.customPackages) ? owner.customPackages.slice() : [];
    cfg.packagePriceOverrides =
      owner.packagePriceOverrides && typeof owner.packagePriceOverrides === 'object'
        ? owner.packagePriceOverrides
        : {};

    enrichTileOptions(cfg);
    return cfg;
  }

  function packagesFromServices(services, cfg) {
    const list = Array.isArray(services) ? services : [];
    const out = [];
    list.forEach((s) => {
      if (!s || !s.name) return;
      if ((cfg.disabledPackageNames || []).includes(String(s.name).toLowerCase())) return;
      let price = Number(s.price != null ? s.price : s.defaultPrice);
      if (!Number.isFinite(price)) price = 0;
      const ov = cfg.packagePriceOverrides[s.name];
      if (ov != null && Number.isFinite(Number(ov))) price = Number(ov);
      const pricingType = s.pricingType === 'variable' ? 'variable' : 'flat';
      const varPrices =
        s.varPrices && typeof s.varPrices === 'object' ? Object.assign({}, s.varPrices) : {};
      out.push({
        id: s.id || slug(s.name),
        name: s.name,
        price,
        pricingType,
        varPrices,
        dur: s.dur || s.duration || '',
        desc: s.desc || s.description || '',
        category: s.category || 'Packages',
        image: s.image || s.imgUrl || '',
      });
    });
    (cfg.customPackages || []).forEach((p) => {
      if (!p || !p.name) return;
      out.push({
        id: p.id || slug(p.name),
        name: p.name,
        price: Number(p.price) || 0,
        pricingType: 'flat',
        varPrices: {},
        dur: p.dur || '',
        desc: p.desc || '',
        category: p.category || 'Custom',
        image: p.image || '',
        custom: true,
      });
    });
    return out;
  }

  /** Map recipe vehicleType id → owner varPrices key (sedan/coupe/crossover/suv/truck/van). */
  function mapVehicleTier(vehicleTypeId) {
    const id = String(vehicleTypeId || '').toLowerCase();
    if (id === 'truck') return 'truck';
    if (id === 'suv') return 'suv';
    if (id === 'van') return 'van';
    if (id === 'crossover') return 'crossover';
    if (id === 'coupe') return 'coupe';
    return 'sedan';
  }

  /**
   * Fold owner dirty surcharge into detailing condition options.
   * When disabled / missing: keep the tiles, zero the fee (Book Now + Quick Quote parity).
   */
  function applyOwnerDirtyToConfig(cfg, dirtySurcharge) {
    if (!cfg || cfg.trade !== 'detailing' || !cfg.fields || !cfg.fields.condition) return cfg;
    const opts = cfg.fields.condition.options || [];
    if (dirtySurcharge && dirtySurcharge.enabled) {
      const d = dirtySurcharge;
      const type = d.type || 'percent';
      const map = [d.light, d.moderate, d.heavy, d.extreme];
      cfg.fields.condition.options = opts.map((opt, i) => {
        const n = Number(map[i]);
        if (!Number.isFinite(n)) return opt;
        if (type === 'percent') {
          return Object.assign({}, opt, { rule: { type: 'percent', value: n }, surcharge: 0 });
        }
        return Object.assign({}, opt, { rule: { type: 'flat', amount: n }, surcharge: 0 });
      });
    } else {
      cfg.fields.condition.options = opts.map((opt) =>
        Object.assign({}, opt, { rule: { type: 'percent', value: 0 }, surcharge: 0 })
      );
    }
    return cfg;
  }

  /** Clear recipe vehicle size surcharges when size is already baked into varPrices. */
  function zeroVehicleSizeSurcharges(cfg) {
    if (!cfg || !cfg.fields || !cfg.fields.vehicleType) return cfg;
    const field = cfg.fields.vehicleType;
    if (!Array.isArray(field.options)) return cfg;
    cfg.fields.vehicleType = Object.assign({}, field, {
      options: field.options.map((opt) => Object.assign({}, opt, { surcharge: 0 })),
    });
    return cfg;
  }

  /**
   * Resolve package.price from owner varPrices[vehicle tier] when pricingType === 'variable'.
   * Returns cloned packages + whether any selected (or any) package is variable.
   */
  function resolveLivePackagePrices(packages, answers, packageIds) {
    const tier = mapVehicleTier(answers && answers.vehicleType);
    const selected = Array.isArray(packageIds) ? packageIds : null;
    let anyVariable = false;
    let selectedVariable = false;
    const out = (packages || []).map((p) => {
      const pkg = Object.assign({}, p, {
        varPrices: p.varPrices && typeof p.varPrices === 'object' ? Object.assign({}, p.varPrices) : {},
      });
      if (pkg.pricingType === 'variable') {
        anyVariable = true;
        if (!selected || selected.includes(pkg.id)) selectedVariable = true;
        const vp = pkg.varPrices;
        const tierPrice = Number(vp[tier]);
        if (Number.isFinite(tierPrice) && tierPrice > 0) {
          pkg.price = tierPrice;
        } else {
          const sedan = Number(vp.sedan);
          if (Number.isFinite(sedan) && sedan > 0) pkg.price = sedan;
        }
      }
      return pkg;
    });
    return { packages: out, anyVariable, selectedVariable: selected ? selectedVariable : anyVariable };
  }

  /**
   * When owner packages already price the job, disable duplicate recipe tiles
   * that would double-count (photography sessionType vs package picker).
   */
  function applyPackageDrivenFieldGuards(cfg, packages) {
    if (!cfg || !cfg.fields) return cfg;
    const hasPkgs = Array.isArray(packages) && packages.length > 0;
    if (cfg.trade === 'photography' && hasPkgs && cfg.fields.sessionType && !cfg.fields.sessionType.disabled) {
      cfg.fields.sessionType = Object.assign({}, cfg.fields.sessionType, { disabled: true });
    }
    return cfg;
  }

  /**
   * Apply dirty + live varPrices onto cfg/packages before compute.
   * Mutates cfg (dirty + optional zero size fees). Returns priced package clones.
   */
  function prepareLivePricing(cfg, dirtySurcharge, packages, state) {
    applyOwnerDirtyToConfig(cfg, dirtySurcharge);
    applyPackageDrivenFieldGuards(cfg, packages);
    const answers = (state && state.answers) || {};
    const packageIds = (state && state.packageIds) || [];
    const resolved = resolveLivePackagePrices(packages, answers, packageIds);
    if (resolved.selectedVariable) zeroVehicleSizeSurcharges(cfg);
    return resolved.packages;
  }

  function slug(name) {
    return String(name || 'pkg')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
  }

  function applyRule(rule, value, baseSubtotal) {
    if (!rule || typeof rule !== 'object') return { amount: 0, label: '' };
    const t = rule.type;
    const v = Number(value) || 0;
    if (t === 'flat') {
      const on = !!value;
      return { amount: on ? Number(rule.amount) || 0 : 0, label: rule.label || '' };
    }
    if (t === 'percent') {
      const pct = Number(rule.value) || 0;
      return { amount: money((baseSubtotal * pct) / 100), label: rule.label || (pct ? pct + '%' : '') };
    }
    if (t === 'per_unit') {
      const unit = Number(rule.amount) || 0;
      const baseUnits = Number(rule.baseUnits) || 0;
      const billable = Math.max(0, v - baseUnits);
      return {
        amount: money(billable * unit),
        label: rule.unitLabel ? billable + ' ' + rule.unitLabel : '',
      };
    }
    if (t === 'per_unit_above') {
      const unit = Number(rule.amount) || 0;
      const above = Number(rule.above) || 0;
      const billable = Math.max(0, v - above);
      return {
        amount: money(billable * unit),
        label: rule.unitLabel ? billable + ' extra ' + rule.unitLabel : '',
      };
    }
    if (t === 'surcharge') {
      return { amount: Number(rule.amount) || 0, label: rule.label || '' };
    }
    return { amount: 0, label: '' };
  }

  /**
   * @param {object} cfg resolveConfig()
   * @param {object} state { packageIds:[], answers:{}, addonIds:[] }
   * @param {array} packages packagesFromServices()
   * @param {array} addons [{id,name,price}]
   */
  function compute(cfg, state, packages, addons) {
    const answers = (state && state.answers) || {};
    const selectedPkgs = (packages || []).filter((p) => (state.packageIds || []).includes(p.id));
    const lineItems = [];
    let subtotal = 0;

    selectedPkgs.forEach((p) => {
      const amt = money(p.price);
      lineItems.push({ kind: 'package', id: p.id, label: p.name, amount: amt });
      subtotal += amt;
    });

    const fields = cfg.fields || {};
    Object.keys(fields).forEach((fid) => {
      const field = fields[fid];
      if (!field || field.disabled) return;
      const ans = answers[fid];
      if (field.type === 'tiles' && Array.isArray(field.options)) {
        const opt = field.options.find((o) => o.id === ans);
        if (!opt) return;
        if (opt.surcharge) {
          const amt = money(opt.surcharge);
          if (amt) {
            lineItems.push({ kind: 'modifier', id: fid, label: field.label + ': ' + opt.label, amount: amt });
            subtotal += amt;
          }
        }
        if (opt.rule) {
          const r = applyRule(opt.rule, true, subtotal);
          // percent rules apply later against package+surcharge base — track separately
          if (opt.rule.type === 'percent') {
            lineItems.push({
              kind: 'modifier',
              id: fid + '-pct',
              label: field.label + ': ' + opt.label,
              amount: 0,
              _percent: Number(opt.rule.value) || 0,
            });
          } else if (r.amount) {
            lineItems.push({ kind: 'modifier', id: fid, label: field.label + ': ' + opt.label, amount: r.amount });
            subtotal += r.amount;
          }
        }
      } else if (field.type === 'toggle') {
        if (!ans) return;
        const r = applyRule(field.rule || { type: 'flat', amount: 0 }, true, subtotal);
        if (r.amount) {
          lineItems.push({ kind: 'modifier', id: fid, label: field.label, amount: r.amount });
          subtotal += r.amount;
        }
      } else if (field.type === 'stepper' || field.type === 'range') {
        const r = applyRule(field.rule, ans, subtotal);
        if (r.amount) {
          lineItems.push({
            kind: 'modifier',
            id: fid,
            label: field.label + (r.label ? ' (' + r.label + ')' : ''),
            amount: r.amount,
          });
          subtotal += r.amount;
        }
      }
    });

    // Apply deferred percent modifiers (condition, frequency discounts)
    let pctTotal = 0;
    lineItems.forEach((li) => {
      if (li._percent) {
        const amt = money((subtotal * li._percent) / 100);
        li.amount = amt;
        delete li._percent;
        pctTotal += amt;
      }
    });
    subtotal = money(subtotal + pctTotal);

    (addons || [])
      .filter((a) => (state.addonIds || []).includes(a.id))
      .forEach((a) => {
        const amt = money(a.price);
        lineItems.push({ kind: 'addon', id: a.id, label: a.name, amount: amt });
        subtotal += amt;
      });

    (cfg.customRules || []).forEach((rule) => {
      if (!rule || rule.disabled) return;
      const when = rule.when || {};
      let ok = true;
      Object.keys(when).forEach((k) => {
        if (String(answers[k]) !== String(when[k])) ok = false;
      });
      if (!ok && Object.keys(when).length) return;
      const r = applyRule(rule, answers[rule.fieldId] != null ? answers[rule.fieldId] : true, subtotal);
      if (r.amount) {
        lineItems.push({ kind: 'rule', id: rule.id || rule.label, label: rule.label || 'Adjustment', amount: r.amount });
        subtotal += r.amount;
      }
    });

    const total = money(Math.max(0, subtotal));
    return {
      lineItems,
      subtotal: total,
      total,
      formatted: formatMoney(total),
      packageCount: selectedPkgs.length,
    };
  }

  function defaultAnswers(cfg) {
    const answers = {};
    Object.keys(cfg.fields || {}).forEach((fid) => {
      const f = cfg.fields[fid];
      if (!f || f.disabled) return;
      if (f.type === 'tiles' && f.options && f.options[0]) answers[fid] = f.options[0].id;
      else if (f.type === 'stepper' || f.type === 'range') answers[fid] = f.default != null ? f.default : f.min || 0;
      else if (f.type === 'toggle') answers[fid] = false;
      else answers[fid] = '';
    });
    return answers;
  }

  function fieldsForStep(cfg, stepId) {
    const out = [];
    Object.keys(cfg.fields || {}).forEach((fid) => {
      const f = cfg.fields[fid];
      if (!f || f.disabled) return;
      if ((f.step || 'subject') === stepId) out.push(Object.assign({ id: fid }, f));
    });
    return out;
  }

  function estimateDisclaimer(trade) {
    const t = String(trade || '');
    if (t === 'windows' || t === 'hvac' || t === 'pressure_washing') {
      return 'Final total may adjust after we see the job.';
    }
    if (t === 'photography') return 'Travel and overtime can adjust the final quote.';
    return 'Estimate based on what you selected — confirmed before you pay.';
  }

  /**
   * Presentation-only Quick Quote chrome (owner tool).
   * Does not change pricing rules — phase 2 wires live owner prices.
   */
  const QUICK_QUOTE_FLOW_DEFAULTS = {
    detailing: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Vehicle', hint: 'What are we working on?', mapsTo: 'subject' },
        { id: 'service', label: 'Service', hint: 'What do you need?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    windows: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Property', hint: 'What are we cleaning?', mapsTo: 'subject' },
        { id: 'service', label: 'Service', hint: 'What do you need?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    photography: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        // Packages encode shoot type — start there so reps quote in one tap (no empty Session).
        { id: 'service', label: 'Package', hint: 'Which package?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Hours & travel?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    cleaning: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Home', hint: 'What are we cleaning?', mapsTo: 'subject' },
        { id: 'service', label: 'Plan', hint: 'Which plan?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    hvac: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Need', hint: 'What’s going on?', mapsTo: 'subject' },
        { id: 'service', label: 'Service', hint: 'What do you need?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    pressure_washing: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Surface', hint: 'What are we washing?', mapsTo: 'subject' },
        { id: 'service', label: 'Service', hint: 'What do you need?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    landscaping: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Yard', hint: 'What size yard?', mapsTo: 'subject' },
        { id: 'service', label: 'Service', hint: 'What do you need?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: true,
    },
    spa: {
      title: 'Quick Quote',
      tagline: 'Fast. Simple. Mobile.',
      chromeSteps: [
        { id: 'subject', label: 'Treatment', hint: 'What are they looking for?', mapsTo: 'subject' },
        { id: 'service', label: 'Menu', hint: 'Which service?', mapsTo: 'packages' },
        { id: 'addons', label: 'Extras', hint: 'Anything extra?', mapsTo: 'modifiers' },
        { id: 'review', label: 'Review', hint: 'See your price.', mapsTo: 'customer' },
      ],
      tileArt: false,
    },
  };

  function resolveQuickQuoteFlow(opts) {
    const o = opts || {};
    const trade = recipeId(o.businessType || o.trade || (o.blueprint && o.blueprint.id) || 'detailing');
    const base = Object.assign(
      { title: 'Quick Quote', tagline: 'Fast. Simple. Mobile.', chromeSteps: [], tileArt: false },
      QUICK_QUOTE_FLOW_DEFAULTS[trade] || QUICK_QUOTE_FLOW_DEFAULTS.detailing
    );
    const fromBp = o.blueprint && o.blueprint.quickQuote && typeof o.blueprint.quickQuote === 'object'
      ? o.blueprint.quickQuote
      : null;
    if (!fromBp) {
      return Object.assign({ trade }, base, {
        chromeSteps: (base.chromeSteps || []).map((s) => Object.assign({}, s)),
      });
    }
    const steps = Array.isArray(fromBp.chromeSteps) && fromBp.chromeSteps.length
      ? fromBp.chromeSteps.map((s) => Object.assign({}, s))
      : (base.chromeSteps || []).map((s) => Object.assign({}, s));
    return {
      trade,
      title: fromBp.title || base.title,
      tagline: fromBp.tagline || base.tagline,
      tileArt: fromBp.tileArt != null ? !!fromBp.tileArt : !!base.tileArt,
      chromeSteps: steps,
    };
  }

  function chromeIndexForRecipeStep(flow, recipeStepId) {
    const steps = (flow && flow.chromeSteps) || [];
    const id = String(recipeStepId || '');
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (!s) continue;
      if (s.mapsTo === id) return i;
      if (s.id === 'review' && (id === 'customer' || id === 'review')) return i;
    }
    return 0;
  }

  function recipeStepIndexForChrome(cfg, flow, chromeIndex) {
    const steps = (cfg && cfg.steps) || [];
    const chrome = ((flow && flow.chromeSteps) || [])[chromeIndex];
    if (!chrome) return 0;
    let mapsTo = chrome.mapsTo || 'subject';
    // Review chrome covers customer + review — land on customer first.
    if (chrome.id === 'review') mapsTo = 'customer';
    const idx = steps.findIndex((s) => s && s.id === mapsTo);
    return idx >= 0 ? idx : 0;
  }

  /** True when a chrome step has something useful to show (packages, fields, or review). */
  function chromeStepHasContent(cfg, flow, chromeIndex, opts) {
    const chrome = ((flow && flow.chromeSteps) || [])[chromeIndex];
    if (!chrome) return false;
    let mapsTo = chrome.mapsTo || chrome.id;
    if (chrome.id === 'review') return true;
    if (mapsTo === 'packages' || mapsTo === 'customer' || mapsTo === 'review') return true;
    const fields = fieldsForStep(cfg, mapsTo).filter((f) => f && !f.disabled);
    if (fields.length) return true;
    if (mapsTo === 'modifiers' && opts && opts.hasAddons) return true;
    return false;
  }

  function firstUsefulChromeIndex(cfg, flow, opts) {
    const steps = (flow && flow.chromeSteps) || [];
    for (let i = 0; i < steps.length; i++) {
      if (chromeStepHasContent(cfg, flow, i, opts)) return i;
    }
    return 0;
  }

  function nextUsefulChromeIndex(cfg, flow, fromIndex, opts) {
    const steps = (flow && flow.chromeSteps) || [];
    for (let i = fromIndex + 1; i < steps.length; i++) {
      if (chromeStepHasContent(cfg, flow, i, opts)) return i;
    }
    return fromIndex;
  }

  function prevUsefulChromeIndex(cfg, flow, fromIndex, opts) {
    for (let i = fromIndex - 1; i >= 0; i--) {
      if (chromeStepHasContent(cfg, flow, i, opts)) return i;
    }
    return -1;
  }

  function isSecondaryField(field) {
    if (!field) return false;
    if (field.optional) return true;
    if (field.type === 'text' || field.type === 'textarea') return true;
    return false;
  }

  function partitionFields(fields) {
    const list = Array.isArray(fields) ? fields : [];
    if (list.length <= 4) return { primary: list, secondary: [] };
    const primary = [];
    const secondary = [];
    list.forEach((f) => {
      if (isSecondaryField(f) && primary.length >= 3) secondary.push(f);
      else if (isSecondaryField(f) && list.filter((x) => !isSecondaryField(x)).length >= 3) secondary.push(f);
      else primary.push(f);
    });
    if (primary.length > 5) {
      const keep = [];
      const move = [];
      primary.forEach((f) => {
        if (keep.length < 4 || !isSecondaryField(f)) keep.push(f);
        else move.push(f);
      });
      return { primary: keep, secondary: secondary.concat(move) };
    }
    return { primary, secondary };
  }

  function renderEstimateCardHtml(opts) {
    const o = opts || {};
    const accent = o.accent || '#0f766e';
    const total = o.formatted || '$0';
    const lines = Array.isArray(o.lineItems) ? o.lineItems.filter((l) => l && l.amount) : [];
    const picks = Array.isArray(o.previewPicks) ? o.previewPicks.filter(Boolean) : [];
    const fmt = typeof o.formatMoney === 'function' ? o.formatMoney : formatMoney;
    const escLocal = (s) =>
      String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;');
    const hidePrice = !!o.hidePrice;
    const quiet = !!o.quietLocked; // Book Now: no “price unlocks” copy
    const lineHtml = hidePrice
      ? picks.length
        ? `<div class="sq-estimate-picks">${picks
            .map((p) => `<div class="sq-estimate-pick">${escLocal(p)}</div>`)
            .join('')}</div>`
        : `<div class="sq-muted" style="color:#94a3b8;margin-bottom:12px;">${escLocal(
            o.emptyText || 'Your selections will show here.'
          )}</div>`
      : lines.length
        ? lines
            .map((l) => {
              const amt = Number(l.amount) || 0;
              const sign = amt < 0 ? '−' : '+';
              const abs = Math.abs(amt);
              const showSign = l.kind !== 'package';
              return `<div class="sq-line"><span>${escLocal(l.label)}</span><strong>${
                showSign ? sign : ''
              }${fmt(abs)}</strong></div>`;
            })
            .join('')
        : `<div class="sq-muted">${escLocal(o.emptyText || 'Select options to see your price')}</div>`;
    const includes = (o.includes || []).map((x) => `<li>${escLocal(x)}</li>`).join('');
    const tip =
      o.tip && !quiet
        ? `<div class="sq-tip" style="--sq-accent:${accent}"><strong>${escLocal(o.tip.title || '')}</strong><p>${escLocal(
            o.tip.body || ''
          )}</p></div>`
        : '';
    const actions = o.actionsHtml || '';
    const disc = quiet && hidePrice ? '' : o.disclaimer || estimateDisclaimer(o.trade);
    const hero = o.heroTitle
      ? `<div class="sq-estimate-hero">${escLocal(o.heroTitle)}</div>`
      : '';
    const totalHtml = hidePrice
      ? ''
      : `<div class="sq-estimate-total">${escLocal(total)}</div>`;
    return `<div class="sq-estimate-card${hidePrice ? ' is-price-locked' : ''}" style="--sq-accent:${accent}">
      <div class="sq-estimate-kicker">${escLocal(o.kicker || (hidePrice ? 'Booking summary' : 'Your estimate'))}</div>
      ${hero}
      ${totalHtml}
      <div class="sq-lines">${lineHtml}</div>
      ${includes ? `<ul class="sq-includes">${includes}</ul>` : ''}
      ${actions}
      ${tip}
      ${disc ? `<p class="sq-disclaimer">${escLocal(disc)}</p>` : ''}
    </div>`;
  }

  global.HublySmartQuote = {
    RECIPES,
    CONTACT_FIELDS,
    TILE_ART,
    QUICK_QUOTE_FLOW_DEFAULTS,
    recipeId,
    resolveConfig,
    resolveQuickQuoteFlow,
    chromeIndexForRecipeStep,
    recipeStepIndexForChrome,
    chromeStepHasContent,
    firstUsefulChromeIndex,
    nextUsefulChromeIndex,
    prevUsefulChromeIndex,
    packagesFromServices,
    mapVehicleTier,
    applyOwnerDirtyToConfig,
    zeroVehicleSizeSurcharges,
    resolveLivePackagePrices,
    applyPackageDrivenFieldGuards,
    prepareLivePricing,
    compute,
    defaultAnswers,
    fieldsForStep,
    formatMoney,
    money,
    slug,
    estimateDisclaimer,
    isSecondaryField,
    partitionFields,
    renderEstimateCardHtml,
    renderTileOptionHtml,
    bookingHeadline,
  };
})(typeof window !== 'undefined' ? window : global);
