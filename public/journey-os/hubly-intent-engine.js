/**
 * Hubly Core — Intent Engine (client)
 *
 * Ask Hubly → Intent → Planner → Resolver → Event Bus → Execution
 *
 * AI speaks only Intent + Capabilities. Never vendor names.
 */
(function (global) {
  'use strict';

  var INTENTS = [
    {
      id: 'promote_project',
      label: 'Promote Project',
      description: 'Create marketing assets and publish across available channels.',
      patterns: [
        /promote.+(project|gallery|shoot|wedding|session)/i,
        /(market|advertise|announce).+(project|gallery|shoot|wedding)/i,
        /share.+(project|gallery|photos?|sneak\s*peek)/i
      ]
    },
    {
      id: 'create_marketing_graphic',
      label: 'Create Marketing Graphic',
      description: 'Produce a marketing graphic from project assets and brand.',
      patterns: [
        /(create|make|design).+(graphic|flyer|carousel|post|story|thank\s*you|gift\s*card)/i,
        /marketing\s+(graphic|asset|creative)/i
      ]
    },
    {
      id: 'publish_social',
      label: 'Publish Social',
      description: 'Publish or schedule social content.',
      patterns: [
        /(publish|post|schedule).+(instagram|facebook|social|tiktok|pinterest)/i,
        /post\s+(this|it)\b/i
      ]
    },
    {
      id: 'request_review',
      label: 'Request Review',
      description: 'Ask the customer for a review.',
      patterns: [
        /(request|ask|send).+review/i,
        /review\s+request/i
      ]
    },
    {
      id: 'notify_customer',
      label: 'Notify Customer',
      description: 'Message the customer by email or SMS.',
      patterns: [
        /(email|text|sms|notify|message).+(customer|client)/i,
        /tell\s+(the\s+)?(customer|client)/i
      ]
    },
    {
      id: 'sync_storage',
      label: 'Sync Storage',
      description: 'Sync project files with connected storage.',
      patterns: [
        /sync.+(files?|photos?|storage|drive|dropbox)/i,
        /(upload|backup).+(files?|photos?)/i
      ]
    },
    {
      id: 'edit_photos',
      label: 'Edit Photos',
      description: 'Continue photo editing and sync edited assets.',
      patterns: [
        /(edit|retouch|cull).+photos?/i,
        /raw\s+edit/i
      ]
    },
    {
      id: 'update_website',
      label: 'Update Website',
      description: 'Update the business website or local listing.',
      patterns: [
        /(update|refresh).+(website|site|listing|gbp|google\s+business)/i,
        /feature.+(website|homepage)/i
      ]
    }
  ];

  function get(id) {
    return INTENTS.find(function (i) { return i.id === id; }) || null;
  }

  function list() { return INTENTS.slice(); }

  function recognize(text) {
    var q = String(text || '').trim();
    if (!q) return null;
    for (var i = 0; i < INTENTS.length; i++) {
      var intent = INTENTS[i];
      for (var p = 0; p < intent.patterns.length; p++) {
        if (intent.patterns[p].test(q)) {
          return { intent: intent, confidence: 0.85, sourceText: q };
        }
      }
    }
    return null;
  }

  function businessId(opts) {
    if (opts && opts.businessId) return opts.businessId;
    try {
      var S = global.S || {};
      return S.businessId || S.bizId || (S.business && S.business.id) || '';
    } catch (_) {
      return '';
    }
  }

  /**
   * Intent → Planner (capabilities) → Resolver (Connected Apps).
   * Returns AI view without vendor names + internal execution bindings.
   */
  function run(intentIdOrText, opts) {
    opts = opts || {};
    var recognized = null;
    if (typeof intentIdOrText === 'string' && get(intentIdOrText)) {
      recognized = { intent: get(intentIdOrText), confidence: 1, sourceText: opts.text || '' };
    } else {
      recognized = recognize(intentIdOrText);
    }
    if (!recognized) return null;

    var AE = global.HublyActionEngine;
    if (!AE || typeof AE.plan !== 'function') {
      return {
        recognized: recognized,
        ai: {
          intent: recognized.intent.label,
          capabilities: [],
          required: [],
          optional: [],
          prompt: 'Intent: ' + recognized.intent.label + '. Action Engine not loaded.'
        },
        execution: { steps: [], ready: false }
      };
    }

    var plan = AE.plan(recognized.intent.id, {
      businessId: businessId(opts),
      preferredProviderId: opts.preferredProviderId || null
    });
    var aiPlan = AE.forAi(plan);
    var required = (plan.needs || []).filter(function (n) { return n.required; }).map(function (n) { return n.label; });
    var optional = (plan.needs || []).filter(function (n) { return !n.required; }).map(function (n) { return n.label; });

    var prompt =
      'Intent: ' + recognized.intent.label + '.\n' +
      'Capabilities needed: ' + aiPlan.need.join(', ') + '.\n' +
      (aiPlan.missing.length
        ? 'Missing: ' + aiPlan.missing.join(', ') + '. Connect apps that provide these capabilities, then Execute.'
        : 'Ready to Execute.');

    var ready = (plan.steps || []).every(function (s) {
      if (!s.required) return true;
      return s.status === 'ready';
    });

    var result = {
      recognized: recognized,
      plan: plan,
      ai: {
        intent: recognized.intent.label,
        capabilities: aiPlan.need,
        required: required,
        optional: optional,
        prompt: prompt
      },
      execution: {
        steps: (plan.steps || []).map(function (s) {
          return {
            capability: s.capability,
            label: s.label,
            status: s.status,
            providerId: s._appId
          };
        }),
        ready: ready
      }
    };

    if (opts.emit !== false) {
      try {
        if (global.HublyEvents && global.HublyEvents.publish) {
          global.HublyEvents.publish('ai.action.proposed', {
            intent: recognized.intent.id,
            intentLabel: recognized.intent.label,
            capabilities: aiPlan.need,
            businessId: businessId(opts),
            projectId: opts.projectId || null
          });
        }
      } catch (_) {}
    }

    return result;
  }

  /**
   * Execute: Event Bus signal. Providers run via Connected Apps — not named here.
   */
  function execute(pipeline, opts) {
    opts = opts || {};
    if (!pipeline || !pipeline.ai) {
      return { ok: false, message: 'No intent pipeline to execute.' };
    }
    try {
      if (global.HublyEvents && global.HublyEvents.publish) {
        global.HublyEvents.publish('ai.action.executed', {
          intent: pipeline.recognized && pipeline.recognized.intent
            ? pipeline.recognized.intent.id
            : null,
          intentLabel: pipeline.ai.intent,
          capabilities: pipeline.ai.capabilities,
          businessId: businessId(opts),
          projectId: opts.projectId || null,
          ready: !!(pipeline.execution && pipeline.execution.ready)
        });
      }
    } catch (_) {}

    if (!pipeline.execution || !pipeline.execution.ready) {
      return { ok: false, message: pipeline.ai.prompt };
    }
    return {
      ok: true,
      message: 'Intent: ' + pipeline.ai.intent + '. Executing capabilities: ' +
        pipeline.ai.capabilities.join(', ') + '.'
    };
  }

  /** One-shot for Ask Hubly: recognize → plan → AI reply text. */
  function handleAsk(text, opts) {
    var pipeline = run(text, opts);
    if (!pipeline) return null;
    return {
      pipeline: pipeline,
      reply: pipeline.ai.prompt,
      intentId: pipeline.recognized.intent.id,
      intentLabel: pipeline.ai.intent
    };
  }

  global.HublyIntentEngine = {
    list: list,
    get: get,
    recognize: recognize,
    run: run,
    execute: execute,
    handleAsk: handleAsk,
    INTENTS: INTENTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
