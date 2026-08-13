import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "tests", "project.config.json"), "utf8"));
const deployment = JSON.parse(fs.readFileSync(path.join(root, "deployment.json"), "utf8"));
const client = createClient({ chain: testnetBradbury, account: createAccount() });
const parse = (value, fallback) => { if (typeof value !== "string") return value ?? fallback; try { return JSON.parse(value); } catch { return fallback; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function read(functionName, args = []) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try { return await client.readContract({ address: deployment.contractAddress, functionName, args }); }
    catch (error) { lastError = error; if (attempt < 4) await sleep(800 * (attempt + 1)); }
  }
  throw lastError;
}

test("Bradbury deployment exposes a validator-reviewed domain record", { timeout: 180_000 }, async () => {
  assert.equal(deployment.network, "testnetBradbury");
  assert.equal(deployment.chainId, 4221);
  assert.match(deployment.contractAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.match(deployment.deployTxHash, /^0x[0-9a-fA-F]{64}$/);
  assert.equal(deployment.contractExplorer, `https://explorer-bradbury.genlayer.com/address/${deployment.contractAddress}`);
  const id = String(deployment.smoke.caseId);
  const record = await read("get_case", [Number(id)]);
  assert.notEqual(String(record.outcome), "pending");
  assert.ok(Number(record.reviewCount) >= 1);
  assert.ok(parse(await read("get_reviews", [id]), []).length >= 1);
  const stats = parse(await read("get_contract_stats"), {});
  assert.ok(Number(stats.cases) >= 1);
  assert.ok(Number(stats.reviews) >= 1);
  assert.equal(String(await read("get_owner")).toLowerCase(), deployment.deployer.toLowerCase());
  assert.ok(Number(await read(config.count)) >= 1);
});
