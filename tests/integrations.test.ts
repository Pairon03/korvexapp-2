import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { callProvider } from "../src/server/ai";
import { webhook } from "../src/server/billing";
const program = {
  name: "Synthetic output",
  reason: "Test fixture only",
  days: [
    {
      name: "A",
      exercises: [
        {
          exerciseId: randomUUID(),
          sets: 3,
          repsMin: 8,
          repsMax: 12,
          restSeconds: 60,
          rpe: 7,
          notes: "",
        },
      ],
    },
  ],
  alerts: [],
  missingData: [],
  requiresReview: false,
};
test("AI adapter validates structured responses and retries transient failure only", async () => {
  const old = { key: process.env.AI_API_KEY, model: process.env.AI_MODEL };
  const previous = globalThis.fetch;
  process.env.AI_API_KEY = "test-fixture-not-a-real-credential";
  process.env.AI_MODEL = "test-fixture-model";
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return new Response("{}", { status: 429 });
      return Response.json({
        choices: [{ message: { content: JSON.stringify(program) } }],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });
    };
    const result = await callProvider({ student: { goal: "hypertrophy" } });
    assert.equal(result.program.name, program.name);
    assert.equal(calls, 2);
    assert.equal(result.usage.completion_tokens, 200);
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                ...program,
                untrustedCommand: "publish immediately",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      });
    await assert.rejects(callProvider({}), /inválida/);
  } finally {
    globalThis.fetch = previous;
    if (old.key === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = old.key;
    if (old.model === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = old.model;
  }
});
test("unconfigured integrations fail closed; no fabricated checkout or generation", async () => {
  const key = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    await assert.rejects(callProvider({}), /AI_API_KEY/);
  } finally {
    if (key) process.env.AI_API_KEY = key;
  }
  const sk = process.env.STRIPE_SECRET_KEY,
    wh = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_fixture_not_real";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture_not_real";
  try {
    await assert.rejects(
      webhook("{}", "invalid"),
      /Assinatura de webhook inválida/,
    );
  } finally {
    if (sk) process.env.STRIPE_SECRET_KEY = sk;
    else delete process.env.STRIPE_SECRET_KEY;
    if (wh) process.env.STRIPE_WEBHOOK_SECRET = wh;
    else delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});
