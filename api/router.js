const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPA_URL = 'https://rtwxxkxpkqdrhclkozma.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d3h4a3hwa3FkcmhjbGtvem1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjA4MjgsImV4cCI6MjA5Nzk5NjgyOH0.ky9ycGJ621E4ab078pCIR4-1X_XS6OUpfPmH3v8tzf8';
const supabase = createClient(SUPA_URL, SUPA_KEY);

module.exports = async (req, res) => {
  const host = req.headers.host || '';
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');
  const isSubdomain = parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'myhubly';

  if (!isSubdomain) {
    try {
      const content = fs.readFileSync(path.join(__dirname, '../public/hubly.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(content);
    } catch(e) {
      return res.status(500).send('Error: ' + e.message);
    }
  }

  const slug = parts[0];
  const { data: biz, error } = await supabase.from('businesses').select('*').eq('slug', slug).single();

  if (error || !biz) {
    return res.status(404).send('<!DOCTYPE html><html><head><title>Not found</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f3;}.card{background:#fff;border-radius:16px;padding:40px;text-align:center;}</style></head><body><div class="card"><h1>Profile not found</h1><p>' + slug + '.myhubly.app does not exist yet.</p><p><a href="https://myhubly.app">Sign up on Hubly</a></p></div></body></html>');
  }

  let meta = {};
  try { meta = JSON.parse(biz.meta || '{}'); } catch(e) {}

  const { data: services } = await supabase.from('services').select('*').eq('business_id', biz.id).order('position');
  const svcs = (meta.editorSvcs && meta.editorSvcs.length) ? meta.editorSvcs : (services || []);

  const color = biz.brand_color || '#1a3a6e';
  const name = biz.name || '';
  const tag = biz.tagline || '';
  const phone = biz.phone || '';
  const email = biz.email || '';
  const city = biz.city || '';
  const about = biz.about || '';
  const logoUrl = meta.logoUrl || biz.logo_url || '';
  const bannerUrl = meta.bannerUrl || biz.banner_url || '';
  const portfolioUrls = meta.portfolioUrls || [];
  const ctaText = meta.ctaText || 'Book Now';
  const initials = name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase() || 'BM';

  function row(label, val) {
    if(!val) return '';
    return '<tr><td style="padding:7px 0;color:#888;font-size:13px;width:120px;">' + label + '</td><td style="font-weight:500;">' + val + '</td></tr>';
  }

  const svcsHtml = svcs.map(function(s) {
    const photo = (s.photos && s.photos[0]) || s.imgUrl || '';
    const inc = (s.includes || '').split('\n').map(function(l){return l.trim();}).filter(Boolean);
    const showPrice = s.showPrice !== false;
    const price = showPrice ? (s.price ? 'from $' + s.price : '') : 'Contact for pricing';
    return '<div class="svc-card">'
      + '<div class="svc-photo"' + (photo ? ' style="background-image:url(' + JSON.stringify(photo) + ')"' : '') + '>'
      + (!photo ? '<span style="font-size:48px;">🚗</span>' : '')
      + (s.popular ? '<div class="svc-badge">Popular</div>' : '')
      + '</div>'
      + '<div class="svc-body">'
      + '<div class="svc-name">' + (s.name||'') + '</div>'
      + (s.desc ? '<div class="svc-desc">' + s.desc + '</div>' : '')
      + (s.dur ? '<div class="svc-dur">⏱ ' + s.dur + ' hrs</div>' : '')
      + (inc.length ? '<div class="svc-inc-title">WHAT'S INCLUDED</div><div class="svc-inc">' + inc.slice(0,4).map(function(l){return '✓ ' + l;}).join('<br>') + (inc.length>4 ? '<br><span style="color:#aaa">+' + (inc.length-4) + ' more</span>' : '') + '</div>' : '')
      + '<div class="svc-footer">'
      + '<div class="svc-price" style="color:' + color + '">' + price + '</div>'
      + '<button class="btn-book" style="background:' + color + '" onclick="startBooking('' + (s.name||'').replace(/'/g,'') + '')">' + ctaText + '</button>'
      + '</div></div></div>';
  }).join('');

  const portHtml = portfolioUrls.length
    ? portfolioUrls.map(function(u){return '<div class="port-img" style="background-image:url(' + JSON.stringify(u) + ')"></div>';}).join('')
    : '<p class="empty">No photos yet</p>';

  const css = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f0f0ee;color:#111;min-height:100vh}.page{max-width:680px;margin:0 auto;padding:0 0 60px}.banner{width:100%;height:min(40vw,260px);background:' + color + ';overflow:hidden;position:relative}.banner img{width:100%;height:100%;object-fit:cover}.hero{text-align:center;padding:0 20px 20px;margin-top:-48px;position:relative;z-index:2;background:#f0f0ee}.logo{width:96px;height:96px;border-radius:50%;border:4px solid #f0f0ee;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;margin:0 auto 14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.14)}.logo img{width:100%;height:100%;object-fit:cover}h1{font-size:clamp(22px,5vw,32px);font-weight:800;margin-bottom:6px}.tagline{font-size:15px;color:#666;margin-bottom:14px}.pills{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:14px}.pill{display:flex;align-items:center;gap:6px;padding:7px 14px;border:1px solid #ddd;border-radius:100px;font-size:13px;color:#555;background:#fff;text-decoration:none}.btn-cta{display:block;width:100%;max-width:380px;margin:0 auto 6px;padding:14px;border-radius:12px;border:none;background:' + color + ';color:#fff;font-size:16px;font-weight:700;cursor:pointer;text-align:center}.sec-nav{display:flex;gap:8px;padding:16px 20px;overflow-x:auto;background:#f0f0ee;border-bottom:1px solid #e5e5e5}.sec-btn{padding:8px 16px;border-radius:100px;border:1px solid #ddd;background:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;color:#555;transition:all .15s}.sec-btn.active{background:' + color + ';color:#fff;border-color:' + color + '}.section{display:none;padding:20px}.section.visible{display:block}.svc-card{background:#fff;border-radius:16px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.07)}.svc-photo{height:180px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;position:relative;background-size:cover;background-position:center}.svc-badge{position:absolute;top:10px;left:10px;background:#f59e0b;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}.svc-body{padding:16px}.svc-name{font-size:18px;font-weight:700;margin-bottom:4px}.svc-desc{font-size:13px;color:#888;margin-bottom:8px}.svc-dur{font-size:12px;color:#aaa;margin-bottom:8px}.svc-inc-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#999;margin-bottom:5px}.svc-inc{font-size:13px;color:#555;line-height:1.8;margin-bottom:12px}.svc-footer{display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid #f0f0f0}.svc-price{font-size:18px;font-weight:800}.btn-book{padding:10px 22px;border-radius:10px;border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer}.port-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.port-img{aspect-ratio:1;border-radius:10px;background:#ddd;background-size:cover;background-position:center}.about-box{background:#fff;border-radius:14px;padding:20px;font-size:15px;line-height:1.7;color:#444}.empty{color:#aaa;text-align:center;padding:20px 0}.footer{text-align:center;padding:24px;font-size:12px;color:#bbb}@media(max-width:480px){.banner{height:160px}.logo{width:80px;height:80px;font-size:22px}.svc-photo{height:140px}}';

  const html = '<!DOCTYPE html><html lang="en"><head>'
    + '<meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + name + ' - Hubly</title>'
    + '<meta name="description" content="' + (tag||name) + '">'
    + '<style>' + css + '</style>'
    + '</head><body><div class="page">'
    + '<div class="banner">' + (bannerUrl ? '<img src="' + bannerUrl + '" alt="' + name + ' banner">' : '') + '</div>'
    + '<div class="hero">'
    + '<div class="logo">' + (logoUrl ? '<img src="' + logoUrl + '" alt="logo">' : initials) + '</div>'
    + '<h1>' + name + '</h1>'
    + (tag ? '<div class="tagline">' + tag + '</div>' : '')
    + '<div class="pills">'
    + (phone ? '<a class="pill" href="tel:' + phone + '">📞 ' + phone + '</a>' : '')
    + (email ? '<a class="pill" href="mailto:' + email + '">✉️ ' + email + '</a>' : '')
    + (city ? '<div class="pill">📍 ' + city + '</div>' : '')
    + '</div>'
    + '<button class="btn-cta" onclick="showSec('services',document.querySelector('.sec-btn'))">' + ctaText + '</button>'
    + '</div>'
    + '<div class="sec-nav">'
    + '<button class="sec-btn active" onclick="showSec('services',this)">🔧 Services</button>'
    + '<button class="sec-btn" onclick="showSec('portfolio',this)">📸 Portfolio</button>'
    + (about ? '<button class="sec-btn" onclick="showSec('about',this)">📖 About</button>' : '')
    + '</div>'
    + '<div class="section visible" id="sec-services">'
    + '<div style="font-size:20px;font-weight:800;margin-bottom:4px">Our Services</div>'
    + '<div style="font-size:13px;color:#888;margin-bottom:20px">Tap a service to book</div>'
    + (svcsHtml || '<p class="empty">No services yet</p>')
    + '</div>'
    + '<div class="section" id="sec-portfolio">'
    + '<div style="font-size:20px;font-weight:800;margin-bottom:16px">Portfolio</div>'
    + '<div class="port-grid">' + portHtml + '</div>'
    + '</div>'
    + (about ? '<div class="section" id="sec-about"><div class="about-box">' + about + '</div></div>' : '')
    + '<div class="footer">Powered by <a href="https://myhubly.app" style="color:#bbb">Hubly</a></div>'
    + '</div>'
    + '<script>function showSec(k,btn){document.querySelectorAll(".section").forEach(function(s){s.classList.remove("visible")});document.querySelectorAll(".sec-btn").forEach(function(b){b.classList.remove("active")});var s=document.getElementById("sec-"+k);if(s)s.classList.add("visible");if(btn)btn.classList.add("active");}function startBooking(n){alert("Booking for: "+n+"\nFull booking flow coming soon!");}<\/script>'
    + '</body></html>';

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
};
