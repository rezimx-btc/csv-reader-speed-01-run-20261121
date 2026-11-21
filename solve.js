// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answers as csv-reader 1.0.0 for every input, faster: the reference builds
// every field one character at a time (string indexing + `value += c` per char).
// This reader instead takes each unquoted field as one slice bounded by native
// indexOf scans for ',' and '\n', and each quoted field as slices between its
// special characters; per-character work happens only inside quoted fields and
// around stray CRs, which are rare. Line/error bookkeeping follows the spec
// exactly (see README.md for the semantics).
//
// Measured on the kit practice set (6 cases, ~10.2 MB of CSV): pure parse
// ~80 ms median vs ~400-690 ms for the reference reader (~5x), end-to-end
// ~0.7 s vs ~1.4-2.4 s for the house baseline main.ts (~2x, the rest being
// JSON parse/stringify and Node startup, which every entry pays).

/** csv-reader 1.0.0's answer for one case's input: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  let pos = 0;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1; // drop a leading BOM
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let line = 1;
  // Index of the next CR at or after pos, Infinity when none is left, -1 when
  // unknown (recompute lazily). One native scan per CR, never one per field.
  let nextCR = -1;

  while (true) {
    // Lines left with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= n) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = 0; // 0 = comma, 1 = line break, 2 = end of text
    let lastQuoted = false;

    for (;;) {
      let init = null; // initial value for the unquoted re-read (junk / unterminated)
      let junk = false;
      if (text.charCodeAt(pos) === 34) {
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        let segStart = pos + 1;
        let i = pos + 1;
        let parts = null; // accumulated segments once a "" or a CR/LF conversion occurs
        let closedAt = -1;
        while (i < n) {
          const c = text.charCodeAt(i);
          if (c === 34) {
            if (text.charCodeAt(i + 1) === 34) {
              if (parts === null) parts = [text.slice(segStart, i)];
              else parts.push(text.slice(segStart, i));
              parts.push('"');
              i += 2; segStart = i; continue;
            }
            closedAt = i; break;
          }
          if (c === 13) {
            // CRLF and a lone CR inside quotes are each one LF.
            if (parts === null) parts = [text.slice(segStart, i)];
            else parts.push(text.slice(segStart, i));
            parts.push('\n');
            line++;
            i += text.charCodeAt(i + 1) === 10 ? 2 : 1;
            segStart = i; continue;
          }
          if (c === 10) line++;
          i++;
        }
        if (closedAt === -1) {
          // The quote never closes: it is a literal character, and the text
          // after it is read again as unquoted.
          pos = open + 1; line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          init = '"';
        } else {
          let value;
          if (parts === null) value = text.slice(segStart, closedAt);
          else { parts.push(text.slice(segStart, closedAt)); value = parts.join(''); }
          pos = closedAt + 1;
          if (pos >= n) { fields.push(value); ended = 2; break; }
          const c = text.charCodeAt(pos);
          if (c === 44) { fields.push(value); pos++; ended = 0; continue; }
          if (c === 10) { fields.push(value); pos++; line++; ended = 1; break; }
          if (c === 13 && text.charCodeAt(pos + 1) === 10) { fields.push(value); pos += 2; line++; ended = 1; break; }
          // What follows the closing quote is appended as it stands.
          init = value; junk = true;
        }
      } else {
        lastQuoted = false;
      }

      // Unquoted field, starting from `init` (null means empty).
      let acc = init;
      let added = 0; // characters kept from the text, not counting `init`
      let segStart = pos;
      for (;;) {
        const c0 = text.charCodeAt(pos);
        if (c0 === 44) {
          fields.push(acc === null ? text.slice(segStart, pos) : acc + text.slice(segStart, pos));
          added += pos - segStart;
          pos++; ended = 0; break;
        }
        if (c0 === 10) {
          fields.push(acc === null ? text.slice(segStart, pos) : acc + text.slice(segStart, pos));
          added += pos - segStart;
          pos++; line++; ended = 1; break;
        }
        if (c0 === 13) {
          if (text.charCodeAt(pos + 1) === 10) {
            fields.push(acc === null ? text.slice(segStart, pos) : acc + text.slice(segStart, pos));
            added += pos - segStart;
            pos += 2; line++; ended = 1; break;
          }
          // A CR not followed by LF is dropped (stray_cr); the field goes on.
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          if (acc === null) acc = text.slice(segStart, pos); else acc += text.slice(segStart, pos);
          added += pos - segStart;
          pos++; segStart = pos;
          continue;
        }
        if (nextCR < pos) { nextCR = text.indexOf('\r', pos); if (nextCR === -1) nextCR = Infinity; }
        const ci = text.indexOf(',', pos);
        const li = text.indexOf('\n', pos);
        let m = -1; let isComma = false;
        if (ci === -1) { if (li !== -1) m = li; }
        else if (li === -1) { m = ci; isComma = true; }
        else if (ci < li) { m = ci; isComma = true; }
        else m = li;
        if (m === -1) {
          if (nextCR !== Infinity) {
            // Stray CR(s) in the rest of the text: consume up to the first.
            if (acc === null) acc = text.slice(segStart, nextCR); else acc += text.slice(segStart, nextCR);
            added += nextCR - segStart;
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            pos = nextCR + 1; segStart = pos; nextCR = -1;
            continue;
          }
          fields.push(acc === null ? text.slice(segStart, n) : acc + text.slice(segStart, n));
          added += n - segStart;
          pos = n; ended = 2; break;
        }
        if (nextCR < m) {
          if (m === li && nextCR === m - 1) {
            // CRLF ends the field.
            fields.push(acc === null ? text.slice(segStart, nextCR) : acc + text.slice(segStart, nextCR));
            added += nextCR - segStart;
            pos = li + 1; line++; ended = 1; break;
          }
          // Stray CR before the terminator: drop it, keep the field going.
          if (acc === null) acc = text.slice(segStart, nextCR); else acc += text.slice(segStart, nextCR);
          added += nextCR - segStart;
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          pos = nextCR + 1; segStart = pos; nextCR = -1;
          continue;
        }
        fields.push(acc === null ? text.slice(segStart, m) : acc + text.slice(segStart, m));
        added += m - segStart;
        if (isComma) { pos = m + 1; ended = 0; }
        else { pos = m + 1; line++; ended = 1; }
        break;
      }
      if (junk && added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      if (ended !== 0) break;
    }

    // A line that held only stray CRs is left with no characters: no record.
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
