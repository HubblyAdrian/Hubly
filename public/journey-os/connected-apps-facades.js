/**
 * Connected App status facades for integrations Hubly can actually check.
 *
 * Settings > Integrations asks HublyConnectedApps.getFacade(appId) for each
 * card's status. Only Canva and Adobe Lightroom ever had one, and the resolver
 * fell through to a hardcoded "Not connected" for everything else — so Stripe
 * showed "Not connected" for an account with charges_enabled:true, a live
 * acct_… id and ready_to_charge:true, because nothing on that surface ever
 * called stripe-connect-connection. Google Calendar, Meta and Twilio were in
 * the same state.
 *
 * The endpoints already existed. Nothing connected them to this surface.
 *
 * Deliberately NOT here: Meta and Twilio. Neither has a status endpoint, so
 * inventing one would replace an honest "Status unavailable" with a guess.
 * They keep the unknown state until a real check exists.
 */
(function (global) {
  'use strict';

  function db() {
    // waitForDb resolves the shared Supabase client the rest of the app uses.
    if (typeof global.waitForDb === 'function') return global.waitForDb();
    if (global.db) return Promise.resolve(global.db);
    return Promise.reject(new Error('supabase_client_unavailable'));
  }

  function businessId(opts) {
    if (opts && opts.businessId) return String(opts.businessId);
    var cb = global.currentBusiness;
    return cb && cb.id ? String(cb.id) : null;
  }

  /**
   * Call a connection Edge Function and normalise its answer.
   *
   * The three outcomes are kept distinct on purpose. "Could not check" must
   * never collapse into "not connected" — that collapse is the whole defect
   * this file fixes, and repeating it one layer down would hide it again.
   */
  async function statusVia(fnName, opts, mapper) {
    var id = businessId(opts);
    if (!id) return { status: 'unknown', data: {}, message: 'No business selected' };
    try {
      var client = await db();
      var res = await client.functions.invoke(fnName, {
        body: { action: 'status', business_id: id },
      });
      if (res && res.error) throw new Error(res.error.message || 'request_failed');
      var d = (res && res.data) || {};
      if (d.error) throw new Error(String(d.error));
      return mapper(d);
    } catch (e) {
      console.warn('[connected-apps] ' + fnName + ' status failed', e && e.message);
      return {
        status: 'unknown',
        data: { health: 'unknown' },
        message: 'Status unavailable',
      };
    }
  }

  /**
   * Stripe. `ready_to_charge` is the field that matters — an account can be
   * connected but not yet able to take money (details outstanding), and the
   * card should say so rather than claiming a working integration.
   * Mirrors stripeIsReady() in hubly.html.
   */
  var StripeConnectedApp = {
    id: 'stripe',
    status: function (opts) {
      return statusVia('stripe-connect-connection', opts, function (d) {
        var ready = !!d.ready_to_charge || (!!d.charges_enabled && !!d.connected);
        var connected = !!d.connected;
        return {
          status: connected ? 'connected' : 'disconnected',
          data: {
            connected: connected,
            health: !d.configured
              ? 'not_configured'
              : (ready ? 'healthy' : (connected ? 'degraded' : 'disconnected')),
            accountLabel: d.stripe_account_id || null,
            livemode: d.livemode,
          },
          message: !d.configured
            ? 'Stripe is not configured for this platform yet'
            : (ready
              ? 'Ready to take payments'
              : (connected
                ? 'Connected — finish Stripe onboarding to take payments'
                : 'Not connected')),
        };
      });
    },
  };

  /**
   * Google Calendar. Two-way sync is the capability; `connected` is the
   * capability's own answer. `early_access` is a distinct state — not
   * connected, but not the owner's doing either.
   */
  var GoogleCalendarConnectedApp = {
    id: 'google',
    status: function (opts) {
      return statusVia('google-calendar-connection', opts, function (d) {
        var connected = !!d.connected;
        var early = !connected && d.can_connect === false;
        return {
          status: connected ? 'connected' : 'disconnected',
          data: {
            connected: connected,
            health: connected ? 'healthy' : (early ? 'not_configured' : 'disconnected'),
            accountLabel: d.email || d.calendar_id || null,
            lastSyncAt: d.last_sync_at || null,
          },
          message: connected
            ? 'Two-way sync active'
            : (early ? 'Early access — request access to connect' : 'Not connected'),
        };
      });
    },
  };

  global.HublyStripeConnectedApp = StripeConnectedApp;
  global.HublyGoogleCalendarConnectedApp = GoogleCalendarConnectedApp;

  // Register immediately if the registry is already up, otherwise let
  // connected-apps.js pick these off the global when it loads. Registration
  // must not depend on script ORDER — see registerKnownFacades there.
  if (global.HublyConnectedApps && typeof global.HublyConnectedApps.registerFacade === 'function') {
    global.HublyConnectedApps.registerFacade('stripe', StripeConnectedApp);
    global.HublyConnectedApps.registerFacade('google', GoogleCalendarConnectedApp);
  }
})(typeof window !== 'undefined' ? window : globalThis);
