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
    S.biz = "Adrian's Detailing";
    S.tag = 'Mobile ceramic coating & detailing in Austin';
    S.phone = '(512) 555-0100';
    S.city = 'Austin, TX';
    S.email = 'hello@adriansdetailing.com';
    S.slug = 'adrians-detailing';
    S.businessType = 'detailing';
    S.color = '#141B2B';
    S.about = 'Premium mobile detailing for busy professionals. Ceramic coating, interior care, and membership plans.';
    S.services = [
      { id: 'svc_interior', name: 'Interior Detail', price: 220, duration: 150 },
      { id: 'svc_exterior', name: 'Exterior Detail', price: 180, duration: 120 },
      { id: 'svc_ceramic', name: 'Ceramic Coating', price: 599, duration: 240 },
      { id: 'svc_combo', name: 'Exterior Detail + Ceramic Coating', price: 720, duration: 300 },
      { id: 'svc_paint', name: 'Paint Correction', price: 450, duration: 240 }
    ];
    S.website = S.website || {};
    S.website.heroHeadline = 'Ceramic that lasts. Detail that shows.';
    S.website.heroSub = 'Mobile detailing for Austin professionals who want their car to feel new — without the shop wait.';
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
        phone: '(512) 555-0198',
        email: 'sarah.johnson@gmail.com',
        vehicle: 'Tesla Model Y · Pearl White · TEX-4821',
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
        phone: '(512) 555-0142',
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
        phone: '(512) 555-0177',
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
        phone: '(512) 555-0119',
        email: 'jordan.lee@email.com',
        vehicle: 'F-150 · White',
        preferredService: 'Exterior Detail',
        customerType: 'one_off',
        notes: 'Abandoned booking at vehicle size step.',
        createdAt: todayOffset(-12)
      }
    ];

    S.jobs = [
      { id: 'job_t1', customer: 'Sarah Johnson', phone: '(512) 555-0198', service: 'Interior Detail', amount: 260, date: todayOffset(0), time: '9:00 AM', status: 'scheduled', vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_t2', customer: 'Mike Brown', phone: '(512) 555-0142', service: 'Exterior Detail', amount: 180, date: todayOffset(0), time: '1:00 PM', status: 'scheduled', vehicle: 'BMW X5 · Black', fromBooking: true },
      { id: 'job_pending', customer: 'Jordan Lee', phone: '(512) 555-0119', service: 'Exterior Detail', amount: 180, date: todayOffset(1), time: '10:00 AM', status: 'pending', vehicle: 'F-150 · White', fromBooking: true },
      { id: 'job_sj1', customer: 'Sarah Johnson', service: 'Exterior Detail + Ceramic Coating', amount: 720, date: todayOffset(-36), time: '9:00 AM', status: 'completed', vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj2', customer: 'Sarah Johnson', service: 'Interior Detail', amount: 220, date: todayOffset(-72), time: '9:00 AM', status: 'completed', vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj3', customer: 'Sarah Johnson', service: 'Ceramic Coating', amount: 599, date: '2024-05-04', time: '9:00 AM', status: 'completed', vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_sj4', customer: 'Sarah Johnson', service: 'Interior Detail', amount: 220, date: todayOffset(30), time: '9:00 AM', status: 'scheduled', vehicle: 'Tesla Model Y · Pearl White', fromBooking: true },
      { id: 'job_mb1', customer: 'Mike Brown', service: 'Interior Detail', amount: 220, date: todayOffset(-20), time: '11:00 AM', status: 'completed', vehicle: 'BMW X5 · Black', fromBooking: true },
      { id: 'job_es1', customer: 'Emily Smith', service: 'Full Detail', amount: 320, date: todayOffset(-10), time: '2:00 PM', status: 'completed', vehicle: 'Audi Q5', fromBooking: false }
    ];

    S.quotes = [
      { id: 'q_sj', customerName: 'Sarah Johnson', customerPhone: '(512) 555-0198', amount: 599, status: 'sent', packageNames: ['Ceramic Coating - Annual Plan'], createdAt: todayOffset(-5), updatedAt: todayOffset(-5) },
      { id: 'q_jl', customerName: 'Jordan Lee', customerPhone: '(512) 555-0119', amount: 180, status: 'draft', packageNames: ['Exterior Detail'], createdAt: todayOffset(-2), updatedAt: todayOffset(-1) },
      { id: 'q_new', customerName: 'Chris Park', customerPhone: '(512) 555-0188', amount: 450, status: 'sent', packageNames: ['Paint Correction'], createdAt: todayOffset(-1), updatedAt: todayOffset(0) }
    ];

    S.pipeline = {
      deleted: [],
      stages: {},
      lostReasons: {},
      edits: {},
      stageDefs: [
        { id: 'new', label: 'New', tone: 'purple', role: 'open' },
        { id: 'quote_sent', label: 'Quote Sent', tone: 'orange', role: 'quote' },
        { id: 'won', label: 'Won → Jobs', tone: 'green', role: 'won', convertsToJobs: true },
        { id: 'lost', label: 'Lost', tone: 'red', role: 'lost', isLost: true }
      ],
      manual: [
        { id: 'lead_google', name: 'Alex Rivera', phone: '(512) 555-0133', email: 'alex.r@email.com', service: 'Ceramic Coating', vehicle: 'Porsche Macan', source: 'google', stage: 'new', createdAt: todayOffset(0) + 'T09:12:00', notes: 'Came from Google · /ceramic-coating' },
        { id: 'lead_ig', name: 'Taylor Kim', phone: '(512) 555-0166', email: 'taylor.k@email.com', service: 'Interior Detail', vehicle: 'Model 3', source: 'instagram', stage: 'new', createdAt: todayOffset(-1) + 'T14:20:00', notes: 'Instagram DM' },
        { id: 'lead_fb', name: 'Sam Ortiz', phone: '(512) 555-0121', email: 'sam.o@email.com', service: 'Exterior Detail', vehicle: 'Tahoe-Class', source: 'facebook', stage: 'new', createdAt: todayOffset(-2) + 'T11:05:00', notes: 'Facebook lead form' },
        { id: 'lead_hubly', name: 'Priya Shah', phone: '(512) 555-0190', email: 'priya.s@email.com', service: 'Paint Correction', vehicle: 'White Tesla', source: 'hubly', stage: 'quote_sent', createdAt: todayOffset(-3) + 'T16:40:00', amount: 450, notes: 'Hubly booking page quote' },
        { id: 'lead_web', name: 'Chris Park', phone: '(512) 555-0188', email: 'chris.p@email.com', service: 'Paint Correction', vehicle: 'F-150', source: 'website', stage: 'quote_sent', createdAt: todayOffset(-1) + 'T10:00:00', amount: 450, notes: 'Website quote request' },
        { id: 'lead_incomplete', name: 'Jordan Lee', phone: '(512) 555-0119', email: 'jordan.lee@email.com', service: 'Exterior Detail', vehicle: 'F-150 · White', source: 'booking', stage: 'quote_sent', createdAt: todayOffset(-2) + 'T18:22:00', amount: 180, notes: 'Incomplete quote from booking page' }
      ]
    };

    S.abandonedLeads = [
      { customer_name: 'Jordan Lee', customer_phone: '(512) 555-0119', service_name: 'Exterior Detail', created_at: todayOffset(-2) }
    ];

    try {
      var navBiz = document.getElementById('nav-biz');
      if (navBiz) navBiz.textContent = S.biz;
      var badge = document.getElementById('nav-badge');
      if (badge && !badge.querySelector('img')) badge.textContent = 'AD';
      var topAva = document.getElementById('top-ava');
      if (topAva && !topAva.querySelector('img')) topAva.textContent = 'AD';
    } catch (e) {}
  }

  global.HublyCeoDemo = { seed: seed };
})(typeof window !== 'undefined' ? window : this);
