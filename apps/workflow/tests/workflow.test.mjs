import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// TypeScript source is loaded through a temporary transpile hook in the test script.
const require = createRequire(import.meta.url);
require.extensions[".ts"] = (module, filename) => {
  const fs = require("node:fs");
  const ts = require("typescript");
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
};
const { validateWorkflow, nextNode, exampleWorkflow, migrateStarterWorkflow } = require("../src/lib/workflow.ts");
const { parseDecision, decide } = require("../src/lib/decision.ts");

test("YES and NO select the matching path and a missing branch ends", () => {
  const graph = validateWorkflow(exampleWorkflow);
  assert.equal(nextNode(graph, "repro-details", "YES"), "impact-check");
  assert.equal(nextNode(graph, "repro-details", "NO"), "investigation-details");
  assert.equal(nextNode(graph, "impact-check", "YES"), null);
});
test("invalid graph rejects duplicate outputs and cycles", () => {
  assert.throws(() => validateWorkflow({ ...exampleWorkflow, edges: [...exampleWorkflow.edges, { id: "dup", source: "repro-details", target: "investigation-details", branch: "YES" }] }), /already has a connection/);
  assert.throws(() => validateWorkflow({ ...exampleWorkflow, edges: [...exampleWorkflow.edges, { id: "cycle", source: "impact-check", target: "repro-details", branch: "YES" }] }), /cycles/);
});
test("old starter migrates while a customized workflow stays intact", () => {
  const oldStarter = validateWorkflow({
    version: 1,
    startNodeId: "support-check",
    nodes: [
      { id: "support-check", label: "Route request", prompt: "Is this a support request?", position: { x: 90, y: 190 } },
      { id: "support-priority", label: "Support priority", prompt: "Does this request need urgent support?", position: { x: 440, y: 50 } },
      { id: "sales-qualify", label: "Sales inquiry", prompt: "Is this person asking about pricing or a purchase?", position: { x: 440, y: 340 } },
    ],
    edges: [
      { id: "support-yes", source: "support-check", target: "support-priority", branch: "YES" },
      { id: "support-no", source: "support-check", target: "sales-qualify", branch: "NO" },
    ],
  });
  assert.equal(migrateStarterWorkflow(oldStarter), exampleWorkflow);
  const custom = { ...oldStarter, nodes: oldStarter.nodes.map((node) => node.id === "support-check" ? { ...node, prompt: "Is this an urgent request?" } : node) };
  assert.equal(migrateStarterWorkflow(custom), custom);
});
test("model output accepts only exact YES or NO and repairs once", async () => {
  assert.equal(parseDecision("YES\n"), "YES");
  assert.equal(parseDecision("yes"), null);
  let calls = 0;
  assert.equal(await decide("prompt", "case", async () => ++calls === 1 ? "Maybe" : "NO"), "NO");
  assert.equal(calls, 2);
  await assert.rejects(decide("prompt", "case", async () => "Maybe"), /did not return/);
  await assert.rejects(decide("prompt", "case", async () => { throw new Error("provider down"); }), /provider down/);
});
