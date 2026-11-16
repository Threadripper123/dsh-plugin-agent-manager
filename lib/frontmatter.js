const FM_RE = /^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n?)/;

export function splitFrontmatter(text) {
  const source = String(text ?? '');
  const m = FM_RE.exec(source);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  if (!m) {
    return { has: false, head: '', fm: '', close: '', rest: '', body: source, eol, raw: '' };
  }
  return {
    has: true,
    head: m[1],
    fm: m[2],
    close: m[3],
    rest: m[4],
    body: source.slice(m[0].length),
    eol: m[1].includes('\r\n') ? '\r\n' : '\n',
    raw: m[0]
  };
}

function unquote(value) {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Minimal YAML reader for top-level scalar keys; understands `>` / `|` blocks. */
export function parseFrontmatter(fm) {
  const out = {};
  const lines = String(fm ?? '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i += 1;
      continue;
    }
    const m = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1];
    const value = m[2];
    if (value === '>' || value === '>-' || value === '|' || value === '|-') {
      const block = [];
      i += 1;
      while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t') || !lines[i].trim())) {
        block.push(lines[i].trim());
        i += 1;
      }
      out[key] = block.join(value.startsWith('|') ? '\n' : ' ').trim();
      continue;
    }
    if (!value.trim()) {
      const nested = {};
      let j = i + 1;
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        const child = /^\s+([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(lines[j]);
        if (child) nested[child[1]] = unquote(child[2]);
        j += 1;
      }
      if (Object.keys(nested).length) {
        out[key] = nested;
        i = j;
        continue;
      }
      out[key] = '';
      i += 1;
      continue;
    }
    out[key] = unquote(value);
    i += 1;
  }
  return out;
}

export function isDisabled(fm) {
  return /^disable-model-invocation:[ \t]*true[ \t]*$/im.test(String(fm ?? ''));
}

export function setDisabled(text, disabled) {
  const parts = splitFrontmatter(text);
  if (!parts.has) {
    if (!disabled) return String(text ?? '');
    return `---${parts.eol}disable-model-invocation: true${parts.eol}---${parts.eol}${text ?? ''}`;
  }
  const lines = parts.fm.split(/\r?\n/).filter((line) => !/^disable-model-invocation[ \t]*:/.test(line));
  if (disabled) lines.unshift('disable-model-invocation: true');
  const nextFm = lines.join(parts.eol);
  const rebuilt = nextFm
    ? `${parts.head}${nextFm}${parts.close}${parts.rest}${parts.body}`
    : `---${parts.eol}---${parts.rest}${parts.body}`;
  return rebuilt;
}

export function withName(text, name) {
  const parts = splitFrontmatter(text);
  if (!parts.has) {
    return `---${parts.eol}name: ${name}${parts.eol}---${parts.eol}${text ?? ''}`;
  }
  const lines = parts.fm.split(/\r?\n/);
  let replaced = false;
  const out = lines.map((line) => {
    if (/^name[ \t]*:/.test(line)) {
      replaced = true;
      return `name: ${name}`;
    }
    return line;
  });
  if (!replaced) out.unshift(`name: ${name}`);
  return `${parts.head}${out.join(parts.eol)}${parts.close}${parts.rest}${parts.body}`;
}

export function stripFrontmatter(text) {
  const parts = splitFrontmatter(text);
  return parts.has ? parts.body : String(text ?? '');
}
