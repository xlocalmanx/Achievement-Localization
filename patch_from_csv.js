const fs = require('fs');

// ============================================================
// CSV Parser
// ============================================================
function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { fields.push(cur); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur);
    if (fields.length >= 2) {
      const ord = parseInt(fields[0], 10);
      if (!isNaN(ord)) rows.push({ ordinal: ord, displayNameCN: fields[1] || '', descriptionCN: fields[2] || '' });
    }
  }
  return rows;
}

// ============================================================
// Binary helpers (from 111/patch_bin.js)
// ============================================================
function findPattern(u8, start, pattern) {
  for (let i = start; i <= u8.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) { if (u8[i + j] !== pattern[j]) { match = false; break; } }
    if (match) return i;
  }
  return -1;
}

function skipToNull(u8, pos) {
  while (pos < u8.length && u8[pos] !== 0) pos++;
  return pos;
}

// ============================================================
// Find insertion points in original binary
// ============================================================
function findInsertionPoints(u8) {
  const points = [];
  let pos = 0;
  while (pos < u8.length) {
    const idx = findPattern(u8, pos, [0x6E, 0x61, 0x6D, 0x65, 0x00]);
    if (idx === -1) return points;
    if (u8[idx + 5] >= 0x30 && u8[idx + 5] <= 0x39) { pos = idx; break; }
    pos = idx + 1;
  }

  let consecutiveFails = 0;
  while (pos < u8.length && consecutiveFails < 3) {
    // Skip structural bytes
    while (pos < u8.length) {
      if (u8[pos] === 0x08) { pos++; continue; }
      if (u8[pos] === 0x00) { pos++; continue; }
      if (u8[pos] >= 0x30 && u8[pos] <= 0x39) {
        while (pos < u8.length && u8[pos] >= 0x30 && u8[pos] <= 0x39) pos++;
        if (u8[pos] === 0x00) pos++;
        if (u8[pos] === 0x01) pos++;
        continue;
      }
      break;
    }
    if (pos >= u8.length) break;

    if (!(u8[pos] === 0x6E && u8[pos + 1] === 0x61 && u8[pos + 2] === 0x6D && u8[pos + 3] === 0x65 && u8[pos + 4] === 0x00)) {
      consecutiveFails++; pos++; continue;
    }
    consecutiveFails = 0;
    pos += 5;

    let ord = '';
    while (pos < u8.length && u8[pos] >= 0x30 && u8[pos] <= 0x39) {
      ord += String.fromCharCode(u8[pos]); pos++;
    }
    const ordinal = parseInt(ord, 10);
    if (u8[pos] === 0x00) pos++;
    if (u8[pos] === 0x00) pos++;

    let displayTokenEnd = -1;
    let descTokenEnd = -1;

    // === Display section ===
    if (u8[pos] === 0x64) {
      pos += 7; // "display\x00"
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x6E) pos += 4; // "name\x00"
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x01) pos++;
      pos = skipToNull(u8, pos) + 1; // skip english keyword
    }
    // pos now at display name value
    pos = skipToNull(u8, pos) + 1; // skip displayName value
    if (u8[pos] === 0x01) pos++;

    if (u8[pos] === 0x74) {
      pos += 5; // "token\x00"
      if (u8[pos] === 0x00) pos++;
      pos = skipToNull(u8, pos) + 1; // skip token value
      displayTokenEnd = pos;
    }

    // Skip existing schinese if present
    if (u8[pos] === 0x01 && u8[pos + 1] === 0x73) {
      pos += 10;
      pos = skipToNull(u8, pos) + 1;
    }

    // === Structural separator ===
    if (u8[pos] === 0x08) pos++;
    if (u8[pos] === 0x00) pos++;

    // === Desc section ===
    if (u8[pos] === 0x64 && u8[pos + 1] === 0x65 && u8[pos + 2] === 0x73 && u8[pos + 3] === 0x63) {
      pos += 4;
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x01) pos++;

      if (u8[pos] === 0x65) {
        pos = skipToNull(u8, pos) + 1;
        pos = skipToNull(u8, pos) + 1;
        if (u8[pos] === 0x01) pos++;
      }

      if (u8[pos] === 0x74) {
        pos += 5;
        if (u8[pos] === 0x00) pos++;
        pos = skipToNull(u8, pos) + 1;
        descTokenEnd = pos;
      }

      // Skip existing schinese if present
      if (u8[pos] === 0x01 && u8[pos + 1] === 0x73) {
        pos += 10;
        pos = skipToNull(u8, pos) + 1;
      }
    }

    points.push({ ordinal, displayTokenEnd, descTokenEnd });

    // Advance to next record
    let found = false;
    let sp = pos;
    while (sp < u8.length - 6) {
      if (u8[sp] === 0x08) { sp++; continue; }
      if (u8[sp] === 0x00) { sp++; continue; }
      if (u8[sp] === 0x74) {
        let typeMatch = true;
        const typeStr = 'type\x00ACHIEVEMENTS';
        for (let k = 0; k < typeStr.length && sp + k < u8.length; k++) {
          if (u8[sp + k] !== typeStr.charCodeAt(k)) { typeMatch = false; break; }
        }
        if (typeMatch) {
          sp += 5; sp = skipToNull(u8, sp) + 1;
          if (u8[sp] === 0x02) sp++;
          sp += 8;
          if (u8[sp] === 0x00) sp++;
          sp += 4;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x08) sp++;
          if (u8[sp] === 0x00) sp++;
          while (sp < u8.length && u8[sp] >= 0x30 && u8[sp] <= 0x39) sp++;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x62) sp += 4;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x30) sp++;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x00) sp++;
          if (u8[sp] === 0x01) sp++;
          continue;
        }
      }
      if (u8[sp] === 0x6E && u8[sp + 1] === 0x61 && u8[sp + 2] === 0x6D && u8[sp + 3] === 0x65 && u8[sp + 4] === 0x00) {
        if (u8[sp + 5] >= 0x30 && u8[sp + 5] <= 0x39) { found = true; break; }
      }
      sp++;
    }
    if (!found) break;
    pos = sp;
  }

  return points;
}

// ============================================================
// Patch: insert schinese bytes into original binary
// ============================================================
function patchOriginal(origBuf, cnFieldsByOrdinal) {
  const u8 = new Uint8Array(origBuf);
  const enc = new TextEncoder();

  console.log('  扫描原始文件插入点...');
  const points = findInsertionPoints(u8);
  console.log('  找到 ' + points.length + ' 条记录');

  const insertions = [];
  let matched = 0;

  for (const pt of points) {
    const cn = cnFieldsByOrdinal[pt.ordinal];
    if (!cn) continue;

    if (cn.displayNameCN && pt.displayTokenEnd >= 0) {
      insertions.push({
        offset: pt.displayTokenEnd,
        bytes: enc.encode('\x01schinese\x00' + cn.displayNameCN + '\x00')
      });
    }
    if (cn.descriptionCN && pt.descTokenEnd >= 0) {
      insertions.push({
        offset: pt.descTokenEnd,
        bytes: enc.encode('\x01schinese\x00' + cn.descriptionCN + '\x00')
      });
    }
    matched++;
  }

  console.log('  匹配: ' + matched + ' 条, 插入点: ' + insertions.length);

  insertions.sort((a, b) => b.offset - a.offset);

  let result = u8;
  for (const ins of insertions) {
    const before = result.slice(0, ins.offset);
    const after = result.slice(ins.offset);
    result = new Uint8Array(before.length + ins.bytes.length + after.length);
    result.set(before, 0);
    result.set(ins.bytes, before.length);
    result.set(after, before.length + ins.bytes.length);
  }

  return result;
}

// ============================================================
// Main
// ============================================================
const csvPath = process.argv[2] || 'achievements.csv';
const origPath = process.argv[3] || '原始UserGameStatsSchema_250900.bin';
const outPath = process.argv[4] || 'UserGameStatsSchema_250900.bin';

console.log('读取CSV: ' + csvPath);
const csvText = fs.readFileSync(csvPath, 'utf-8');
const rows = parseCSV(csvText);
console.log('  解析: ' + rows.length + ' 行');

const cnMap = {};
for (const row of rows) {
  cnMap[row.ordinal] = { displayNameCN: row.displayNameCN, descriptionCN: row.descriptionCN };
}

console.log('\n读取原始文件: ' + origPath);
const origBuf = fs.readFileSync(origPath);
console.log('  大小: ' + origBuf.length + ' 字节');

console.log('\n修补原始文件...');
const patched = patchOriginal(origBuf, cnMap);
console.log('  大小: ' + origBuf.length + ' → ' + patched.length + ' (+' + (patched.length - origBuf.length) + ')');

// Load parser from edit_bin.js for verification
console.log('\n验证修补后文件...');
try {
  const editCode = fs.readFileSync('111/edit_bin.js', 'utf-8');
  const wrapEdit = editCode + '\nmodule.exports = { parseAchievements: typeof parseAchievements !== "undefined" ? parseAchievements : undefined };';
  const getParse = new Function('require', 'module', wrapEdit);
  const parseMod = { exports: {} };
  getParse(require, parseMod);
  const parseAch = parseMod.exports.parseAchievements;

  if (parseAch) {
    const patchedA = parseAch(Buffer.from(patched));
    const withCN = patchedA.filter(a => a.displayNameCN || a.descriptionCN).length;
    const withNameCN = patchedA.filter(a => a.displayNameCN).length;
    const withDescCN = patchedA.filter(a => a.descriptionCN).length;
    const hidden = patchedA.filter(a => a.hidden).length;
    const withIcon = patchedA.filter(a => a.icon).length;
    console.log('  成就数: ' + patchedA.length);
    console.log('  有中文名: ' + withNameCN);
    console.log('  有中文描述: ' + withDescCN);
    console.log('  隐藏数: ' + hidden);
    console.log('  有图标: ' + withIcon);

    // Show first 5
    console.log('\n前 5 条:');
    for (let i = 0; i < 5; i++) {
      const a = patchedA[i];
      console.log('  #' + a.ordinal + ' ' + (a.displayName || '').substring(0, 25) + ' → ' + (a.displayNameCN || ''));
      console.log('    隐藏: ' + a.hidden + ' 图标: ' + (a.icon ? 'Y' : 'N'));
    }
  }
} catch(e) {
  console.log('  验证跳过: ' + e.message);
}

fs.writeFileSync(outPath, Buffer.from(patched));
console.log('\n已保存: ' + outPath);
