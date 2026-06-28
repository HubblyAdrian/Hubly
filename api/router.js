const fs = require('fs');
const path = require('path');

// Always serve the main Hubly app. Public business profiles are resolved
// client-side from the subdomain slug (see initApp / loadPublicProfile in hubly.html).
module.exports = async (req, res) => {
  try {
    const content = fs.readFileSync(path.join(__dirname, '../public/hubly.html'), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.status(200).send(content);
  } catch (e) {
    return res.status(500).send('Error loading app: ' + e.message);
  }
};
