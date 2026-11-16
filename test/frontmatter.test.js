import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, setDisabled, splitFrontmatter, withName } from '../lib/frontmatter.js';

const SAMPLE = `---
name: demo
description: >-
  A demo expert.
  Second line.
displayName:
  zh: 演示
  en: Demo
---

# Body

Keep me.
`;

test('parseFrontmatter reads scalars, folded blocks, and nested displayName', () => {
  const { fm } = splitFrontmatter(SAMPLE);
  const meta = parseFrontmatter(fm);
  assert.equal(meta.name, 'demo');
  assert.equal(meta.description, 'A demo expert. Second line.');
  assert.deepEqual(meta.displayName, { zh: '演示', en: 'Demo' });
});

test('setDisabled adds and removes the flag while preserving the body', () => {
  const disabled = setDisabled(SAMPLE, true);
  assert.match(disabled, /^---\n(?:disable-model-invocation: true\n)?name: demo/m);
  assert.match(disabled, /disable-model-invocation: true/);
  assert.match(disabled, /# Body\n\nKeep me\./);

  const enabled = setDisabled(disabled, false);
  assert.doesNotMatch(enabled, /disable-model-invocation/);
  assert.match(enabled, /# Body\n\nKeep me\./);
});

test('setDisabled is idempotent', () => {
  const once = setDisabled(SAMPLE, true);
  const twice = setDisabled(once, true);
  assert.equal((twice.match(/disable-model-invocation/g) || []).length, 1);
});

test('setDisabled preserves CRLF', () => {
  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  const out = setDisabled(crlf, true);
  assert.match(out, /\r\n/);
  assert.doesNotMatch(out.replace(/\r\n/g, ''), /\n/);
});

test('withName replaces the frontmatter name', () => {
  const out = withName(SAMPLE, 'renamed');
  assert.match(out, /^---\nname: renamed/m);
  assert.match(out, /# Body/);
});
