/**
 * Hubly Core — Action Engine client (Planner + Resolver)
 *
 * Prefer HublyIntentEngine for Ask Hubly.
 * This module maps Intent → Capabilities and resolves Connected Apps.
 * AI copy must use Intent Engine (Intent → Capabilities → Execute).
 */
(function (global) {
  'use strict';

  var INTENT_NEEDS = {
    promote_project: [
      { capability: 'creative', label: 'Marketing Graphics', required: true },
      { capability: 'publishing', label: 'Social Publishing', required: true },
      { capability: 'messaging', label: 'Email / SMS', required: false },
      { capability: 'scheduling', label: 'Schedule posts', required: false }
    ],
    create_marketing_graphic: [
      { capability: 'creative', label: 'Marketing Graphics', required: true },
      { capability: 'templates', label: 'Templates', required: false }
    ],
    publish_social: [
      { capability: 'publishing', label: 'Social Publishing', required: true },
      { capability: 'scheduling', label: 'Schedule posts', required: false }
    ],
    request_review: [
      { capability: 'reviews', label: 'Reviews', required: true },
      { capability: 'messaging', label: 'Email / SMS', required: false }
    ],
    notify_customer: [
      { capability: 'messaging', label: 'Email / SMS', required: true }
    ],
    sync_storage: [
      { capability: 'storage', label: 'File Storage', required: true }
    ],
    edit_photos: [
      { capability: 'editing', label: 'Photo Editing', required: true }
    ]
  };

  function catalog() {
    return (global.HublyConnectedApps && global.HublyConnectedApps.list)
      ? global.HublyConnectedApps.list()
      : [];
  }

  function installedIds(businessId) {
    return (global.HublyConnectedApps && global.HublyConnectedApps.readInstalled)
      ? global.HublyConnectedApps.readInstalled(businessId)
      : [];
  }

  function appsForCapability(capability, businessId) {
    var installed = installedIds(businessId);
    return catalog().filter(function (a) {
      return (a.capabilities || []).indexOf(capability) !== -1 &&
        installed.indexOf(a.id) !== -1;
    });
  }

  /**
   * Resolve a Connected App for a capability. Prefer installed apps.
   * Returns capability-oriented result; appId is for executors only.
   */
  function resolveForCapability(capability, opts) {
    opts = opts || {};
    var apps = appsForCapability(capability, opts.businessId);
    if (opts.preferredProviderId) {
      var preferred = apps.find(function (a) { return a.id === opts.preferredProviderId; });
      if (preferred) {
        return {
          capability: capability,
          status: 'ready',
          appId: preferred.id,
          appName: preferred.name,
          label: (preferred.productCapabilities && preferred.productCapabilities[0]) || capability
        };
      }
    }
    if (!apps.length) {
      var any = catalog().filter(function (a) {
        return (a.capabilities || []).indexOf(capability) !== -1;
      });
      if (!any.length) {
        return { capability: capability, status: 'blocked', message: 'No app declares this capability.' };
      }
      return {
        capability: capability,
        status: 'not_configured',
        appId: any[0].id,
        appName: any[0].name,
        message: 'Need: ' + ((any[0].productCapabilities && any[0].productCapabilities[0]) || capability) + '. Connect an app that provides it.'
      };
    }
    var pick = apps[0];
    return {
      capability: capability,
      status: 'ready',
      appId: pick.id,
      appName: pick.name,
      label: (pick.productCapabilities && pick.productCapabilities[0]) || capability
    };
  }

  function plan(intent, opts) {
    opts = opts || {};
    var needs = (INTENT_NEEDS[intent] || []).map(function (n) {
      return { capability: n.capability, label: n.label, required: !!n.required };
    });
    var steps = needs.map(function (need) {
      var resolved = resolveForCapability(need.capability, opts);
      return {
        capability: need.capability,
        label: need.label,
        required: need.required,
        status: resolved.status,
        // Bound for executors — AI-facing helpers omit these.
        _appId: resolved.appId,
        message: resolved.message
      };
    });
    var missing = steps.filter(function (s) {
      return s.required && (s.status === 'blocked' || s.status === 'not_configured');
    }).map(function (s) { return s.label; });

    var aiPrompt =
      'Need: ' + needs.map(function (n) { return n.label; }).join(', ') + '.' +
      (missing.length ? ' Missing: ' + missing.join(', ') + '.' : ' All required capabilities are available.');

    return {
      intent: intent,
      needs: needs,
      steps: steps,
      missing: missing,
      /** Capability-only copy for Ask Hubly / Coach — never vendor names. */
      aiPrompt: aiPrompt,
      summary: aiPrompt
    };
  }

  /** Strip provider ids from a plan for AI / owner-facing surfaces. */
  function forAi(planResult) {
    return {
      need: (planResult.needs || []).map(function (n) { return n.label; }),
      available: (planResult.steps || []).filter(function (s) {
        return s.status === 'ready';
      }).map(function (s) { return s.label; }),
      missing: planResult.missing || [],
      prompt: planResult.aiPrompt || planResult.summary || ''
    };
  }

  function publishProposed(planResult, extra) {
    try {
      if (global.HublyEvents && global.HublyEvents.publish) {
        global.HublyEvents.publish('ai.action.proposed', Object.assign({
          intent: planResult.intent,
          needs: (planResult.needs || []).map(function (n) { return n.label; }),
          missing: planResult.missing || []
        }, extra || {}));
      }
    } catch (_) {}
  }

  global.HublyActionEngine = {
    plan: plan,
    forAi: forAi,
    resolveForCapability: resolveForCapability,
    publishProposed: publishProposed,
    INTENT_NEEDS: INTENT_NEEDS
  };
})(typeof window !== 'undefined' ? window : globalThis);
