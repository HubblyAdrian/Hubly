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
      return res.status(500).send('Error loading app: ' + e.message);
    }
  }

  const slug = parts[0];
  const { data: biz, error } = await supabase.from('businesses').select('*').eq('slug', slug).single();

  if (error || !biz) {
    var notFound = '<!DOCTYPE html><html><head><title>Not found</title><meta name=viewport content=width=device-width,initial-scale=1><style>body{font-family:system-ui;text-align:center;padding:80px 20px;background:#f5f5f3}</style></head>';
    notFound += '<body><h2>Profile not found</h2><p>' + slug + '.myhubly.app does not exist yet.</p>';
    notFound += '<p><a href=https://myhubly.app>Sign up on Hubly</a></p></body></html>';
    return res.status(404).send(notFound);
  }

  var meta = {};
  try { meta = JSON.parse(biz.meta || '{}'); } catch(e) {}
  const { data: services } = await supabase.from('services').select('*').eq('business_id', biz.id).order('position');
  var svcs = (meta.editorSvcs && meta.editorSvcs.length) ? meta.editorSvcs : (services || []);

  var color = biz.brand_color || '#1a3a6e';
  var name = biz.name || '';
  var tag = biz.tagline || '';
  var phone = biz.phone || '';
  var email = biz.email || '';
  var city = biz.city || '';
  var about = biz.about || '';
  var logoUrl = meta.logoUrl || biz.logo_url || '';
  var bannerUrl = meta.bannerUrl || biz.banner_url || '';
  var portfolioUrls = meta.portfolioUrls || [];
  var ctaText = meta.ctaText || 'Book Now';
  var initials = name.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase() || 'BM';

  var svcsHtml = svcs.map(function(s, i) {
    var photo = (s.photos && s.photos[0]) || s.imgUrl || '';
    var inc = (s.includes || '').split('\n').map(function(l){return l.trim();}).filter(Boolean);
    var showPrice = s.showPrice !== false;
    var price = showPrice ? (s.price ? 'from $' + s.price : '') : 'Contact for pricing';
    var photoStyle = photo ? 'background-image:url(' + JSON.stringify(photo) + ');' : '';
    var popular = s.popular ? '<span style=position:absolute;top:10px;left:10px;background:#f59e0b;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px>Popular</span>' : '';
    var incHtml = '';
    if (inc.length > 0) {
      incHtml = '<div style=font-size:13px;color:#555;line-height:1.8;margin-bottom:12px>' + inc.slice(0,4).map(function(l){return '+ ' + l;}).join('<br>') + (inc.length > 4 ? '<br><span style=color:#aaa>+' + (inc.length-4) + ' more</span>' : '') + '</div>';
    }
    return '<div class=svc style=background:#fff;border-radius:16px;overflow:hidden;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.07)>'
      + '<div style=height:180px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;position:relative;background-size:cover;background-position:center;' + photoStyle + '>' + popular + '</div>'
      + '<div style=padding:16px>'
      + '<div style=font-size:18px;font-weight:700;margin-bottom:4px>' + (s.name || '') + '</div>'
      + (s.desc ? '<div style=font-size:13px;color:#888;margin-bottom:8px>' + s.desc + '</div>' : '')
      + (s.dur ? '<div style=font-size:12px;color:#aaa;margin-bottom:8px>Duration: ' + s.dur + ' hrs</div>' : '')
      + incHtml
      + '<div style=display:flex;align-items:center;justify-content:space-between;padding-top:12px;border-top:1px solid #f0f0f0>'
      + '<div style=font-size:18px;font-weight:800;color:' + color + '>' + price + '</div>'
      + '<button class=bk-btn style=padding:10px 22px;border-radius:10px;border:none;background:' + color + ';color:#fff;font-size:14px;font-weight:700;cursor:pointer>' + ctaText + '</button>'
      + '</div></div></div>';
  }).join('');

  var portHtml = portfolioUrls.length
    ? portfolioUrls.map(function(u){return '<div style=aspect-ratio:1;border-radius:10px;background-size:cover;background-position:center;background-color:#ddd;background-image:url(' + JSON.stringify(u) + ')></div>';}).join('')
    : '<p style=color:#aaa;text-align:center;padding:20px 0>No photos yet</p>';

  var pillSt = 'display:inline-flex;align-items:center;padding:7px 14px;border:1px solid #ddd;border-radius:100px;font-size:13px;color:#555;background:#fff;text-decoration:none;margin:4px';

  var html = '<!DOCTYPE html><html lang=en><head><meta charset=UTF-8>'
    + '<meta name=viewport content=width=device-width,initial-scale=1>'
    + '<title>' + name + ' - Hubly</title>'
    + '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#f0f0ee;color:#111}.page{max-width:680px;margin:0 auto;padding-bottom:60px}.sec{display:none;padding:20px}.sec.on{display:block}.nb{padding:8px 16px;border-radius:100px;border:1px solid #ddd;background:#fff;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;color:#555}.nb.on{background:' + color + ';color:#fff;border-color:' + color + '}</style>'
    + '</head><body><div class=page>'
    + '<div style=width:100%;height:min(40vw,260px);background:' + color + ';overflow:hidden>' + (bannerUrl ? '<img src=' + JSON.stringify(bannerUrl) + ' style=width:100%;height:100%;object-fit:cover>' : '') + '</div>'
    + '<div style=text-align:center;padding:0 20px 20px;margin-top:-48px;position:relative;z-index:2;background:#f0f0ee>'
    + '<div style=width:96px;height:96px;border-radius:50%;border:4px solid #f0f0ee;background:' + color + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;margin-bottom:14px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.14)>' + (logoUrl ? '<img src=' + JSON.stringify(logoUrl) + ' style=width:100%;height:100%;object-fit:cover>' : initials) + '</div>'
    + '<h1 style=font-size:clamp(22px,5vw,32px);font-weight:800;margin-bottom:6px>' + name + '</h1>'
    + (tag ? '<p style=font-size:15px;color:#666;margin-bottom:14px>' + tag + '</p>' : '')
    + '<div style=display:flex;flex-wrap:wrap;justify-content:center;margin-bottom:14px>'
    + (phone ? '<a href=tel:' + phone + ' style=' + JSON.stringify(pillSt) + '>' + phone + '</a>' : '')
    + (email ? '<a href=mailto:' + email + ' style=' + JSON.stringify(pillSt) + '>' + email + '</a>' : '')
    + (city ? '<span style=' + JSON.stringify(pillSt) + '>' + city + '</span>' : '')
    + '</div>'
    + '<button id=main-cta style=display:block;width:100%;max-width:380px;margin:0 auto;padding:14px;border-radius:12px;border:none;background:' + color + ';color:#fff;font-size:16px;font-weight:700;cursor:pointer>' + ctaText + '</button>'
    + '</div>'
    + '<div style=display:flex;gap:8px;padding:16px 20px;overflow-x:auto;background:#f0f0ee;border-bottom:1px solid #e5e5e5>'
    + '<button class="nb on" id=nb-services>Services</button>'
    + '<button class=nb id=nb-portfolio>Portfolio</button>'
    + (about ? '<button class=nb id=nb-about>About</button>' : '')
    + '</div>'
    + '<div class="sec on" id=sec-services>'
    + '<div style=font-size:20px;font-weight:800;margin-bottom:4px>Our Services</div>'
    + '<div style=font-size:13px;color:#888;margin-bottom:20px>Tap a service to book</div>'
    + (svcsHtml || '<p style=color:#aaa;padding:20px 0>No services yet</p>')
    + '</div>'
    + '<div class=sec id=sec-portfolio>'
    + '<div style=font-size:20px;font-weight:800;margin-bottom:16px>Portfolio</div>'
    + '<div style=display:grid;grid-template-columns:repeat(3,1fr);gap:8px>' + portHtml + '</div>'
    + '</div>'
    + (about ? '<div class=sec id=sec-about><div style=background:#fff;border-radius:14px;padding:20px;font-size:15px;line-height:1.7;color:#444>' + about + '</div></div>' : '')
    + '<div style=text-align:center;padding:24px;font-size:12px;color:#bbb>Powered by <a href=https://myhubly.app style=color:#bbb>Hubly</a></div>'
    + '</div>'
    + '<script>'
    + 'function show(k){'
    + 'document.querySelectorAll(".sec").forEach(function(s){s.classList.remove("on");});'
    + 'document.querySelectorAll(".nb").forEach(function(b){b.classList.remove("on");});'
    + 'var s=document.getElementById("sec-"+k);if(s)s.classList.add("on");'
    + 'var b=document.getElementById("nb-"+k);if(b)b.classList.add("on");'
    + '}'
    + 'document.getElementById("nb-services").addEventListener("click",function(){show("services");});'
    + 'document.getElementById("nb-portfolio").addEventListener("click",function(){show("portfolio");});'
    + (about ? 'document.getElementById("nb-about").addEventListener("click",function(){show("about");});' : '')
    + 'document.getElementById("main-cta").addEventListener("click",function(){show("services");});'
    + 'document.querySelectorAll(".bk-btn").forEach(function(btn){btn.addEventListener("click",function(){show("services");});});'
    + '<\/script>'
    + '</body></html>';

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
};
