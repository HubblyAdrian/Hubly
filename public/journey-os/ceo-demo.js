/**
 * Hubly CEO Demo — seed Operate / Journey OS with a rich detailing business.
 * Loaded from hubly.html. Uses global S when present.
 */
(function (global) {
  'use strict';

  function d(y, m, day) {
    var mm = String(m).padStart(2, '0');
    var dd = String(day).padStart(2, '0');
    return y + '-' + mm + '-' + dd;
  }
  function todayOffset(days) {
    var t = new Date();
    t.setDate(t.getDate() + (days || 0));
    return d(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  function seed(S) {
    if (!S) return;
    S._ceoDemo = true;
    S._accountClaimed = true;
    S._deferredAccount = false;
    S._hublyMode = 'operate';
    S.biz = 'Pro Shine Detailing';
    S.ownerName = 'Adrian Lopez';
    S.tag = 'Mobile ceramic coating & detailing in San Diego';
    S.phone = '(619) 555-0100';
    S.city = 'San Diego, CA';
    S.email = 'hello@proshinedetailing.com';
    S.slug = 'pro-shine-detailing';
    S.businessType = 'detailing';
    S.color = '#141B2B';
    S.about = 'Premium mobile detailing for busy professionals. Ceramic coating, interior care, and membership plans across San Diego & Miami.';
    S.services = [
      { id: 'svc_interior', name: 'Interior Detail', price: 220, duration: 150 },
      { id: 'svc_exterior', name: 'Exterior Detail', price: 180, duration: 120 },
      { id: 'svc_ceramic', name: 'Ceramic Coating', price: 599, duration: 240 },
      { id: 'svc_combo', name: 'Exterior Detail + Ceramic Coating', price: 720, duration: 300 },
      { id: 'svc_paint', name: 'Paint Correction', price: 450, duration: 240 }
    ];
    S.website = S.website || {};
    S.website.heroHeadline = 'Ceramic that lasts. Detail that shows.';
    S.website.heroSub = 'Mobile detailing for San Diego professionals who want their car to feel new — without the shop wait.';
    S.website.reviewRating = 4.9;
    S.website.reviewCount = 147;
    S.website.manualReviews = [
      { name: 'Sarah Johnson', text: 'Amazing attention to detail. My car looks better than when I bought it!', rating: 5, src: 'Google' },
      { name: 'Mike Brown', text: 'Highly recommend! Great communication and super convenient mobile service.', rating: 5, src: 'Facebook' },
      { name: 'Emily Smith', text: 'Fantastic experience from start to finish. Will definitely be back!', rating: 5, src: 'Manual' }
    ];
    S.memberships = [
      { name: 'Premium Wash Club', price: 80, cadence: '/mo', includes: ['Monthly wash', 'Priority scheduling', 'Member pricing'] },
      { name: 'Ceramic Maintenance', price: 120, cadence: '/mo', includes: ['Quarterly ceramic refresh', 'Interior wipe-down', 'Priority booking'] }
    ];

    S.customers = [
      {
        id: 'cust_sarah',
        name: 'Sarah Johnson',
        phone: '(619) 555-0198',
        email: 'sarah.johnson@gmail.com',
        vehicle: 'Tesla Model Y · Pearl White · CAL-4821',
        preferredService: 'Ceramic Coating',
        customerType: 'recurring',
        recurringAmount: 120,
        statusOverride: 'vip',
        notes: 'Prefers Saturday mornings. Loves ceramic coating. Usually tips. Mobile service. Asked about yearly maintenance plans. Has referred two customers.',
        createdAt: '2022-04-14',
        birthday: '1990-05-12'
      },
      {
        id: 'cust_mike',
        name: 'Mike Brown',
        phone: '(619) 555-0142',
        email: 'mike.brown@email.com',
        vehicle: 'BMW X5 · Black',
        preferredService: 'Interior Detail',
        customerType: 'one_off',
        notes: 'Responds best to text. Interested in membership after 2 more visits.',
        createdAt: '2024-11-02'
      },
      {
        id: 'cust_emily',
        name: 'Emily Smith',
        phone: '(619) 555-0177',
        email: 'emily.s@email.com',
        vehicle: 'Audi Q5',
        preferredService: 'Full Detail',
        customerType: 'one_off',
        notes: 'Left a 5-star review. Good testimonial candidate.',
        createdAt: '2025-01-18'
      },
      {
        id: 'cust_jordan',
        name: 'Jordan Lee',
        phone: '(619) 555-0119',
        email: 'jordan.lee@email.com',
        vehicle: 'F-150 · White',
        preferredService: 'Exterior Detail',
        customerType: 'one_off',
        notes: 'Abandoned booking at vehicle size step.',
        createdAt: todayOffset(-12)
      },
      {
        id: 'cust_alex',
        name: 'Alex Rivera',
        phone: '(619) 555-0133',
        email: 'alex.r@email.com',
        vehicle: 'Porsche Macan · Gray',
        preferredService: 'Ceramic Coating',
        customerType: 'one_off',
        notes: 'Google lead — hot on ceramic coating package.',
        createdAt: todayOffset(-1)
      }
    ];

    S.team = [
      { id: 'tech_adrian', name: 'Adrian Lopez', role: 'Owner' },
      { id: 'tech_maya', name: 'Maya Chen', role: 'Technician' },
      { id: 'tech_luis', name: 'Luis Ortega', role: 'Technician' }
    ];

    S.jobs = [
      { id: 'job_t1', customer: 'Sarah Johnson', phone: '(619) 555-0198', service: 'Interior Detail', amount: 260, date: todayOffset(0), time: '9:00 AM', status: 'in_progress', address: '4821 Mission Blvd, San Diego, CA', assignedTo: 'Maya Chen', depositStatus: 'paid', deposit: 65, vehicle: 'Tesla Model Y · Pearl White', fromBooking: true, routeOrder: 1 },
      { id: 'job_t2', customer: 'Mike Brown', phone: '(619) 555-0142', service: 'Exterior Detail', amount: 180, date: todayOffset(0), time: '11:30 AM', status: 'scheduled', address: '901 Harbor Island Dr, San Diego, CA', assignedTo: 'Luis Ortega', depositStatus: 'due', deposit: 45, vehicle: 'BMW X5 · Black', fromBooking: true, routeOrder: 2 },
      { id: 'job_t3', customer: 'Chris Park', phone: '(619) 555-0188', service: 'Paint Correction', amount: 450, date: todayOffset(0), time: '2:00 PM', status: 'scheduled', address: '2200 Pacific Hwy, San Diego, CA', assignedTo: 'Adrian Lopez', depositStatus: 'due', deposit: 112, vehicle: 'F-150 · Blue', fromBooking: false, routeOrder: 3 },
      { id: 'job_t4', customer: 'Emily Smith', phone: '(619) 555-0177', service: 'Full Detail', amount: 320, date: todayOffset(0), time: '4:30 PM', status: 'scheduled', address: '1150 W Washington St, San Diego, CA', assignedTo: 'Maya Chen', depositStatus: 'none', deposit: 0, vehicle: 'Audi Q5', fromBooking: true, routeOrder: 4 },
      { id: 'job_pending', customer: 'Jordan Lee', phone: '(619) 555-0119', service: 'Exterior Detail', amount: 180, date: todayOffset(1), time: '10:00 AM', status: 'pending', address: '5500 Grossmont Center Dr, La Mesa, CA', assignedTo: 'Luis Ortega', depositStatus: 'due', deposit: 45, vehicle: 'F-150 · White', fromBooking: true, routeOrder: 5 },
      { id: 'job_cancel', customer: 'Alex Rivera', phone: '(619) 555-0133', service: 'Ceramic Coating', amount: 599, date: todayOffset(-2), time: '1:00 PM', status: 'cancelled', address: '3750 Road Runner Row, San Diego, CA', assignedTo: 'Adrian Lopez', depositStatus: 'none', deposit: 0, vehicle: 'Porsche Macan', fromBooking: true },
      { id: 'job_recur', customer: 'Sarah Johnson', phone: '(619) 555-0198', service: 'Membership Interior Detail', amount: 180, date: todayOffset(7), time: '9:00 AM', status: 'scheduled', address: '4821 Mission Blvd, San Diego, CA', assignedTo: 'Maya Chen', depositStatus: 'paid', deposit: 0, recurring: true, vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj1', customer: 'Sarah Johnson', service: 'Exterior Detail + Ceramic Coating', amount: 720, date: todayOffset(-36), time: '9:00 AM', status: 'completed', address: '4821 Mission Blvd, San Diego, CA', assignedTo: 'Adrian Lopez', depositStatus: 'paid', deposit: 180, vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj2', customer: 'Sarah Johnson', service: 'Interior Detail', amount: 220, date: todayOffset(-72), time: '9:00 AM', status: 'completed', address: '4821 Mission Blvd, San Diego, CA', assignedTo: 'Maya Chen', depositStatus: 'paid', deposit: 55, vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj3', customer: 'Sarah Johnson', service: 'Ceramic Coating', amount: 599, date: '2024-05-04', time: '9:00 AM', status: 'completed', address: '4821 Mission Blvd, San Diego, CA', assignedTo: 'Adrian Lopez', depositStatus: 'paid', deposit: 150, vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj4', customer: 'Sarah Johnson', service: 'Interior Detail', amount: 220, date: todayOffset(30), time: '9:00 AM', status: 'scheduled', address: '4821 Mission Blvd, San Diego, CA', assignedTo: 'Maya Chen', depositStatus: 'none', deposit: 0, vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_mb1', customer: 'Mike Brown', service: 'Interior Detail', amount: 220, date: todayOffset(-20), time: '11:00 AM', status: 'completed', address: '901 Harbor Island Dr, San Diego, CA', assignedTo: 'Luis Ortega', depositStatus: 'paid', deposit: 55, vehicle: 'BMW X5 · Black', fromBooking: true },
      { id: 'job_es1', customer: 'Emily Smith', service: 'Full Detail', amount: 320, date: todayOffset(-10), time: '2:00 PM', status: 'completed', address: '1150 W Washington St, San Diego, CA', assignedTo: 'Maya Chen', depositStatus: 'paid', deposit: 80, vehicle: 'Audi Q5', fromBooking: false, reviewRequested: true }
    ];

    S.quotes = [
      { id: 'q_sj', customerName: 'Sarah Johnson', customerPhone: '(619) 555-0198', amount: 599, status: 'sent', packageNames: ['Ceramic Coating - Annual Plan'], createdAt: todayOffset(-5), updatedAt: todayOffset(-5) },
      { id: 'q_jl', customerName: 'Jordan Lee', customerPhone: '(619) 555-0119', amount: 180, status: 'draft', packageNames: ['Exterior Detail'], createdAt: todayOffset(-2), updatedAt: todayOffset(-1) },
      { id: 'q_new', customerName: 'Chris Park', customerPhone: '(619) 555-0188', amount: 450, status: 'sent', packageNames: ['Paint Correction'], createdAt: todayOffset(-1), updatedAt: todayOffset(0) },
      { id: 'q_alex', customerName: 'Alex Rivera', customerPhone: '(619) 555-0133', amount: 599, status: 'sent', packageNames: ['Ceramic Coating'], createdAt: todayOffset(0), updatedAt: todayOffset(0) }
    ];

    S.pipeline = {
      deleted: [],
      stages: {},
      lostReasons: {},
      edits: {},
      stageDefs: [
        { id: 'new', label: 'New', tone: 'orange', role: 'open' },
        { id: 'quote_sent', label: 'Quote Sent', tone: 'orange', role: 'quote' },
        { id: 'won', label: 'Won → Jobs', tone: 'green', role: 'won', convertsToJobs: true },
        { id: 'lost', label: 'Lost', tone: 'red', role: 'lost', isLost: true }
      ],
      manual: [
        {
          id: 'lead_google', name: 'Alex Rivera', phone: '(619) 555-0133', email: 'alex.r@email.com',
          service: 'Ceramic Coating', vehicle: 'Porsche Macan', address: '2910 Mission Blvd, San Diego',
          source: 'google', stage: 'new', status: 'new', createdAt: todayOffset(0) + 'T09:12:00',
          lastContacted: todayOffset(0) + 'T09:15:00', notes: 'Came from Google · /ceramic-coating',
          aiQualified: true, aiScore: 88, buyingIntent: 'high', unread: 2, assignedTo: 'Adrian Lopez',
          tags: ['hot', 'ceramic'], lastMessage: 'Can you fit ceramic coating in this week?',
          estimatedValue: 599, quoteStatus: 'none',
          messages: [
            { dir: 'in', text: 'Hi, saw your Google listing for ceramic coating.', at: '9:02 AM' },
            { dir: 'out', text: 'Happy to help! Thursday or Saturday open.', at: '9:05 AM' },
            { dir: 'in', text: 'Can you fit ceramic coating in this week?', at: '9:15 AM' }
          ],
          activity: [{ type: 'created', label: 'Lead created from Google', at: todayOffset(0) + ' 09:12' }, { type: 'message', label: 'Inbound SMS', at: todayOffset(0) + ' 09:15' }]
        },
        {
          id: 'lead_ig', name: 'Taylor Kim', phone: '(619) 555-0166', email: 'taylor.k@email.com',
          service: 'Interior Detail', vehicle: 'Model 3', source: 'instagram', stage: 'waiting_photos',
          status: 'waiting', waitingReason: 'photos', createdAt: todayOffset(-1) + 'T14:20:00',
          lastContacted: todayOffset(0) + 'T07:22:00', notes: 'Instagram DM', aiQualified: true, aiScore: 74,
          buyingIntent: 'med', unread: 1, assignedTo: 'Maya Chen', tags: ['ig', 'ev'],
          lastMessage: 'How much for a Model 3 interior detail?', estimatedValue: 220, quoteStatus: 'draft',
          messages: [{ dir: 'in', text: 'How much for a Model 3 interior detail?', at: '7:22 AM' }],
          tasks: [{ id: 't_ig1', label: 'Request cabin photos', done: false }],
          activity: [{ type: 'created', label: 'Lead from Instagram', at: todayOffset(-1) + ' 14:20' }]
        },
        {
          id: 'lead_fb', name: 'Sam Ortiz', phone: '(619) 555-0121', email: 'sam.o@email.com',
          service: 'Exterior Detail', vehicle: 'Honda', property: 'Office park lot B',
          source: 'facebook', stage: 'new', status: 'new', createdAt: todayOffset(-2) + 'T11:05:00',
          lastContacted: todayOffset(-2) + 'T11:05:00', notes: 'Facebook lead form',
          aiScore: 61, buyingIntent: 'med', unread: 0, assignedTo: 'Luis Ortega', tags: ['meta'],
          lastMessage: 'Submitted Facebook lead form', estimatedValue: 150, quoteStatus: 'none',
          messages: [{ dir: 'sys', text: 'Lead form submitted via Facebook', at: '11:05 AM' }],
          activity: [{ type: 'created', label: 'Facebook Lead Ads form', at: todayOffset(-2) + ' 11:05' }]
        },
        {
          id: 'lead_hubly', name: 'Priya Shah', phone: '(619) 555-0190', email: 'priya.s@email.com',
          service: 'Paint Correction', vehicle: 'White Tesla', address: 'La Jolla',
          source: 'hubly', stage: 'quote_viewed', status: 'quoted', createdAt: todayOffset(-3) + 'T16:40:00',
          lastContacted: todayOffset(-1) + 'T12:00:00', amount: 450, estimatedValue: 450,
          notes: 'Hubly booking page quote', aiQualified: true, aiScore: 82, buyingIntent: 'high',
          unread: 0, assignedTo: 'Adrian Lopez', tags: ['hubly', 'paint'], quoteStatus: 'viewed',
          lastMessage: 'Opened quote link',
          quote: { id: 'q_priya', amount: 450, status: 'viewed', packageName: 'Paint Correction', sentAt: todayOffset(-3) },
          estimate: { labor: 280, materials: 120, total: 450, notes: 'Two-stage correction' },
          messages: [
            { dir: 'out', text: 'Here is your paint correction quote — $450.', at: '4:42 PM' },
            { dir: 'sys', text: 'Quote viewed', at: 'Yesterday' }
          ],
          activity: [{ type: 'quote', label: 'Quote sent', at: todayOffset(-3) + ' 16:42' }, { type: 'quote', label: 'Quote viewed', at: todayOffset(-1) + ' 12:00' }]
        },
        {
          id: 'lead_web', name: 'Chris Park', phone: '(619) 555-0188', email: 'chris.p@email.com',
          service: 'Paint Correction', vehicle: 'F-150', source: 'website', stage: 'quote_sent',
          status: 'quoted', createdAt: todayOffset(-1) + 'T10:00:00', lastContacted: todayOffset(-1) + 'T10:05:00',
          amount: 450, estimatedValue: 450, notes: 'Website quote request', aiScore: 70, buyingIntent: 'med',
          unread: 0, assignedTo: 'Maya Chen', tags: ['website'], quoteStatus: 'sent',
          lastMessage: 'Do you detail trucks at the office park?',
          quote: { id: 'q_chris', amount: 450, status: 'sent', packageName: 'Paint Correction', sentAt: todayOffset(-1) },
          messages: [
            { dir: 'in', text: 'Do you detail trucks at the office park?', at: '11:18 AM' },
            { dir: 'out', text: 'Yes — mobile service in Mission Valley. Quote attached.', at: '11:20 AM' }
          ],
          tasks: [{ id: 't_cp1', label: 'Follow up on quote', done: false }],
          activity: [{ type: 'created', label: 'Website quote request', at: todayOffset(-1) + ' 10:00' }]
        },
        {
          id: 'lead_incomplete', name: 'Jordan Lee', phone: '(619) 555-0119', email: 'jordan.lee@email.com',
          service: 'Exterior Detail', vehicle: 'F-150 · White', source: 'booking', stage: 'waiting_customer',
          status: 'waiting', waitingReason: 'customer', createdAt: todayOffset(-2) + 'T18:22:00',
          lastContacted: todayOffset(0) + 'T06:50:00', amount: 180, estimatedValue: 180,
          notes: 'Incomplete quote from booking page', isAbandoned: true, aiScore: 55, buyingIntent: 'low',
          unread: 1, assignedTo: 'Luis Ortega', tags: ['abandoned'], quoteStatus: 'draft',
          lastMessage: 'Left at vehicle size step',
          messages: [
            { dir: 'in', text: 'Started booking Exterior Detail on website', at: '6:45 AM' },
            { dir: 'sys', text: 'Left at vehicle size step', at: '6:50 AM' }
          ],
          activity: [{ type: 'created', label: 'Abandoned booking', at: todayOffset(-2) + ' 18:22' }]
        },
        {
          id: 'lead_wait_pay', name: 'Morgan Ellis', phone: '(619) 555-0144', email: 'morgan.e@email.com',
          service: 'Ceramic Coating', vehicle: 'BMW X3', source: 'google', stage: 'waiting_payment',
          status: 'waiting', waitingReason: 'payment', createdAt: todayOffset(-4) + 'T09:00:00',
          lastContacted: todayOffset(-1) + 'T15:00:00', amount: 599, estimatedValue: 599,
          notes: 'Deposit link sent', aiQualified: true, aiScore: 91, buyingIntent: 'high',
          unread: 0, assignedTo: 'Adrian Lopez', tags: ['deposit'], quoteStatus: 'accepted',
          lastMessage: 'Ready when the deposit clears',
          quote: { id: 'q_morgan', amount: 599, status: 'accepted', packageName: 'Ceramic Coating', sentAt: todayOffset(-4) },
          messages: [{ dir: 'out', text: 'Payment link sent for $150 deposit.', at: '3:00 PM' }],
          files: [{ name: 'deposit-link.pdf', kind: 'pdf' }],
          activity: [{ type: 'payment', label: 'Payment link sent', at: todayOffset(-1) + ' 15:00' }]
        },
        {
          id: 'lead_wait_appr', name: 'Riley Chen', phone: '(619) 555-0177', email: 'riley.c@email.com',
          service: 'Full Detail', vehicle: 'Audi Q5', property: 'Condo garage',
          source: 'hubly', stage: 'waiting_approval', status: 'waiting', waitingReason: 'approval',
          createdAt: todayOffset(-5) + 'T11:30:00', lastContacted: todayOffset(-2) + 'T09:00:00',
          amount: 320, estimatedValue: 320, notes: 'Waiting on spouse approval',
          aiScore: 68, buyingIntent: 'med', unread: 0, assignedTo: 'Maya Chen', tags: ['approval'],
          quoteStatus: 'viewed', lastMessage: 'Need to check with my partner',
          messages: [{ dir: 'in', text: 'Need to check with my partner before booking.', at: '9:00 AM' }],
          activity: [{ type: 'waiting', label: 'Waiting on approval', at: todayOffset(-2) + ' 09:00' }]
        },
        {
          id: 'lead_expired', name: 'Casey Brooks', phone: '(619) 555-0102', email: 'casey.b@email.com',
          service: 'Interior Detail', vehicle: 'Rav4', source: 'website', stage: 'quote_expired',
          status: 'quoted', createdAt: todayOffset(-21) + 'T08:00:00', lastContacted: todayOffset(-20) + 'T10:00:00',
          amount: 200, estimatedValue: 200, notes: 'Quote expired — no response',
          aiScore: 40, buyingIntent: 'low', unread: 0, assignedTo: 'Luis Ortega', tags: ['expired'],
          quoteStatus: 'expired', lastMessage: 'Quote reminder sent',
          quote: { id: 'q_casey', amount: 200, status: 'expired', packageName: 'Interior Detail', sentAt: todayOffset(-21) },
          messages: [{ dir: 'out', text: 'Your quote expires tomorrow — reply to renew.', at: '10:00 AM' }],
          activity: [{ type: 'quote', label: 'Quote expired', at: todayOffset(-14) + ' 08:00' }]
        },
        {
          id: 'lead_lost', name: 'Dana Wu', phone: '(619) 555-0155', email: 'dana.w@email.com',
          service: 'Interior Detail', vehicle: 'Civic', source: 'google', stage: 'lost', status: 'lost',
          createdAt: todayOffset(-14) + 'T10:00:00', lastContacted: todayOffset(-10) + 'T12:00:00',
          notes: 'Went with competitor', aiScore: 22, buyingIntent: 'low', unread: 0,
          assignedTo: 'Adrian Lopez', tags: ['lost'], lastMessage: 'Went with another shop',
          quoteStatus: 'none', estimatedValue: 180,
          messages: [{ dir: 'in', text: 'Thanks but we went with another shop.', at: '12:00 PM' }],
          activity: [{ type: 'lost', label: 'Marked lost — competitor', at: todayOffset(-10) + ' 12:00' }]
        },
        {
          id: 'lead_spam', name: 'Promo Bot', phone: '(800) 555-0000', email: 'spam@example.com',
          service: '—', source: 'website', stage: 'spam', status: 'spam',
          createdAt: todayOffset(-1) + 'T03:00:00', notes: 'Spam detection',
          aiScore: 5, buyingIntent: 'none', unread: 0, assignedTo: 'Adrian Lopez', tags: ['spam'],
          lastMessage: 'Buy cheap SEO now!!!', spam: true, quoteStatus: 'none', estimatedValue: 0,
          messages: [{ dir: 'in', text: 'Buy cheap SEO now!!!', at: '3:00 AM' }],
          activity: [{ type: 'spam', label: 'Flagged as spam', at: todayOffset(-1) + ' 03:01' }]
        },
        {
          id: 'lead_dup', name: 'Alex R.', phone: '(619) 555-0133', email: 'alex.rivera@email.com',
          service: 'Ceramic Coating', vehicle: 'Porsche Macan', source: 'manual', stage: 'duplicate',
          status: 'duplicate', createdAt: todayOffset(0) + 'T09:30:00', notes: 'Likely duplicate of Alex Rivera',
          aiScore: 88, buyingIntent: 'high', unread: 0, assignedTo: 'Adrian Lopez', tags: ['duplicate'],
          lastMessage: 'Possible duplicate lead', duplicateOf: 'lead_google', quoteStatus: 'none',
          estimatedValue: 599,
          activity: [{ type: 'duplicate', label: 'Duplicate of Alex Rivera', at: todayOffset(0) + ' 09:30' }]
        }
      ]
    };

    S.abandonedLeads = [
      { customer_name: 'Jordan Lee', customer_phone: '(619) 555-0119', service_name: 'Exterior Detail', created_at: todayOffset(-2) }
    ];

    S.conversations = [
      {
        id: 'conv_alex',
        customer_name: 'Alex Rivera',
        channel: 'sms',
        phone: '(619) 555-0133',
        last_message: 'Can you fit ceramic coating in this week?',
        unread: 2,
        priority: 'high',
        isLead: true,
        needsAttention: true,
        updated_at: todayOffset(0) + 'T09:15:00',
        messages: [
          { dir: 'in', text: 'Hi, saw your Google listing for ceramic coating.', at: '9:02 AM' },
          { dir: 'out', text: 'Happy to help! I have Thursday or Saturday open. What vehicle?', at: '9:05 AM' },
          { dir: 'in', text: 'Can you fit ceramic coating in this week?', at: '9:15 AM' }
        ]
      },
      {
        id: 'conv_sarah',
        customer_name: 'Sarah Johnson',
        channel: 'sms',
        phone: '(619) 555-0198',
        last_message: 'Perfect, see you at 9am tomorrow.',
        unread: 0,
        vip: true,
        updated_at: todayOffset(0) + 'T08:40:00',
        messages: [
          { dir: 'out', text: 'Reminder: Interior Detail tomorrow at 9:00 AM.', at: '8:30 AM' },
          { dir: 'in', text: 'Perfect, see you at 9am tomorrow.', at: '8:40 AM' }
        ]
      },
      {
        id: 'conv_taylor',
        customer_name: 'Taylor Kim',
        channel: 'instagram',
        last_message: 'How much for a Model 3 interior detail?',
        unread: 1,
        vehicle: 'Tesla Model 3',
        needsAttention: true,
        updated_at: todayOffset(0) + 'T07:22:00',
        messages: [
          { dir: 'in', text: 'How much for a Model 3 interior detail?', at: '7:22 AM' }
        ]
      },
      {
        id: 'conv_jordan',
        customer_name: 'Jordan Lee',
        channel: 'chat',
        last_message: 'Left at vehicle size step',
        unread: 1,
        aiMode: 'ai',
        needsAttention: true,
        updated_at: todayOffset(0) + 'T06:50:00',
        messages: [
          { dir: 'in', text: 'Started booking Exterior Detail on website', at: '6:45 AM' },
          { dir: 'sys', text: 'Left at vehicle size step', at: '6:50 AM' }
        ]
      },
      {
        id: 'conv_emily',
        customer_name: 'Emily Wilson',
        channel: 'email',
        email: 'emily@example.com',
        last_message: 'Can you send the ceramic quote as a PDF?',
        unread: 1,
        needsAttention: true,
        updated_at: todayOffset(0) + 'T10:05:00',
        messages: [
          { dir: 'in', text: 'Can you send the ceramic quote as a PDF?', at: '10:05 AM', attachment: 'request.pdf' }
        ]
      },
      {
        id: 'conv_chris',
        customer_name: 'Chris Park',
        channel: 'facebook',
        last_message: 'Do you detail trucks at the office park?',
        unread: 0,
        updated_at: todayOffset(0) + 'T11:20:00',
        messages: [
          { dir: 'in', text: 'Do you detail trucks at the office park?', at: '11:18 AM' },
          { dir: 'out', text: 'Yes — mobile service available in Mission Valley.', at: '11:20 AM' }
        ]
      },
      {
        id: 'conv_ai_fail',
        customer_name: 'Website Visitor',
        channel: 'ai',
        last_message: 'AI could not confirm vehicle size',
        unread: 1,
        aiFailed: true,
        needsAttention: true,
        aiMode: 'ai',
        updated_at: todayOffset(0) + 'T12:01:00',
        messages: [
          { dir: 'in', text: 'I want an exterior detail tomorrow', at: '11:58 AM' },
          { dir: 'sys', text: 'AI could not confirm vehicle size', at: '12:01 PM' }
        ]
      },
      {
        id: 'conv_mike',
        customer_name: 'Mike Brown',
        channel: 'sms',
        phone: '(619) 555-0142',
        last_message: 'Can we move to 11:30 instead?',
        unread: 0,
        updated_at: todayOffset(-1) + 'T16:10:00',
        messages: [
          { dir: 'in', text: 'Can we move to 11:30 instead?', at: '4:10 PM' },
          { dir: 'out', text: 'Done — updated to 11:30 AM.', at: '4:12 PM' }
        ]
      }
    ];

    try {
      var navBiz = document.getElementById('nav-biz');
      if (navBiz) navBiz.textContent = S.biz;
      var barBiz = document.getElementById('jos-bar-biz-name');
      if (barBiz) barBiz.textContent = S.biz;
      var badge = document.getElementById('nav-badge');
      if (badge && !badge.querySelector('img')) badge.textContent = 'AL';
      var topAva = document.getElementById('top-ava');
      if (topAva && !topAva.querySelector('img')) topAva.textContent = 'AL';
    } catch (e) {}
  }

  global.HublyCeoDemo = { seed: seed };
})(typeof window !== 'undefined' ? window : this);
