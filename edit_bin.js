const fs = require('fs');

// ============================================================
// Parser
// ============================================================

function findPattern(u8, start, pattern) {
  outer: for (let i = start; i <= u8.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) { if (u8[i + j] !== pattern[j]) continue outer; }
    return i;
  }
  return -1;
}

function matchAt(u8, pos, pattern) {
  if (pos + pattern.length > u8.length) return false;
  for (let i = 0; i < pattern.length; i++) { if (u8[pos + i] !== pattern[i]) return false; }
  return true;
}

function skipToNull(u8, pos) {
  while (pos < u8.length && u8[pos] !== 0) pos++;
  return pos;
}

function skipNonStructural(u8, pos) {
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
  return pos;
}

function decodeStr(u8, start, end) {
  return new TextDecoder().decode(u8.slice(start, end));
}

function parseAchievements(buf) {
  const achievements = [];
  let pos = 0;
  const u8 = new Uint8Array(buf);

  while (pos < u8.length) {
    const idx = findPattern(u8, pos, [0x6E, 0x61, 0x6D, 0x65, 0x00]);
    if (idx === -1) break;
    if (u8[idx+5] >= 0x30 && u8[idx+5] <= 0x39) { pos = idx; break; }
    pos = idx + 1;
  }

  let consecutiveFails = 0;
  while (pos < u8.length && consecutiveFails < 3) {
    pos = skipNonStructural(u8, pos);
    if (pos >= u8.length) break;
    if (!matchAt(u8, pos, [0x6E, 0x61, 0x6D, 0x65, 0x00])) {
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

    let displayName='', displayNameCN='', token='', description='', descriptionCN='', descToken='', hidden=false, icon='', iconGray='';

    if (u8[pos] === 0x64) {
      pos += 7;
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x6E) pos += 4;
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x01) pos++;
      pos = skipToNull(u8, pos) + 1;
      const ns = pos; pos = skipToNull(u8, pos) + 1;
      displayName = decodeStr(u8, ns, pos-1);
    }
    if (u8[pos] === 0x01) pos++;

    if (u8[pos] === 0x74) {
      pos += 5;
      if (u8[pos] === 0x00) pos++;
      const ts = pos; pos = skipToNull(u8, pos) + 1;
      token = decodeStr(u8, ts, pos-1);
    }

    // Check for schinese displayName
    if (u8[pos] === 0x01 && u8[pos+1] === 0x73 && u8[pos+2] === 0x63 && u8[pos+3] === 0x68 &&
        u8[pos+4] === 0x69 && u8[pos+5] === 0x6e && u8[pos+6] === 0x65 && u8[pos+7] === 0x73 && u8[pos+8] === 0x65) {
      pos += 10; // skip \x01 + 'schinese' + \x00
      const cns = pos; pos = skipToNull(u8, pos) + 1;
      displayNameCN = decodeStr(u8, cns, pos-1);
    }

    if (u8[pos] === 0x08) pos++;
    if (u8[pos] === 0x00) pos++;

    if (u8[pos] === 0x64 && u8[pos+1] === 0x65 && u8[pos+2] === 0x73 && u8[pos+3] === 0x63) {
      pos += 4;
      if (u8[pos] === 0x00) pos++;
      if (u8[pos] === 0x01) pos++;
      pos = skipToNull(u8, pos) + 1;
      const ds = pos; pos = skipToNull(u8, pos) + 1;
      description = decodeStr(u8, ds, pos-1);
      if (u8[pos] === 0x01) pos++;
      if (u8[pos] === 0x74) {
        pos += 5;
        if (u8[pos] === 0x00) pos++;
        const dts = pos; pos = skipToNull(u8, pos) + 1;
        descToken = decodeStr(u8, dts, pos-1);
      }
      // Check for schinese description
      if (u8[pos] === 0x01 && u8[pos+1] === 0x73 && u8[pos+2] === 0x63 && u8[pos+3] === 0x68 &&
          u8[pos+4] === 0x69 && u8[pos+5] === 0x6e && u8[pos+6] === 0x65 && u8[pos+7] === 0x73 && u8[pos+8] === 0x65) {
        pos += 10;
        const cds = pos; pos = skipToNull(u8, pos) + 1;
        descriptionCN = decodeStr(u8, cds, pos-1);
      }
    }

    if (u8[pos] === 0x08) pos++;
    if (u8[pos] === 0x00) pos++;
    if (u8[pos] === 0x02) pos++;

    if (u8[pos] === 0x68 && u8[pos+1] === 0x69) {
      pos += 6;
      if (u8[pos] === 0x00) pos++;
      hidden = u8[pos] !== 0x00;
      pos++;
      while (pos < u8.length && !(u8[pos] === 0x69 && (u8[pos+4] === 0x00 || u8[pos+4] === 0x5F))) pos++;
    }

    if (u8[pos] === 0x69 && u8[pos+4] === 0x00) {
      pos += 5;
      const is = pos; pos = skipToNull(u8, pos) + 1;
      icon = decodeStr(u8, is, pos-1);
      if (u8[pos] === 0x01) pos++;
    }

    if (u8[pos] === 0x69 && u8[pos+4] === 0x5F) {
      pos += 9;
      if (u8[pos] === 0x00) pos++;
      const igs = pos; pos = skipToNull(u8, pos) + 1;
      iconGray = decodeStr(u8, igs, pos-1);
    }

    achievements.push({ ordinal, displayName, displayNameCN, token, description, descriptionCN, descToken, hidden, icon, iconGray });

    // Advance to next record
    let found = false;
    let sp = pos;
    while (sp < u8.length - 6) {
      if (u8[sp] === 0x08) { sp++; continue; }
      if (u8[sp] === 0x00) { sp++; continue; }
      if (u8[sp] === 0x74 && decodeStr(u8, sp, sp+15) === 'type\x00ACHIEVEMENTS') {
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
      if (u8[sp] === 0x6E && decodeStr(u8, sp, sp+5) === 'name\x00') {
        if (u8[sp+5] >= 0x30 && u8[sp+5] <= 0x39) { found = true; break; }
      }
      sp++;
    }
    if (!found) break;
    pos = sp;
  }
  return achievements;
}

// ============================================================
// Serializer
// ============================================================

function concatArrays(arrays) {
  let len = 0;
  for (const a of arrays) len += a.length;
  const r = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { r.set(a, off); off += a.length; }
  return r;
}

function serializeRecord(a, ordinalStr) {
  const enc = new TextEncoder();
  const parts = [];

  parts.push(enc.encode('name\x00' + ordinalStr + '\x00\x00'));
  parts.push(enc.encode('display\x00\x00name\x00\x01english\x00' + (a.displayName || '') + '\x00'));
  parts.push(enc.encode('\x01token\x00' + (a.token || '') + '\x00'));
  if (a.displayNameCN) {
    parts.push(enc.encode('\x01schinese\x00' + a.displayNameCN + '\x00'));
  }
  parts.push(new Uint8Array([0x08, 0x00]));
  parts.push(enc.encode('desc\x00\x01english\x00' + (a.description || '') + '\x00\x01token\x00' + (a.descToken || '') + '\x00'));
  if (a.descriptionCN) {
    parts.push(enc.encode('\x01schinese\x00' + a.descriptionCN + '\x00'));
  }
  parts.push(new Uint8Array([0x08, 0x01]));
  parts.push(enc.encode('hidden\x00'));
  parts.push(enc.encode(a.hidden ? '1' : '0'));
  parts.push(new Uint8Array([0x00, 0x01]));
  parts.push(enc.encode('icon\x00' + (a.icon || '') + '\x00'));
  parts.push(new Uint8Array([0x01]));
  parts.push(enc.encode('icon_gray\x00' + (a.iconGray || '') + '\x00'));
  parts.push(enc.encode('\x08\x08\x00' + ordinalStr + '\x00\x01'));

  return concatArrays(parts);
}

function findRecordPositions(buf) {
  const u8 = new Uint8Array(buf);
  const positions = [];
  let pos = 0;
  while (pos < u8.length) {
    const idx = findPattern(u8, pos, [0x6E, 0x61, 0x6D, 0x65, 0x00]);
    if (idx === -1) break;
    if (u8[idx+5] >= 0x30 && u8[idx+5] <= 0x39) { positions.push(idx); pos = idx + 1; }
    else { pos = idx + 1; }
  }
  return positions;
}

function rebuildFile(origBuf, achievements) {
  const u8 = new Uint8Array(origBuf);
  const positions = findRecordPositions(origBuf);
  const header = u8.slice(0, positions[0]);

  const separators = [];
  for (let i = 1; i < positions.length; i++) {
    const recStart = positions[i-1];
    const nextRecStart = positions[i];
    let tailPos = -1;
    for (let j = nextRecStart - 6; j >= recStart; j--) {
      if (u8[j] === 0x08 && u8[j+1] === 0x08 && u8[j+2] === 0x00) {
        tailPos = j; break;
      }
    }
    if (tailPos >= 0) {
      let ordEnd = tailPos + 3;
      while (ordEnd < u8.length && u8[ordEnd] >= 0x30 && u8[ordEnd] <= 0x39) ordEnd++;
      const recEnd = ordEnd + 2;
      separators.push(u8.slice(recEnd, nextRecStart));
    } else {
      separators.push(new Uint8Array(0));
    }
  }

  const lastPos = positions[positions.length - 1];
  let tailPos = -1;
  let isAltTail = false;
  for (let j = u8.length - 6; j >= lastPos; j--) {
    if (u8[j] === 0x08 && u8[j+1] === 0x08 && u8[j+2] === 0x00) {
      tailPos = j; break;
    }
  }
  // Fallback: last record may use \x08\x08\x08\x01 instead of \x08\x08\x00{ord}\x00\x01
  if (tailPos < 0) {
    for (let j = u8.length - 6; j >= lastPos; j--) {
      if (u8[j] === 0x08 && u8[j+1] === 0x08 && u8[j+2] === 0x08 && u8[j+3] === 0x01) {
        tailPos = j; isAltTail = true; break;
      }
    }
  }
  let footer, lastRecordTail;
  if (tailPos >= 0) {
    if (isAltTail) {
      lastRecordTail = u8.slice(tailPos, tailPos + 4);
      footer = u8.slice(tailPos + 4);
    } else {
      let ordEnd = tailPos + 3;
      while (ordEnd < u8.length && u8[ordEnd] >= 0x30 && u8[ordEnd] <= 0x39) ordEnd++;
      lastRecordTail = u8.slice(tailPos, ordEnd + 2);
      footer = u8.slice(ordEnd + 2);
    }
  } else {
    footer = new Uint8Array(0);
  }

  const parts = [header];
  const standardTail = '\x08\x08\x00' + String(achievements[achievements.length - 1].ordinal) + '\x00\x01';
  const stdTailBytes = new TextEncoder().encode(standardTail);
  for (let i = 0; i < achievements.length; i++) {
    let rec = serializeRecord(achievements[i], String(achievements[i].ordinal));
    if (i === achievements.length - 1 && lastRecordTail) {
      // Replace standard ordinal tail with the original file's last-record tail
      rec = concatArrays([rec.slice(0, rec.length - stdTailBytes.length), lastRecordTail]);
    }
    parts.push(rec);
    if (i < separators.length) parts.push(separators[i]);
  }
  parts.push(footer);

  return concatArrays(parts);
}

// ============================================================
// CLI
// ============================================================

function printAchievement(a, index) {
  console.log('  [' + (index+1) + '] #' + a.ordinal + '  ' + (a.hidden ? '[隐藏] ' : '') + a.displayName);
  if (a.displayNameCN) console.log('      中文名: ' + a.displayNameCN);
  console.log('      Token: ' + a.token);
  console.log('      描述: ' + (a.description || '').substring(0, 80));
  if (a.descriptionCN) console.log('      中文描述: ' + a.descriptionCN);
  console.log('      图标: ' + (a.icon || '-'));
  console.log('      灰度: ' + (a.iconGray || '-'));
  if (a.descToken) console.log('      DescToken: ' + a.descToken);
  console.log('');
}

function cmdList(achievements, args) {
  const showHidden = args.includes('--all') || args.includes('-a');
  achievements.forEach((a, i) => {
    if (!showHidden && a.hidden) return;
    const idx = String(i + 1).padStart(3);
    const ord = String(a.ordinal).padStart(3);
    const name = (a.displayName || '(unnamed)').padEnd(30).substring(0, 30);
    const h = a.hidden ? 'H' : ' ';
    console.log('  ' + idx + '  #' + ord + '  [' + h + '] ' + name + ' ' + a.token);
  });
  console.log('\n  共 ' + achievements.length + ' 条 (隐藏: ' + achievements.filter(a => a.hidden).length + ')');
}

function cmdGet(achievements, args) {
  const n = parseInt(args[0], 10);
  if (isNaN(n)) { console.log('  用法: get <序号>'); return; }
  const a = achievements.find(x => x.ordinal === n);
  if (!a) { console.log('  未找到 #' + n); return; }
  printAchievement(a, achievements.indexOf(a));
}

function cmdSearch(achievements, args) {
  const q = args.join(' ').toLowerCase();
  if (!q) { console.log('  用法: search <关键词>'); return; }
  const results = achievements.filter(a =>
    (a.displayName && a.displayName.toLowerCase().includes(q)) ||
    (a.displayNameCN && a.displayNameCN.toLowerCase().includes(q)) ||
    (a.token && a.token.toLowerCase().includes(q)) ||
    (a.description && a.description.toLowerCase().includes(q)) ||
    (a.descriptionCN && a.descriptionCN.toLowerCase().includes(q))
  );
  if (results.length === 0) { console.log('  未匹配: ' + q); return; }
  console.log('  找到 ' + results.length + ' 条:\n');
  results.forEach(a => printAchievement(a, achievements.indexOf(a)));
}

function cmdStats(achievements) {
  const total = achievements.length;
  const hidden = achievements.filter(a => a.hidden).length;
  const visible = total - hidden;
  const withIcon = achievements.filter(a => a.icon && a.iconGray).length;
  const ords = achievements.map(a => a.ordinal);
  console.log('  总计:     ' + total);
  console.log('  可见:     ' + visible);
  console.log('  隐藏:     ' + hidden);
  console.log('  有图标:   ' + withIcon);
  console.log('  编号范围: ' + Math.min(...ords) + ' - ' + Math.max(...ords));
}

function cmdExport(achievements, args, origBuf) {
  const path = args[0];
  const json = JSON.stringify(achievements, null, 2);
  if (path) {
    fs.writeFileSync(path, json, 'utf-8');
    console.log('  已导出 ' + achievements.length + ' 条到 ' + path);
  } else {
    console.log(json);
  }
}

function cmdImport(achievements, args, origBuf, filePath) {
  const [inputPath, outputPath] = args;
  if (!inputPath) { console.log('  用法: import <input.json> [output.bin]'); return; }
  if (!fs.existsSync(inputPath)) { console.log('  文件不存在: ' + inputPath); return; }

  const imported = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  if (!Array.isArray(imported) || imported.length === 0) {
    console.log('  JSON 格式错误，需要非空数组'); return;
  }

  // Validate and update
  imported.forEach(newA => {
    const existing = achievements.find(a => a.ordinal === newA.ordinal);
    if (existing) {
      Object.assign(existing, newA);
    } else {
      achievements.push(newA);
    }
  });

  const out = outputPath || filePath.replace(/\.bin$/, '_modified.bin');
  const rebuilt = rebuildFile(origBuf, achievements);
  fs.writeFileSync(out, Buffer.from(rebuilt));
  console.log('  已导入 ' + imported.length + ' 条修改，保存到 ' + out);
}

function cmdSet(achievements, args, origBuf, filePath) {
  if (args.length < 3) {
    console.log('  用法: set <序号> <字段> <值>');
    console.log('  字段: displayName, token, description, descToken, hidden, icon, iconGray');
    return;
  }
  const ordinal = parseInt(args[0], 10);
  const field = args[1];
  const value = args.slice(2).join(' ');

  const a = achievements.find(x => x.ordinal === ordinal);
  if (!a) { console.log('  未找到 #' + ordinal); return; }

  const validFields = ['displayName', 'displayNameCN', 'token', 'description', 'descriptionCN', 'descToken', 'hidden', 'icon', 'iconGray'];
  if (!validFields.includes(field)) {
    console.log('  无效字段: ' + field + '，有效字段: ' + validFields.join(', '));
    return;
  }

  if (field === 'hidden') {
    a.hidden = value === 'true' || value === '1';
  } else {
    a[field] = value;
  }

  const outPath = filePath.replace(/\.bin$/, '_modified.bin');
  const rebuilt = rebuildFile(origBuf, achievements);
  fs.writeFileSync(outPath, Buffer.from(rebuilt));
  console.log('  已修改 #' + ordinal + ' 的 ' + field + ' = ' + a[field]);
  console.log('  保存到 ' + outPath);
}

function cmdHelp() {
  console.log('\n  edit_bin.js - 成就 .bin 文件编辑工具\n');
  console.log('  用法: node edit_bin.js <文件.bin> <命令> [参数]\n');
  console.log('  命令:');
  console.log('    list [-a]        列出所有成就 (-a 包含隐藏)');
  console.log('    get <序号>       查看单个成就详情');
  console.log('    search <关键词>  搜索成就');
  console.log('    stats            显示统计信息');
  console.log('    export [文件]    导出为 JSON (不指定文件则输出到控制台)');
  console.log('    import <json> [out.bin]  从 JSON 导入修改并保存');
  console.log('    set <序号> <字段> <值>   直接修改字段并保存');
  console.log('    help             显示此帮助\n');
  console.log('  示例:');
  console.log('    node edit_bin.js stats.bin list');
  console.log('    node edit_bin.js stats.bin get 5');
  console.log('    node edit_bin.js stats.bin search "magdalene"');
  console.log('    node edit_bin.js stats.bin export data.json');
  console.log('    node edit_bin.js stats.bin import data.json output.bin');
  console.log('    node edit_bin.js stats.bin set 5 displayName "新名称"');
  console.log('');
}

// ============================================================
// Main
// ============================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    cmdHelp();
    process.exit(args.length < 2 ? 0 : 0);
  }

  const filePath = args[0];
  const command = args[1];
  const cmdArgs = args.slice(2);

  if (!fs.existsSync(filePath)) {
    console.error('文件不存在: ' + filePath);
    process.exit(1);
  }

  const origBuf = fs.readFileSync(filePath);
  const achievements = parseAchievements(origBuf);
  console.log('  已加载 ' + filePath + '  (' + achievements.length + ' 条成就)\n');

  switch (command) {
    case 'list':
      cmdList(achievements, cmdArgs);
      break;
    case 'get':
      cmdGet(achievements, cmdArgs);
      break;
    case 'search':
      cmdSearch(achievements, cmdArgs);
      break;
    case 'stats':
      cmdStats(achievements);
      break;
    case 'export':
      cmdExport(achievements, cmdArgs, origBuf);
      break;
    case 'import':
      cmdImport(achievements, cmdArgs, origBuf, filePath);
      break;
    case 'set':
      cmdSet(achievements, cmdArgs, origBuf, filePath);
      break;
    default:
      console.log('  未知命令: ' + command);
      cmdHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}
