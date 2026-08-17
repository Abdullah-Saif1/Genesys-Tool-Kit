const express = require('express');
const archiver = require('archiver');

// ---------------------------------------------------------------------------
// Hand-authored flow templates (curated templates + AI fills the blanks).
// Each mirrors a tested pattern from the write-flow skill's reference examples.
// ---------------------------------------------------------------------------

function escapeExpressionString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function buildInboundCallMenuFlow(scripting, params) {
  const { archFactoryFlows, archFactoryActions, archFactoryMenus } = scripting.factories;

  const flow = await archFactoryFlows.createFlowInboundCallAsync(params.name, params.description || '');
  const initialState = flow.startUpObject;

  if (params.greeting) {
    const play = archFactoryActions.addActionPlayAudio(initialState.outputSequence);
    play.setTextToSpeak(params.greeting);
  }

  const menu = archFactoryMenus.addMenu(flow, `${params.name} Menu`);
  menu.setMenuPromptByText(params.menuPrompt || 'Please choose an option.');

  for (const option of params.menuOptions) {
    const choice = menu.addMenuChoice(String(option.digit), option.label);
    const transfer = archFactoryActions.addActionTransferToAcd(choice.outputSequence);
    await transfer.setQueueByName(option.queueName);
  }

  const jumpToMenu = archFactoryActions.addActionJumpToMenu(initialState.outputSequence);
  jumpToMenu.targetMenu = menu;

  return await flow.publishAsync();
}

async function buildInboundEmailAutoReplyFlow(scripting, params) {
  const { archFactoryFlows, archFactoryActions } = scripting.factories;

  const flow = await archFactoryFlows.createFlowInboundEmailAsync(params.name, params.description || '');
  const sequence = flow.startUpObject.outputSequence;

  const autoReply = archFactoryActions.addActionSendAutoReply(sequence);
  autoReply.setFromAddressByLiteralString(params.fromAddress);
  autoReply.setSubjectByLiteralString(params.subject);
  autoReply.setBodyByLiteralString(params.body);

  const transfer = archFactoryActions.addActionTransferToAcd(sequence);
  await transfer.setQueueByName(params.queueName);

  return await flow.publishAsync();
}

async function buildInboundMessageAutoReplyFlow(scripting, params) {
  const { archFactoryFlows, archFactoryActions } = scripting.factories;

  const flow = await archFactoryFlows.createFlowInboundShortMessageAsync(params.name, params.description || '');
  const initialState = flow.startUpObject;

  const reply = archFactoryActions.addActionSendResponse(initialState);
  reply.messageBody.setExpression(`"${escapeExpressionString(params.replyText)}"`);

  const transfer = archFactoryActions.addActionTransferToAcd(initialState);
  await transfer.setQueueByName(params.queueName);

  return await flow.publishAsync();
}

async function buildCallbackWorkflowFlow(scripting, params) {
  const { archFactoryFlows, archFactoryActions } = scripting.factories;

  const flow = await archFactoryFlows.createFlowWorkflowAsync(params.name, params.description || '');
  const sequence = flow.startUpObject.outputSequence;

  const callbackVar = flow.addVariableString('callbackNumber');
  callbackVar.setDefaultValueAsString('Not provided');

  const setVar = archFactoryActions.addActionSetVariable(sequence);
  setVar.variableName = 'Flow.callbackNumber';
  setVar.variableValue = 'Call.Ani';

  const callback = archFactoryActions.addActionCreateCallback(sequence);
  await callback.setQueueByName(params.queueName);
  callback.callbackNumberExpression = 'Flow.callbackNumber';

  archFactoryActions.addActionEndWorkflow(sequence);

  return await flow.publishAsync();
}

async function buildDigitalBotFlow(scripting, params) {
  const { archFactoryFlows, archFactoryActions } = scripting.factories;

  const flow = await archFactoryFlows.createFlowDigitalBotAsync(params.name, params.description || '');
  // "Initial Greeting" (ArchStateBot) is auto-created as the startup object.
  const initialState = flow.startUpObject;

  const greeting = archFactoryActions.addActionCommunicate(initialState, 'Greeting');
  greeting.communication.setExpression(`"${escapeExpressionString(params.greeting)}"`);

  const menu = archFactoryActions.addActionDigitalMenu(initialState, 'Topic Menu');
  menu.question.setExpression(`"${escapeExpressionString(params.menuPrompt)}"`);

  for (const option of params.menuOptions) {
    menu.addChoice(option.label);
    // getOutputByName requires the `true` (dynamic-outputs) flag for choices added at runtime.
    const output = menu.getOutputByName(option.label, true);
    const reply = archFactoryActions.addActionCommunicate(output, `${option.label} Reply`);
    reply.communication.setExpression(`"${escapeExpressionString(option.reply)}"`);
    archFactoryActions.addActionExitBotFlow(output, `Exit After ${option.label}`);
  }

  // Free-text fallback: anything that doesn't match a menu choice lands here.
  menu.customizeNoMatch.setLiteralTrue();
  menu.outputMaxNoMatches.enabled = true;
  const fallbackPath = menu.outputMaxNoMatches;
  const fallback = archFactoryActions.addActionCommunicate(fallbackPath, 'Fallback');
  fallback.communication.setExpression(`"${escapeExpressionString(params.fallbackText)}"`);
  archFactoryActions.addActionExitBotFlow(fallbackPath, 'Exit After Fallback');

  return await flow.publishAsync();
}

const FLOW_TYPES = {
  inbound_call: { label: 'Inbound Call (IVR menu)', builder: buildInboundCallMenuFlow },
  inbound_email: { label: 'Inbound Email (auto-reply)', builder: buildInboundEmailAutoReplyFlow },
  inbound_message: { label: 'Inbound Message / SMS (auto-reply)', builder: buildInboundMessageAutoReplyFlow },
  workflow: { label: 'Callback Workflow', builder: buildCallbackWorkflowFlow },
  digital_bot: { label: 'Digital Bot (webchat/text menu + fallback)', builder: buildDigitalBotFlow },
};

// ---------------------------------------------------------------------------
// Parameter-extraction schemas — Claude fills these in from the user's free-text prompt.
// ---------------------------------------------------------------------------

const GENERATION_SCHEMAS = {
  inbound_call: {
    systemPrompt:
      'You extract structured parameters for a Genesys Cloud inbound-call IVR flow from a free-text description. ' +
      'Infer sensible menu digits (1, 2, 3, ...) and short labels if not explicit. Queue names should match names mentioned in the prompt verbatim.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short, descriptive flow name' },
        description: { type: 'string', description: 'One-sentence description of the flow' },
        greeting: { type: 'string', description: 'TTS greeting played before the menu. Use an empty string if none is implied.' },
        menuPrompt: { type: 'string', description: 'The TTS text read for the menu choices, e.g. "Press 1 for Sales, 2 for Support"' },
        menuOptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              digit: { type: 'string', description: 'DTMF digit, e.g. "1"' },
              label: { type: 'string', description: 'Short label for this choice, e.g. "Sales"' },
              queueName: { type: 'string', description: 'Name of the Genesys Cloud queue to transfer to' },
            },
            required: ['digit', 'label', 'queueName'],
            additionalProperties: false,
          },
        },
      },
      required: ['name', 'description', 'greeting', 'menuPrompt', 'menuOptions'],
      additionalProperties: false,
    },
  },
  inbound_email: {
    systemPrompt: 'You extract structured parameters for a Genesys Cloud inbound-email auto-reply flow from a free-text description.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short, descriptive flow name' },
        description: { type: 'string', description: 'One-sentence description of the flow' },
        fromAddress: { type: 'string', description: 'From address for the auto-reply, e.g. noreply@example.com' },
        subject: { type: 'string', description: 'Subject line of the auto-reply email' },
        body: { type: 'string', description: 'Body text of the auto-reply email' },
        queueName: { type: 'string', description: 'Name of the Genesys Cloud queue to transfer the email to' },
      },
      required: ['name', 'description', 'fromAddress', 'subject', 'body', 'queueName'],
      additionalProperties: false,
    },
  },
  inbound_message: {
    systemPrompt: 'You extract structured parameters for a Genesys Cloud inbound-SMS/message auto-reply flow from a free-text description.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short, descriptive flow name' },
        description: { type: 'string', description: 'One-sentence description of the flow' },
        replyText: { type: 'string', description: 'Auto-reply text sent back to the customer' },
        queueName: { type: 'string', description: 'Name of the Genesys Cloud queue to transfer the message to' },
      },
      required: ['name', 'description', 'replyText', 'queueName'],
      additionalProperties: false,
    },
  },
  workflow: {
    systemPrompt: 'You extract structured parameters for a Genesys Cloud callback workflow from a free-text description. The caller phone number is always taken automatically; do not ask for it.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short, descriptive flow name' },
        description: { type: 'string', description: 'One-sentence description of the flow' },
        queueName: { type: 'string', description: 'Name of the Genesys Cloud queue the callback should be created against' },
      },
      required: ['name', 'description', 'queueName'],
      additionalProperties: false,
    },
  },
  digital_bot: {
    systemPrompt:
      'You extract structured parameters for a Genesys Cloud digital bot flow (a text-based bot, e.g. webchat) from a free-text description. ' +
      'Infer 2 or more reasonable topic choices with short labels and a short reply for each if not fully explicit. Keep replies conversational, not TTS-style.',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short, descriptive flow name' },
        description: { type: 'string', description: 'One-sentence description of the flow' },
        greeting: { type: 'string', description: 'Opening message the bot sends first, e.g. "Hello! How can I help?"' },
        menuPrompt: { type: 'string', description: 'The question asked to the user, e.g. "Please choose a topic or type your question:"' },
        menuOptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Short choice label shown as a button, e.g. "Billing"' },
              reply: { type: 'string', description: 'What the bot says after this choice is picked' },
            },
            required: ['label', 'reply'],
            additionalProperties: false,
          },
        },
        fallbackText: { type: 'string', description: "What the bot says when it doesn't understand free-text input, right before exiting." },
      },
      required: ['name', 'description', 'greeting', 'menuPrompt', 'menuOptions', 'fallbackText'],
      additionalProperties: false,
    },
  },
};

// ---------------------------------------------------------------------------
// Evaluation form generation — turns a plain-text description of QA criteria into a structured
// Genesys Cloud EvaluationForm question-group tree (multipleChoiceQuestion only; the builder UI
// lets the reviewer add other question types/fields by hand afterwards).
// ---------------------------------------------------------------------------

const EVAL_FORM_GENERATION_SCHEMA = {
  systemPrompt:
    'You design a Genesys Cloud contact-center QA evaluation form from a free-text description of what should be evaluated. ' +
    'Group related criteria into question groups with short names (e.g. "Greeting", "Compliance", "Resolution"). ' +
    'Each question is scored via multiple-choice answer options; give every question 2-5 answer options ordered worst-to-best, ' +
    'each with a short label and an integer value (0 for the worst option, increasing for better options — a typical scale is ' +
    '0/1 for Yes/No or 0-3/0-5 for graded scales). Mark a question isCritical only if failing it should flag the whole ' +
    'evaluation as needing review, and isKill only if it should automatically fail (zero) the entire form — leave both false ' +
    'unless the description clearly implies it.',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short, descriptive name for the evaluation form' },
      questionGroups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'The question text shown to the evaluator' },
                  helpText: { type: 'string', description: 'Short clarifying guidance for the evaluator. Empty string if none needed.' },
                  isCritical: { type: 'boolean' },
                  isKill: { type: 'boolean' },
                  answerOptions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        text: { type: 'string' },
                        value: { type: 'integer' },
                      },
                      required: ['text', 'value'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['text', 'helpText', 'isCritical', 'isKill', 'answerOptions'],
                additionalProperties: false,
              },
            },
          },
          required: ['name', 'questions'],
          additionalProperties: false,
        },
      },
    },
    required: ['name', 'questionGroups'],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// AI providers — the flow-generation step can run on any of these; the user
// brings their own key for whichever one they pick.
// ---------------------------------------------------------------------------

const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', envVar: 'ANTHROPIC_API_KEY', defaultModel: 'claude-opus-4-8' },
  openai: { label: 'OpenAI', envVar: 'OPENAI_API_KEY', defaultModel: 'gpt-5.6-sol' },
  gemini: { label: 'Google Gemini', envVar: 'GEMINI_API_KEY', defaultModel: 'gemini-3.6-flash' },
};

// Gemini's Schema dialect isn't plain JSON Schema: types are an uppercase enum (STRING/OBJECT/...)
// and there's no additionalProperties field. Convert our canonical JSON Schema into that shape.
const JSON_SCHEMA_TYPE_TO_GEMINI = {
  object: 'OBJECT',
  array: 'ARRAY',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
};

function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  if (schema.type && JSON_SCHEMA_TYPE_TO_GEMINI[schema.type]) out.type = JSON_SCHEMA_TYPE_TO_GEMINI[schema.type];
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.required) out.required = schema.required;
  if (schema.properties) {
    out.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      out.properties[key] = toGeminiSchema(value);
    }
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  return out;
}

function resolveProviderConfig(req) {
  if (req.session && req.session.architectApiKey && req.session.architectProvider && PROVIDERS[req.session.architectProvider]) {
    const provider = req.session.architectProvider;
    return {
      provider,
      apiKey: req.session.architectApiKey,
      model: req.session.architectModel || PROVIDERS[provider].defaultModel,
    };
  }
  for (const [id, def] of Object.entries(PROVIDERS)) {
    if (process.env[def.envVar]) {
      return { provider: id, apiKey: process.env[def.envVar], model: def.defaultModel };
    }
  }
  return null;
}

async function extractWithAnthropic(apiKey, model, systemPrompt, schema, userPrompt) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: systemPrompt,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) throw new Error('Claude did not return structured output');
  return JSON.parse(textBlock.text);
}

async function extractWithOpenAI(apiKey, model, systemPrompt, schema, userPrompt) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    text: { format: { type: 'json_schema', name: 'flow_params', schema, strict: true } },
  });
  if (!response.output_parsed) throw new Error('OpenAI did not return structured output');
  return response.output_parsed;
}

async function extractWithGemini(apiKey, model, systemPrompt, schema, userPrompt) {
  // @google/genai is ESM-only — require() can't load it from this CommonJS codebase, so it
  // must be brought in via dynamic import() instead.
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
    },
  });
  if (!response.text) throw new Error('Gemini did not return structured output');
  return JSON.parse(response.text);
}

async function extractParams({ provider, apiKey, model, systemPrompt, schema, userPrompt }) {
  if (provider === 'anthropic') return extractWithAnthropic(apiKey, model, systemPrompt, schema, userPrompt);
  if (provider === 'openai') return extractWithOpenAI(apiKey, model, systemPrompt, schema, userPrompt);
  if (provider === 'gemini') return extractWithGemini(apiKey, model, systemPrompt, schema, userPrompt);
  throw new Error(`Unsupported provider: ${provider}`);
}

async function testProviderKey(provider, apiKey, model) {
  if (provider === 'anthropic') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    await client.models.retrieve(model);
    return;
  }
  if (provider === 'openai') {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey });
    await client.models.list();
    return;
  }
  if (provider === 'gemini') {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey });
    await client.models.list();
    return;
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = function createArchitectRouter({ getValidToken, saveSession, REGIONS }) {
  const router = express.Router();

  function requireGenesysAuth(req, res, next) {
    if (!req.session || !req.session.gcAuth) {
      return res.status(401).json({ error: 'Not authenticated with Genesys Cloud. Please log in first.' });
    }
    next();
  }

  function sendError(res, err) {
    console.error('[architect]', err);
    res.status(err.status || 500).json({ error: err.message || 'Unexpected error', details: err.details });
  }

  async function gcRequest(req, method, apiPath, { query, body } = {}) {
    const auth = await getValidToken(req);
    const regionInfo = REGIONS[auth.region];
    const url = new URL(`https://${regionInfo.apiHost}${apiPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
      }
    }

    const resp = await fetch(url.toString(), {
      method,
      headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    const data = text ? JSON.parse(text) : null;
    if (!resp.ok) {
      const err = new Error((data && data.message) || `Genesys API error ${resp.status}`);
      err.status = resp.status;
      err.details = data;
      throw err;
    }
    return data;
  }

  // ---- Flows -----------------------------------------------------------

  router.get('/flows', requireGenesysAuth, async (req, res) => {
    try {
      const data = await gcRequest(req, 'GET', '/api/v2/flows', {
        query: {
          pageSize: req.query.pageSize || 50,
          pageNumber: req.query.pageNumber || 1,
          name: req.query.name,
          type: req.query.type,
          sortBy: 'name',
        },
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/flows/:id', requireGenesysAuth, async (req, res) => {
    try {
      await gcRequest(req, 'DELETE', `/api/v2/flows/${encodeURIComponent(req.params.id)}`);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- Prompts -----------------------------------------------------------

  router.get('/prompts', requireGenesysAuth, async (req, res) => {
    try {
      const data = await gcRequest(req, 'GET', '/api/v2/architect/prompts', {
        query: {
          pageSize: req.query.pageSize || 50,
          pageNumber: req.query.pageNumber || 1,
          name: req.query.name,
          includeResources: req.query.includeResources,
          language: req.query.language,
        },
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/prompts', requireGenesysAuth, async (req, res) => {
    try {
      const { name, description } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      const data = await gcRequest(req, 'POST', '/api/v2/architect/prompts', { body: { name, description } });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.get('/prompts/:id', requireGenesysAuth, async (req, res) => {
    try {
      const data = await gcRequest(req, 'GET', `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}`, {
        query: { includeResources: req.query.includeResources },
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put('/prompts/:id', requireGenesysAuth, async (req, res) => {
    try {
      const { name, description } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name is required' });
      const data = await gcRequest(req, 'PUT', `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}`, {
        body: { name, description },
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/prompts/:id', requireGenesysAuth, async (req, res) => {
    try {
      await gcRequest(req, 'DELETE', `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}`);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- Prompt language resources (TTS text per language) ----

  router.get('/prompts/:id/resources/:language', requireGenesysAuth, async (req, res) => {
    try {
      const data = await gcRequest(
        req,
        'GET',
        `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}/resources/${encodeURIComponent(req.params.language)}`
      );
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/prompts/:id/resources', requireGenesysAuth, async (req, res) => {
    try {
      const { language, ttsString } = req.body || {};
      if (!language) return res.status(400).json({ error: 'language is required' });
      const data = await gcRequest(req, 'POST', `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}/resources`, {
        body: { language, ttsString },
      });
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.put('/prompts/:id/resources/:language', requireGenesysAuth, async (req, res) => {
    try {
      const { ttsString } = req.body || {};
      const data = await gcRequest(
        req,
        'PUT',
        `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}/resources/${encodeURIComponent(req.params.language)}`,
        { body: { language: req.params.language, ttsString } }
      );
      res.json(data);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/prompts/:id/resources/:language', requireGenesysAuth, async (req, res) => {
    try {
      await gcRequest(
        req,
        'DELETE',
        `/api/v2/architect/prompts/${encodeURIComponent(req.params.id)}/resources/${encodeURIComponent(req.params.language)}`
      );
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  // Fetches the actual audio bytes for one prompt/language — the same file Genesys Cloud's own
  // "download" action on a prompt resource gives you, not a re-implementation of it. The
  // resource's `mediaUri` is fetched fresh each time (proxied through here rather than exposed
  // to the browser directly) since `gcRequest` only ever returns parsed JSON and can't relay
  // binary audio, and `mediaUri` itself may be a short-lived signed URL. Shared by the
  // single-file route and the zip route below so the mediaUri-resolution logic lives in one place.
  async function fetchPromptAudioBuffer(req, promptId, language) {
    const resource = await gcRequest(
      req,
      'GET',
      `/api/v2/architect/prompts/${encodeURIComponent(promptId)}/resources/${encodeURIComponent(language)}`
    );
    const mediaUri = resource && resource.mediaUri;
    if (!mediaUri) {
      const err = new Error('No audio file is available for this language yet (it may be text-only TTS with nothing rendered, or still processing).');
      err.status = 404;
      throw err;
    }

    const auth = await getValidToken(req);
    const regionInfo = REGIONS[auth.region];
    const resolvedUrl = /^https?:\/\//i.test(mediaUri) ? mediaUri : `https://${regionInfo.apiHost}${mediaUri}`;
    const audioResp = await fetch(resolvedUrl, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
    if (!audioResp.ok) {
      const err = new Error(`Could not download audio (HTTP ${audioResp.status})`);
      err.status = audioResp.status;
      throw err;
    }

    return { buffer: Buffer.from(await audioResp.arrayBuffer()), contentType: audioResp.headers.get('content-type') || 'audio/wav' };
  }

  router.get('/prompts/:id/resources/:language/audio', requireGenesysAuth, async (req, res) => {
    try {
      const { buffer, contentType } = await fetchPromptAudioBuffer(req, req.params.id, req.params.language);
      res.set('Content-Type', contentType);
      res.set('Content-Disposition', 'attachment');
      res.send(buffer);
    } catch (err) {
      sendError(res, err);
    }
  });

  // Bundles several prompt/language audio files into a single .zip so selecting many prompts
  // downloads one archive instead of triggering a separate browser download per file. Each
  // requested file is fetched independently; one missing/failed file doesn't abort the others —
  // it's just left out, and the summary of what made it in/failed comes back in a trailing
  // header the client reads before the streamed zip body.
  router.post('/prompts/audio-zip', requireGenesysAuth, async (req, res) => {
    const { items, zipFilename } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'items (array of { promptId, promptName, language }) is required' });
    }

    const results = [];
    const fetched = [];
    const usedNames = new Set(); // guards against two prompts sanitizing to the same zip entry name
    for (const item of items) {
      const { promptId, promptName, language } = item || {};
      if (!promptId || !language) continue;
      try {
        const { buffer } = await fetchPromptAudioBuffer(req, promptId, language);
        let name = `${(promptName || promptId).replace(/[^a-z0-9-]+/gi, '_')}_${language}.wav`;
        let n = 2;
        while (usedNames.has(name)) {
          name = `${(promptName || promptId).replace(/[^a-z0-9-]+/gi, '_')}_${language}_${n}.wav`;
          n += 1;
        }
        usedNames.add(name);
        fetched.push({ buffer, name });
        results.push({ label: `${promptName || promptId} (${language})`, ok: true });
      } catch (err) {
        results.push({ label: `${promptName || promptId} (${language})`, ok: false, message: err.message });
      }
    }

    if (!fetched.length) {
      return res.status(404).json({ error: 'No audio could be downloaded for any of the requested prompts/languages.', results });
    }

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${(zipFilename || 'prompts-audio').replace(/[^a-z0-9-]+/gi, '_')}.zip"`);
    // Results travel as a response header (base64 JSON, since header values can't contain raw
    // newlines/unicode safely) rather than in the body, which is the zip binary itself.
    res.set('X-Export-Results', Buffer.from(JSON.stringify(results)).toString('base64'));
    res.set('Access-Control-Expose-Headers', 'X-Export-Results');

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      // Headers are already sent by the time archiver can fail mid-stream; end the response
      // rather than trying to send a JSON error onto a response that's already committed to zip.
      console.error('[architect] zip stream error:', err);
      res.end();
    });
    archive.pipe(res);
    fetched.forEach((f) => archive.append(f.buffer, { name: f.name }));
    archive.finalize();
  });

  // ---- AI provider API key settings (session-scoped only, never written to disk) ----

  router.get('/providers', (req, res) => {
    res.json(Object.entries(PROVIDERS).map(([id, def]) => ({ id, label: def.label, defaultModel: def.defaultModel })));
  });

  router.get('/settings/api-key', (req, res) => {
    if (req.session && req.session.architectApiKey && req.session.architectProvider) {
      return res.json({
        configured: true,
        source: 'session',
        provider: req.session.architectProvider,
        model: req.session.architectModel || null,
      });
    }
    for (const [id, def] of Object.entries(PROVIDERS)) {
      if (process.env[def.envVar]) {
        return res.json({ configured: true, source: 'env', provider: id, model: null });
      }
    }
    res.json({ configured: false, source: 'none', provider: null, model: null });
  });

  router.post('/settings/api-key', async (req, res) => {
    try {
      const { apiKey, provider, model } = req.body || {};
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return res.status(400).json({ error: 'apiKey is required' });
      }
      if (!PROVIDERS[provider]) {
        return res.status(400).json({ error: `Unknown provider: ${provider}. Choose one of: ${Object.keys(PROVIDERS).join(', ')}` });
      }
      req.session.architectApiKey = apiKey.trim();
      req.session.architectProvider = provider;
      req.session.architectModel = model && String(model).trim() ? String(model).trim() : undefined;
      await saveSession(req);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete('/settings/api-key', async (req, res) => {
    try {
      delete req.session.architectApiKey;
      delete req.session.architectProvider;
      delete req.session.architectModel;
      await saveSession(req);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/settings/api-key/test', async (req, res) => {
    try {
      const resolved = resolveProviderConfig(req);
      if (!resolved) return res.status(400).json({ error: 'No API key configured yet.' });
      await testProviderKey(resolved.provider, resolved.apiKey, resolved.model);
      res.json({ ok: true });
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      res.status(status).json({ error: (err && err.message) || 'Key test failed' });
    }
  });

  // ---- Flow types (for the frontend's type picker) ----

  router.get('/flow-types', (req, res) => {
    res.json(Object.entries(FLOW_TYPES).map(([id, def]) => ({ id, label: def.label })));
  });

  // ---- Generate: AI extracts structured params from a free-text prompt ----

  router.post('/generate', requireGenesysAuth, async (req, res) => {
    try {
      const { flowType, prompt } = req.body || {};
      const schemaDef = GENERATION_SCHEMAS[flowType];
      if (!schemaDef) return res.status(400).json({ error: `Unknown flowType: ${flowType}` });
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
      }

      const resolved = resolveProviderConfig(req);
      if (!resolved) {
        return res.status(400).json({ error: 'No AI API key configured. Add one under Architect settings first.' });
      }

      const params = await extractParams({
        provider: resolved.provider,
        apiKey: resolved.apiKey,
        model: resolved.model,
        systemPrompt: schemaDef.systemPrompt,
        schema: schemaDef.schema,
        userPrompt: prompt,
      });

      res.json({ flowType, params });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- Generate an evaluation form's question groups from free-text criteria ----

  router.post('/generate-eval-form', requireGenesysAuth, async (req, res) => {
    try {
      const { criteria } = req.body || {};
      if (!criteria || typeof criteria !== 'string' || !criteria.trim()) {
        return res.status(400).json({ error: 'criteria is required' });
      }

      const resolved = resolveProviderConfig(req);
      if (!resolved) {
        return res.status(400).json({ error: 'No AI API key configured. Add one under Architect settings first.' });
      }

      const form = await extractParams({
        provider: resolved.provider,
        apiKey: resolved.apiKey,
        model: resolved.model,
        systemPrompt: EVAL_FORM_GENERATION_SCHEMA.systemPrompt,
        schema: EVAL_FORM_GENERATION_SCHEMA.schema,
        userPrompt: criteria,
      });

      res.json({ form });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- Deploy: build the reviewed params into a real, published flow ----

  router.post('/deploy', requireGenesysAuth, async (req, res) => {
    try {
      const { flowType, params } = req.body || {};
      const flowTypeDef = FLOW_TYPES[flowType];
      if (!flowTypeDef) return res.status(400).json({ error: `Unknown flowType: ${flowType}` });
      if (!params || !params.name) return res.status(400).json({ error: 'params.name is required' });

      let sdkModule;
      try {
        // Lazy-required: the Architect Scripting SDK needs Node >= 20 to even load. Isolating
        // the require() here means the rest of the app keeps working if this fails to load.
        sdkModule = require('purecloud-flow-scripting-api-sdk-javascript');
      } catch (loadErr) {
        return res.status(501).json({
          error:
            'The Architect Scripting SDK could not be loaded in this runtime (it requires Node.js 20+). ' +
            'Flow generation only works where the app is running on Node 20, e.g. the deployed Vercel instance.',
        });
      }

      const auth = await getValidToken(req);
      // The SDK's orgLocation is a fixed enum (ArchEnums.LOCATIONS), not a URL — it's our
      // region id with dashes swapped for underscores and a "prod_" prefix, e.g.
      // "eu-central-1" -> "prod_eu_central_1". Every region in regions.js maps this way.
      const orgLocation = `prod_${auth.region.replace(/-/g, '_')}`;

      // The module you require() *is* the "scripting" object (ArchitectScripting) — there is no
      // separate ArchSession export to reach for. The session controller lives at
      // scripting.environment.archSession, and startWithAuthToken is an instance method on it.
      const archSession = sdkModule.environment.archSession;

      // The SDK is designed to run as a one-shot CLI script and defaults endTerminatesProcess to
      // true, meaning it calls process.exit() once the session ends — which would kill this whole
      // server process after every flow deploy. Must disable that before starting the session.
      archSession.endTerminatesProcess = false;

      let flowResult;
      let buildError;

      // callbackFunctionStart takes no error parameter — failures surface as a thrown/rejected
      // value, which we capture here rather than let escape, since it's not documented whether a
      // rejected callback promise reliably propagates through the SDK's own session-end handling.
      // Returning the promise (async function) makes the session wait for our work to finish
      // before it auto-ends via endMode ('end' by default).
      await archSession.startWithAuthToken(
        orgLocation,
        async () => {
          try {
            flowResult = await flowTypeDef.builder(sdkModule, params);
          } catch (err) {
            buildError = err;
          }
        },
        auth.accessToken,
        undefined,
        true,
      );

      if (buildError) throw buildError;

      res.json({ ok: true, flow: { id: flowResult && flowResult.id, name: flowResult && flowResult.name } });
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
};
