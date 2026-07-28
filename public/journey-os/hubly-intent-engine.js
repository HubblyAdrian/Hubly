/**
 * Hubly Core — Intent Engine (client)
 *
 * Ask Hubly → Intent → Planner → Resolver → Execution Plan → Event Bus → Providers
 *
 * Execution Plans are draft until Approve — then Execute.
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

  var _plans = Object.create(null);

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

  function planId() {
    return 'xplan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function buildExecutionPlan(recognized, plan, aiPlan, opts) {
    var needs = (plan.needs || []).map(function (n) {
      return { label: n.label, capability: n.capability, required: !!n.required };
    });
    var steps = (plan.steps || []).map(function (s, i) {
      return {
        id: 'step_' + i + '_' + s.capability,
        capability: s.capability,
        label: s.label,
        required: !!s.required,
        status: s.status,
        providerId: s._appId,
        message: s.message
      };
    });
    var missing = steps.filter(function (s) {
      return s.required && (s.status === 'blocked' || s.status === 'not_configured');
    }).map(function (s) { return s.label; });

    var preview =
      'Intent: ' + recognized.intent.label + '.\n' +
      'Capabilities needed: ' + aiPlan.need.join(', ') + '.\n' +
      (missing.length
        ? 'Missing: ' + missing.join(', ') + '. Connect apps that provide these capabilities, then Approve.\n'
        : 'Ready to Approve.\n') +
      'Status: draft (preview — nothing has run yet).';

    var now = new Date().toISOString();
    var xp = {
      id: planId(),
      intentId: recognized.intent.id,
      intentLabel: recognized.intent.label,
      businessId: businessId(opts),
      projectId: opts.projectId || null,
      status: 'draft',
      needs: needs,
      steps: steps,
      preview: preview,
      createdAt: now,
      updatedAt: now
    };
    _plans[xp.id] = xp;
    return xp;
  }

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
          prompt: 'Intent: ' + recognized.intent.label + '. Planner not loaded.'
        },
        executionPlan: null,
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
    var executionPlan = buildExecutionPlan(recognized, plan, aiPlan, opts);

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
        prompt: executionPlan.preview
      },
      executionPlan: executionPlan,
      execution: {
        steps: executionPlan.steps,
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
            executionPlanId: executionPlan.id,
            businessId: businessId(opts),
            projectId: opts.projectId || null
          });
        }
      } catch (_) {}
    }

    return result;
  }

  function approve(executionPlanId) {
    var xp = _plans[executionPlanId];
    if (!xp || xp.status !== 'draft') return null;
    xp.status = 'approved';
    xp.approvedAt = new Date().toISOString();
    xp.updatedAt = xp.approvedAt;
    xp.preview = xp.preview.replace(/Status: draft.*/, 'Status: approved — ready to Execute.');
    return xp;
  }

  function cancel(executionPlanId) {
    var xp = _plans[executionPlanId];
    if (!xp || (xp.status !== 'draft' && xp.status !== 'approved')) return null;
    xp.status = 'cancelled';
    xp.cancelledAt = new Date().toISOString();
    xp.updatedAt = xp.cancelledAt;
    xp.preview = xp.preview.replace(/Status:.*/, 'Status: cancelled.');
    return xp;
  }

  function execute(pipeline, opts) {
    opts = opts || {};
    if (!pipeline || !pipeline.ai) {
      return { ok: false, message: 'No intent pipeline to execute.' };
    }
    var xp = pipeline.executionPlan;
    if (xp && xp.status === 'draft') {
      approve(xp.id);
      xp = _plans[xp.id];
    }
    if (xp && xp.status !== 'approved' && xp.status !== 'executing') {
      return { ok: false, message: 'Approve the Execution Plan before Execute.' };
    }
    if (xp) {
      xp.status = 'executing';
      xp.executedAt = new Date().toISOString();
      xp.updatedAt = xp.executedAt;
    }
    try {
      if (global.HublyEvents && global.HublyEvents.publish) {
        global.HublyEvents.publish('ai.action.executed', {
          intent: pipeline.recognized && pipeline.recognized.intent
            ? pipeline.recognized.intent.id
            : null,
          intentLabel: pipeline.ai.intent,
          capabilities: pipeline.ai.capabilities,
          executionPlanId: xp ? xp.id : null,
          businessId: businessId(opts),
          projectId: opts.projectId || null,
          ready: !!(pipeline.execution && pipeline.execution.ready)
        });
      }
    } catch (_) {}

    if (!pipeline.execution || !pipeline.execution.ready) {
      if (xp) xp.status = 'failed';
      return { ok: false, message: pipeline.ai.prompt, executionPlan: xp };
    }
    if (xp) xp.status = 'completed';
    return {
      ok: true,
      message: 'Intent: ' + pipeline.ai.intent + '. Executing capabilities: ' +
        pipeline.ai.capabilities.join(', ') + '.',
      executionPlan: xp
    };
  }

  function handleAsk(text, opts) {
    var pipeline = run(text, opts);
    if (!pipeline) return null;
    var reply = pipeline.ai.prompt +
      '\n\nSay “approve” to Approve this Execution Plan, or “cancel” to discard it.';
    return {
      pipeline: pipeline,
      reply: reply,
      intentId: pipeline.recognized.intent.id,
      intentLabel: pipeline.ai.intent,
      executionPlanId: pipeline.executionPlan && pipeline.executionPlan.id
    };
  }

  function getPlan(id) { return _plans[id] || null; }

  global.HublyIntentEngine = {
    list: list,
    get: get,
    recognize: recognize,
    run: run,
    approve: approve,
    cancel: cancel,
    execute: execute,
    handleAsk: handleAsk,
    getPlan: getPlan,
    INTENTS: INTENTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
