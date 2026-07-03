const fs = require('fs');

// ============================================================
// Load parser from edit_bin.js
// ============================================================

function loadParser() {
  const code = fs.readFileSync(__dirname + '/edit_bin.js', 'utf-8');
  const exports = {};
  const fakeModule = { exports };
  const wrappedCode = code + '\nmodule.exports = { parseAchievements: typeof parseAchievements !== "undefined" ? parseAchievements : undefined };';
  const fn = new Function('require', 'module', 'exports', wrappedCode);
  fn(require, fakeModule, exports);
  return fakeModule.exports.parseAchievements;
}

// ============================================================
// Binary helpers
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

      // Check if we're at "english\x00" or already at "token\x00"
      if (u8[pos] === 0x65) {
        // Non-empty desc: skip english keyword and value
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

    // Debug first 3 records
    if (points.length <= 3) {
      console.log('    #' + ordinal + ' displayTokenEnd=' + displayTokenEnd + ' descTokenEnd=' + descTokenEnd);
    }

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
          sp += 5;
          sp = skipToNull(u8, sp) + 1;
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

function main() {
  const parseAchievements = loadParser();
  if (!parseAchievements) { console.error('Failed to load parser'); process.exit(1); }

  const origPath = process.argv[2] || '原始UserGameStatsSchema_250900.bin';
  const cnPath = process.argv[3] || '成功UserGameStatsSchema_250900_chinese.bin';
  const outPath = process.argv[4] || 'UserGameStatsSchema_250900.bin';

  console.log('读取中文文件: ' + cnPath);
  const cnBuf = fs.readFileSync(cnPath);
  const cnA = parseAchievements(cnBuf);
  let withCN = 0;
  for (const a of cnA) { if (a.displayNameCN || a.descriptionCN) withCN++; }
  console.log('  解析: ' + cnA.length + ' 条, 有中文: ' + withCN + ' 条');

  const cnMap = {};
  for (const a of cnA) { cnMap[a.ordinal] = a; }

  console.log('\n读取原始文件: ' + origPath);
  const origBuf = fs.readFileSync(origPath);
  const origA = parseAchievements(origBuf);
  console.log('  解析: ' + origA.length + ' 条, 隐藏: ' + origA.filter(a => a.hidden).length + ' 条');

  console.log('\n修补原始文件...');
  const patched = patchOriginal(origBuf, cnMap);
  const sizeDiff = patched.length - origBuf.length;
  console.log('  大小: ' + origBuf.length + ' → ' + patched.length + ' (+' + sizeDiff + ')');

  console.log('\n验证修补后文件...');
  const patchedA = parseAchievements(Buffer.from(patched));
  let patchedWithCN = 0;
  for (const a of patchedA) { if (a.displayNameCN || a.descriptionCN) patchedWithCN++; }
  const patchedHidden = patchedA.filter(a => a.hidden).length;
  const patchedIcons = patchedA.filter(a => a.icon).length;

  console.log('  成就数: ' + patchedA.length + ' (原始: ' + origA.length + ')');
  console.log('  有中文: ' + patchedWithCN + ' (中文文件: ' + withCN + ')');
  console.log('  隐藏数: ' + patchedHidden + ' (原始: ' + origA.filter(a => a.hidden).length + ')');
  console.log('  有图标: ' + patchedIcons + ' (原始: ' + origA.filter(a => a.icon).length + ')');

  console.log('\n前 5 条:');
  for (let i = 0; i < 5; i++) {
    const o = origA[i], p = patchedA[i];
    console.log('  #' + p.ordinal + ' ' + (p.displayName || '').substring(0, 25) + ' → ' + (p.displayNameCN || ''));
    console.log('    隐藏: ' + o.hidden + '→' + p.hidden + ' 图标: ' + (o.icon ? 'Y' : 'N') + '→' + (p.icon ? 'Y' : 'N'));
  }

  // Check for any missing CN fields
  let missing = [];
  for (const a of patchedA) {
    const orig = origA.find(o => o.ordinal === a.ordinal);
    if (!a.displayNameCN) missing.push('#' + a.ordinal + ' ' + a.displayName + ' (无中文名)');
    if (!a.descriptionCN && orig && orig.description) missing.push('#' + a.ordinal + ' ' + a.displayName + ' (无中文描述)');
  }
  if (missing.length > 0) {
    console.log('\n缺失中文:');
    for (const m of missing) console.log('  ' + m);
  }

  fs.writeFileSync(outPath, Buffer.from(patched));
  console.log('\n已保存: ' + outPath);
}

main();
