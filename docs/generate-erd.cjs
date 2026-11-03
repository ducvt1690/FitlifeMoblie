'use strict';

// Generates documentation from the real validators, never from demo data.
// Rendering only: npm install --prefix <temporary-folder> @viz-js/viz sharp
// FITLIFE_ERD_TOOLS=<temporary-folder>/node_modules node docs/generate-erd.cjs
const fs = require('node:fs');
const path = require('node:path');
const { collections, references } = require('../backend/database/mongodb/schema');
const out = path.join(__dirname, 'erd');
fs.mkdirSync(out, { recursive: true });
const definitions = Object.fromEntries(collections.map(c => [c.name, c]));
const selected = {
  users: ['user_id', 'email', 'full_name', 'role', 'is_active', 'date_of_birth', 'fit_coins', 'streak_days', 'timezone'],
  water_logs: ['log_id', 'user_id', 'amount', 'log_time', 'log_date'],
  workout_logs: ['workout_id', 'user_id', 'title', 'duration_seconds', 'calories_burned', 'workout_date'],
  exercises: ['exercise_id', 'source', 'source_exercise_id', 'name_vi', 'gif_url', 'instructions_vi'],
  meal_logs: ['meal_id', 'user_id', 'meal_name', 'calories', 'protein', 'carbs', 'fat', 'meal_type', 'meal_date'],
  daily_quest_logs: ['quest_log_id', 'user_id', 'quest_key', 'quest_date', 'is_completed', 'reward_coins'],
  bmi_history: ['record_id', 'user_id', 'weight', 'height', 'bmi_value', 'record_date'],
  sleep_logs: ['sleep_id', 'user_id', 'hours', 'quality', 'sleep_date'],
  mood_logs: ['mood_id', 'user_id', 'mood_label', 'note', 'mood_date'],
  workout_templates: ['template_id', 'trainer_id', 'title', 'duration_seconds', 'description', 'is_active'],
  trainer_assignments: ['id', 'trainer_id', 'user_id', 'template_id', 'status', 'done_at'],
  trainer_links: ['link_id', 'trainer_id', 'user_id', 'invite_code', 'status', 'accepted_at', 'ended_at'],
  admin_logs: ['log_id', 'admin_id', 'action', 'target_type', 'target_id', 'note'],
  challenges: ['challenge_id', 'title', 'target_days', 'reward_coins', 'is_active'],
  user_challenges: ['id', 'user_id', 'challenge_id', 'current_progress', 'is_completed', 'last_checkin_date'],
  reward_items: ['item_id', 'title', 'category', 'cost_coins', 'is_available'],
  purchases: ['purchase_id', 'user_id', 'item_id', 'item_category', 'spent_coins', 'purchased_at'],
  ai_chat_sessions: ['session_id', 'user_id', 'title', 'updated_at'],
  ai_chat_messages: ['message_id', 'user_id', 'session_id', 'sender', 'content', 'ai_engine', 'timestamp'],
  auth_sessions: ['token_hash', 'user_id', 'created_at', 'expires_at'],
};
definitions.auth_sessions = { id: 'token_hash', validator: { $jsonSchema: { properties: {
  token_hash: { bsonType: 'string' }, user_id: { bsonType: 'string' }, created_at: { bsonType: 'date' }, expires_at: { bsonType: 'date' },
} } } };
const relations = [...references, { from: 'auth_sessions', field: 'user_id', to: 'users', target: 'user_id' }];
const type = p => {
  const t = [].concat(p.bsonType);
  return t.includes('date') ? 'datetime' : t.includes('bool') ? 'boolean' : t.includes('array') ? 'array'
    : t.includes('string') ? 'string' : t.includes('double') ? 'decimal' : 'int';
};
function fields(name) {
  return selected[name].map(field => {
    const property = definitions[name].validator.$jsonSchema.properties[field];
    if (!property) throw new Error(`Unknown schema field: ${name}.${field}`);
    const reference = relations.find(r => r.from === name && r.field === field);
    const key = field === definitions[name].id ? 'PK' : reference ? 'FK' : ['email', 'invite_code'].includes(field) ? 'UK' : '';
    return { field, type: type(property), key, nullable: [].concat(property.bsonType).includes('null') };
  });
}
const groups = [
  { file: 'fitlife-full', title: 'FITLIFE | ERD TOAN BO', names: Object.keys(selected), compact: true, color: '#173449' },
  { file: 'fitlife-health', title: 'FITLIFE | NHAT KY & TAI KHOAN', names: ['users', 'auth_sessions', 'water_logs', 'workout_logs', 'meal_logs', 'daily_quest_logs', 'bmi_history', 'sleep_logs', 'mood_logs', 'exercises'], color: '#0F766E' },
  { file: 'fitlife-rewards', title: 'FITLIFE | THU THACH & DOI THUONG', names: ['users', 'challenges', 'user_challenges', 'reward_items', 'purchases'], color: '#9A581C' },
  { file: 'fitlife-coaching-chat', title: 'FITLIFE | TRAINER, ADMIN & CHAT', names: ['users', 'trainer_links', 'workout_templates', 'trainer_assignments', 'admin_logs', 'ai_chat_sessions', 'ai_chat_messages'], color: '#5B42A0' },
];
function mermaid(group) {
  let s = 'erDiagram\n    direction LR\n';
  for (const name of group.names) {
    s += `    ${name} {\n`;
    for (const f of fields(name)) s += `        ${f.type} ${f.field}${f.key ? ' ' + f.key : ''}${f.nullable ? ' "nullable"' : ''}\n`;
    s += '    }\n';
  }
  for (const r of relations.filter(r => group.names.includes(r.from) && group.names.includes(r.to))) {
    s += `    ${r.to} ${r.from === 'trainer_links' && r.field === 'user_id' ? '|o' : '||'}..o{ ${r.from} : "${r.field}"\n`;
  }
  return s;
}
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function dot(group) {
  const subtitle = group.compact ? '20 collections: 19 business + auth_sessions' : `${group.names.length} collections in this view`;
  let s = `digraph fitlife { graph [rankdir=LR, bgcolor="#F3F6FA", pad="0.4", nodesep="0.25", ranksep="1.1", splines=polyline, fontname="Arial", fontsize=23, fontcolor="#173449", labelloc=t, label="${group.title}\\n${subtitle} | logical references | 03-11-2026"]; node [shape=plain, fontname="Arial"]; edge [fontname="Arial", fontsize=9, color="#7990A4", fontcolor="#365268", arrowsize=0.6];\n`;
  for (const name of group.names) {
    const all = fields(name);
    const shown = group.compact ? all.filter(f => f.key).concat(all.filter(f => !f.key).slice(0, 1)) : all;
    let label = `<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="7" COLOR="#D5DEE8"><TR><TD COLSPAN="3" BGCOLOR="${group.color}"><FONT COLOR="white"><B>${name}</B></FONT></TD></TR>`;
    for (const f of shown) label += `<TR><TD BGCOLOR="white"><FONT POINT-SIZE="10" COLOR="#52697F">${f.key || '-'}</FONT></TD><TD ALIGN="LEFT" BGCOLOR="white"><FONT POINT-SIZE="11">${f.field}${f.nullable ? ' ?' : ''}</FONT></TD><TD ALIGN="LEFT" BGCOLOR="white"><FONT POINT-SIZE="10" COLOR="#52697F">${f.type}</FONT></TD></TR>`;
    label += '</TABLE>';
    s += `${name} [label=<${label}>];\n`;
  }
  for (const r of relations.filter(r => group.names.includes(r.from) && group.names.includes(r.to))) {
    const start = r.from === 'trainer_links' && r.field === 'user_id' ? '0..1' : '1';
    s += `${r.to} -> ${r.from} [label="${r.field}", taillabel="${start}", headlabel="0..N", labeldistance=1.8, dir=both, arrowtail=none, arrowhead=none];\n`;
  }
  return s + '}';
}
async function main() {
  const toolsDir = process.env.FITLIFE_ERD_TOOLS;
  let viz, sharp;
  if (toolsDir) {
    viz = await require(path.join(toolsDir, '@viz-js/viz')).instance();
    sharp = require(path.join(toolsDir, 'sharp'));
  }
  for (const group of groups) {
    fs.writeFileSync(path.join(out, group.file + '.mmd'), mermaid(group));
    fs.writeFileSync(path.join(out, group.file + '.dot'), dot(group));
    if (viz) {
      const svg = viz.renderString(dot(group), { format: 'svg' });
      fs.writeFileSync(path.join(out, group.file + '.svg'), svg);
      await sharp(Buffer.from(svg)).resize({ width: 2600, withoutEnlargement: true }).png().toFile(path.join(out, group.file + '.png'));
    }
  }
  const dictionary = collections.map(c => `### ${c.name}\n\nKhóa nghiệp vụ: \`${c.id}\`.\n\n| Trường | Kiểu | Bắt buộc | Giá trị / giới hạn |\n|---|---|---|---|\n` + Object.entries(c.validator.$jsonSchema.properties).filter(([key]) => key !== '_id').map(([key, p]) => `| ${key} | ${[].concat(p.bsonType).join('/')} | ${c.validator.$jsonSchema.required.includes(key) ? 'Có' : 'Không'} | ${(p.enum || []).join(', ')}${p.minimum !== undefined ? ' min=' + p.minimum : ''}${p.maximum !== undefined ? ' max=' + p.maximum : ''} |`).join('\n')
    + '\n\nIndexes:\n\n' + c.indexes.map(i => `- \`${i.name}\`: \`${JSON.stringify(i.key)}\`${i.unique ? ', unique' : ''}${i.partialFilterExpression ? ', partial: `' + JSON.stringify(i.partialFilterExpression) + '`' : ''}`).join('\n')).join('\n\n');
  fs.writeFileSync(path.join(out, 'DATA_DICTIONARY.md'), '# Từ điển dữ liệu FitLife\n\nSinh từ `backend/database/mongodb/schema.js`; auth_sessions được giải thích trong README.\n\n' + dictionary + '\n');
  const gallery = groups.map(g => `<section><h2>${escape(g.title)}</h2><p><a href="${g.file}.svg">Mở SVG để phóng to</a> · <a href="${g.file}.mmd">Mermaid</a></p><a href="${g.file}.svg"><img src="${g.file}.svg" alt="${escape(g.title)}"></a></section>`).join('');
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="vi"><meta charset="utf-8"><title>FitLife ERD</title><style>body{font:16px Arial;background:#f3f6fa;color:#173449;margin:32px auto;max-width:1440px;padding:0 24px}section{margin:30px 0;padding:24px;background:white;border-radius:14px}img{width:100%;height:auto}a{color:#0f766e}p{line-height:1.7}</style><h1>FitLife — ERD theo mã nguồn</h1><p>19 collection nghiệp vụ và 1 collection phiên đăng nhập. PK: khóa nghiệp vụ unique; FK: tham chiếu logic, MongoDB không cưỡng chế foreign key. 1 — 0..N: một–nhiều. trainer_links.user_id có thể null khi chưa chấp nhận lời mời. exercises độc lập vì chưa có exercise_id trong workout_logs hay workout_templates.</p>${gallery}</html>`);
  console.log(`Generated ${groups.length} ERD views for ${Object.keys(selected).length} collections.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
