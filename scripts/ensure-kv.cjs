#!/usr/bin/env node
/**
 * Ensure the template deploys with a stable KV namespace binding.
 *
 * The source wrangler.toml intentionally does not commit account-specific KV IDs.
 * This script resolves or creates the fixed namespace name, then writes a
 * generated deploy-only Wrangler config under .wrangler/deploy/.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_CONFIG = path.join(ROOT, 'wrangler.toml');
const DEPLOY_DIR = path.join(ROOT, '.wrangler', 'deploy');
const DEPLOY_CONFIG = path.join(DEPLOY_DIR, 'wrangler.toml');
const BINDING = 'TOPIC_MAP';
const NAMESPACE_TITLE = 'telegram-private-chatbot';

const wrangler = (args) =>
  execSync(`npx wrangler ${args}`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  });

function shellQuote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function findNamespaceId(title) {
  const list = JSON.parse(wrangler('kv namespace list'));
  const hit = list.find((namespace) => namespace.title === title);
  return hit ? hit.id : null;
}

function createNamespace(title) {
  const out = wrangler(`kv namespace create ${shellQuote(title)}`);
  const id = (out.match(/id\s*=\s*"([0-9a-fA-F]{32})"/) || [])[1];
  if (!id) throw new Error(`[ensure-kv] could not parse namespace id from:\n${out}`);
  return id;
}

function stripKvBinding(toml, binding) {
  const blocks = toml.match(/\[\[kv_namespaces\]\][\s\S]*?(?=\n\[\[|\n\[[^\[]|$)/g) || [];
  let next = toml;

  for (const block of blocks) {
    const bindingPattern = new RegExp(`^\\s*binding\\s*=\\s*"${binding}"\\s*$`, 'm');
    if (bindingPattern.test(block)) {
      next = next.replace(block, '').replace(/\n{3,}/g, '\n\n');
    }
  }

  return next.trimEnd();
}

function rewriteMainForGeneratedConfig(toml) {
  const relativeMain = path.relative(DEPLOY_DIR, path.join(ROOT, 'worker.js')).replace(/\\/g, '/');
  if (/^\s*main\s*=/m.test(toml)) {
    return toml.replace(/^\s*main\s*=.*$/m, `main = "${relativeMain}"`);
  }
  return `${toml}\nmain = "${relativeMain}"`;
}

function writeDeployConfig(namespaceId) {
  const source = fs.readFileSync(SOURCE_CONFIG, 'utf8');
  const base = rewriteMainForGeneratedConfig(stripKvBinding(source, BINDING));
  const kvBlock = [
    '',
    '[[kv_namespaces]]',
    `binding = "${BINDING}"`,
    `id = "${namespaceId}"`,
    ''
  ].join('\n');

  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  fs.writeFileSync(DEPLOY_CONFIG, `${base}${kvBlock}`);
}

function main() {
  let id = findNamespaceId(NAMESPACE_TITLE);
  if (id) {
    console.log(`[ensure-kv] reusing KV namespace "${NAMESPACE_TITLE}" (${id})`);
  } else {
    id = createNamespace(NAMESPACE_TITLE);
    console.log(`[ensure-kv] created KV namespace "${NAMESPACE_TITLE}" (${id})`);
  }

  writeDeployConfig(id);
  console.log(`[ensure-kv] wrote deploy config: ${path.relative(ROOT, DEPLOY_CONFIG)}`);
}

main();
