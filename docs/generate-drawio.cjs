'use strict';

// Native, editable draw.io tables and connectors, generated from MongoDB validators.
// Layout dependency lives outside the application's runtime:
// npm install --prefix <tools-directory> @viz-js/viz
// FITLIFE_ERD_TOOLS=<tools-directory>/node_modules node docs/generate-drawio.cjs
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { collections, references } = require('../backend/database/mongodb/schema');
const output = path.join(__dirname, 'erd');
const definitions = Object.fromEntries(collections.map(c => [c.name, c]));
definitions.auth_sessions = {
  id: 'token_hash',
  validator: { $jsonSchema: {
    required: ['token_hash', 'user_id', 'created_at', 'expires_at'],
    properties: { _id: { bsonType: 'objectId' }, token_hash: { bsonType: 'string' }, user_id: { bsonType: 'string' },
      created_at: { bsonType: 'date' }, expires_at: { bsonType: 'date' } },
  } },
  indexes: [{ key: { token_hash: 1 }, unique: true }, { key: { expires_at: 1 }, expireAfterSeconds: 0 }, { key: { user_id: 1 } }],
};
const relations = [...references, { from: 'auth_sessions', field: 'user_id', to: 'users', target: 'user_id' }];
const pages = [
  { id: 'overview', name: '01 — Tổng quan', title: 'FITLIFE / ERD TỔNG QUAN', compact: true, names: Object.keys(definitions) },
  { id: 'health', name: '02 — Nhật ký & tài khoản', title: 'TÀI KHOẢN & NHẬT KÝ SỨC KHỎE', names: [
    'users', 'auth_sessions', 'water_logs', 'workout_logs', 'meal_logs', 'daily_quest_logs', 'bmi_history', 'sleep_logs', 'mood_logs', 'exercises',
  ] },
  { id: 'rewards', name: '03 — Thử thách & đổi thưởng', title: 'THỬ THÁCH & ĐỔI THƯỞNG', names: [
    'users', 'challenges', 'user_challenges', 'reward_items', 'purchases',
  ] },
  { id: 'coaching', name: '04 — Trainer, admin & chat', title: 'TRAINER, ADMIN & AI CHAT', names: [
    'users', 'trainer_links', 'workout_templates', 'trainer_assignments', 'admin_logs', 'ai_chat_sessions', 'ai_chat_messages',
  ] },
];
const xml = v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const color = name => name === 'users' || name === 'auth_sessions' ? '#173449'
  : ['challenges', 'user_challenges', 'purchases', 'reward_items'].includes(name) ? '#A35C19'
    : ['trainer_links', 'workout_templates', 'trainer_assignments', 'admin_logs', 'ai_chat_sessions', 'ai_chat_messages'].includes(name) ? '#6244A0' : '#087F78';
const shortType = property => {
  const types = [].concat(property.bsonType);
  return types.includes('date') ? 'datetime' : types.includes('objectId') ? 'ObjectId' : types.includes('bool') ? 'bool'
    : types.includes('array') ? 'string[]' : types.includes('string') ? 'string' : types.includes('double') ? 'number' : 'int';
};
function fields(name, compact) {
  const def = definitions[name];
  const all = Object.entries(def.validator.$jsonSchema.properties).filter(([field]) => field !== '_id').map(([field, property]) => {
    const fk = relations.some(r => r.from === name && r.field === field);
    const uk = def.indexes.some(index => index.unique && Object.keys(index.key).length === 1 && Object.hasOwn(index.key, field));
    const key = field === def.id ? 'PK' : fk ? 'FK' : uk ? 'UK' : '';
    return { field, key, type: shortType(property), property,
      optional: !def.validator.$jsonSchema.required.includes(field), nullable: [].concat(property.bsonType).includes('null') };
  });
  if (!compact) return all;
  const keys = all.filter(f => f.key);
  return keys.concat(all.filter(f => !f.key && !['created_at', 'updated_at'].includes(f.field)).slice(0, 2));
}
const W = 390, HEADER = 38, ROW = 27, FOOTER = 26;
function tableHeight(name, compact) { return HEADER + ROW * fields(name, compact).length + FOOTER; }
function cell(id, value, style, geometry, extra = '') {
  return `<mxCell id="${xml(id)}" value="${xml(value)}" style="${xml(style)}" vertex="1" parent="1" ${extra}><mxGeometry ${geometry} as="geometry"/></mxCell>`;
}
async function drawPage(viz, page) {
  const pageRelations = relations.filter(r => page.names.includes(r.from) && page.names.includes(r.to));
  // Invisible graph vertices reserve exactly the space required by editable tables.
  const dot = `digraph erd { graph [rankdir=LR, nodesep=0.5, ranksep=1.65, splines=polyline, pad=0]; node [shape=box,fixedsize=true,label=""]; edge [arrowhead=none,arrowtail=none];\n`
    + page.names.map(name => `${name} [width=${W / 72}, height=${tableHeight(name, page.compact) / 72}];`).join('\n')
    + pageRelations.map((r, i) => `${r.to} -> ${r.from} [id="edge${i}"];`).join('\n') + '\n}';
  const layout = viz.renderJSON(dot);
  const [left, bottom, right, top] = layout.bb.split(',').map(Number);
  const graphWidth = right - left, graphHeight = top - bottom;
  const marginX = 70, marginY = 200;
  const positions = {};
  for (const node of layout.objects) {
    const [cx, cy] = node.pos.split(',').map(Number);
    positions[node.name] = { x: cx - W / 2 + marginX, y: top - cy - tableHeight(node.name, page.compact) / 2 + marginY,
      w: W, h: tableHeight(node.name, page.compact) };
  }
  const pageWidth = Math.ceil(graphWidth + marginX * 2), pageHeight = Math.ceil(graphHeight + marginY + 180);
  let cells = '<mxCell id="0"/><mxCell id="1" parent="0"/>';
  cells += cell('title', page.title, 'text;html=0;align=left;verticalAlign=middle;fontFamily=Arial;fontSize=29;fontStyle=1;fontColor=#173449;strokeColor=none;fillColor=none;', `x="70" y="35" width="${pageWidth - 140}" height="45"`);
  const subtitle = page.compact ? '20 collections · 19 nghiệp vụ + auth_sessions · Schema hiện tại, 03/11/2026' : `${page.names.length} collections · Đầy đủ trường trong validator, ẩn _id · Schema hiện tại, 03/11/2026`;
  cells += cell('subtitle', subtitle, 'text;html=0;align=left;fontFamily=Arial;fontSize=15;fontColor=#50667B;strokeColor=none;fillColor=none;', `x="70" y="90" width="${pageWidth - 140}" height="28"`);
  cells += cell('legend', 'PK = khóa nghiệp vụ unique   •   FK = tham chiếu logic   •   UK = unique   •   ? = optional hoặc nullable   •   1 → 0..N = một–nhiều', 'text;html=0;align=left;fontFamily=Arial;fontSize=12;fontColor=#50667B;strokeColor=none;fillColor=none;', `x="70" y="125" width="${pageWidth - 140}" height="28"`);
  // Edges precede vertices in z-order. Every endpoint remains attached to its table when moved.
  for (let i = 0; i < pageRelations.length; i++) {
    const r = pageRelations[i];
    const edge = layout.edges.find(e => e.id === `edge${i}`);
    const source = positions[r.to], target = positions[r.from];
    const pathPoints = edge._draw_.find(op => op.op === 'b').points.map(([x, y]) => ({ x: x + marginX, y: top - y + marginY }));
    const start = pathPoints[0], finish = pathPoints.at(-1);
    const clamp = n => Math.max(0, Math.min(1, n));
    const ex = clamp((start.x - source.x) / source.w), ey = clamp((start.y - source.y) / source.h);
    const tx = clamp((finish.x - target.x) / target.w), ty = clamp((finish.y - target.y) / target.h);
    const optional = r.from === 'trainer_links' && r.field === 'user_id';
    const edgeStyle = `edgeStyle=none;rounded=0;html=0;strokeWidth=1.3;strokeColor=${color(r.from)};fontFamily=Arial;fontSize=11;fontColor=#365268;labelBackgroundColor=#F5F7FB;startArrow=${optional ? 'ERzeroToOne' : 'ERone'};endArrow=ERzeroToMany;startSize=14;endSize=16;exitX=${ex};exitY=${ey};exitPerimeter=0;entryX=${tx};entryY=${ty};entryPerimeter=0;`;
    cells += `<mxCell id="rel-${i}" value="${xml(r.field)}" style="${xml(edgeStyle)}" edge="1" parent="1" source="${r.to}" target="${r.from}"><mxGeometry relative="1" as="geometry"><Array as="points">${pathPoints.slice(1, -1).map(p => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('')}</Array></mxGeometry></mxCell>`;
  }
  for (const name of page.names) {
    const p = positions[name], ff = fields(name, page.compact), c = color(name);
    const style = `swimlane;html=0;startSize=${HEADER};horizontal=1;rounded=0;collapsible=0;container=1;recursiveResize=0;fillColor=${c};swimlaneFillColor=#FFFFFF;strokeColor=#CBD5E1;fontColor=#FFFFFF;fontFamily=Arial;fontSize=16;fontStyle=1;align=left;spacingLeft=14;shadow=0;`;
    const tip = `${name}: ${page.compact ? 'Các trường chính. Xem trang chi tiết để có đầy đủ.' : 'Các trường trong schema; _id là ObjectId do MongoDB quản lý.'}`;
    cells += cell(name, name, style, `x="${p.x}" y="${p.y}" width="${W}" height="${p.h}"`, `tooltip="${xml(tip)}"`);
    for (let index = 0; index < ff.length; index++) {
      const f = ff[index], y = HEADER + index * ROW;
      const bg = index % 2 === 0 ? '#FFFFFF' : '#F3F6FA';
      const rowStyle = `rounded=0;html=1;whiteSpace=wrap;strokeColor=none;fillColor=${bg};fontColor=#173449;fontFamily=Arial;fontSize=12;align=left;verticalAlign=middle;spacing=0;resizable=0;movable=0;deletable=1;`;
      const label = `<table style="width:100%;font-family:Arial;font-size:12px;border-collapse:collapse"><tr><td style="width:38px;padding-left:10px;color:${c};font-weight:bold">${f.key}</td><td style="width:220px">${f.field}${f.optional || f.nullable ? ' ?' : ''}</td><td style="color:#62778B">${f.type}</td></tr></table>`;
      const tooltip = `${f.field}: ${[].concat(f.property.bsonType).join(' | ')}${f.property.enum ? '; enum: ' + f.property.enum.join(', ') : ''}${f.optional ? '; optional' : '; required'}${f.nullable ? '; accepts null' : ''}`;
      cells += `<mxCell id="${name}-${f.field}" value="${xml(label)}" tooltip="${xml(tooltip)}" style="${xml(rowStyle)}" vertex="1" parent="${name}"><mxGeometry x="0" y="${y}" width="${W}" height="${ROW}" as="geometry"/></mxCell>`;
    }
    const footer = page.compact ? `${ff.length} trường chính · xem trang 02–04` : `${ff.length} trường · _id (ObjectId) được ẩn`;
    cells += `<mxCell id="${name}-footer" value="${xml(footer)}" style="text;html=0;align=left;spacingLeft=12;fontFamily=Arial;fontSize=10;fontColor=#718399;strokeColor=none;fillColor=#EAF0F6;movable=0;resizable=0;" vertex="1" parent="${name}"><mxGeometry x="0" y="${HEADER + ff.length * ROW}" width="${W}" height="${FOOTER}" as="geometry"/></mxCell>`;
  }
  const notes = [
    'MongoDB không cưỡng chế FK. Service/transaction và db:verify quản lý tham chiếu. _id vẫn là khóa vật lý MongoDB.',
    'users chứa cả ba role user / trainer / admin. trainer_links.user_id = null khi lời mời chưa được chấp nhận (phía users: 0..1).',
    'exercises hiện độc lập: workout_logs và workout_templates chưa lưu exercise_id. admin_logs.target_id là tham chiếu đa hình theo target_type.',
  ];
  cells += cell('notes', notes.join('\n'), 'text;html=0;align=left;verticalAlign=top;whiteSpace=wrap;fontFamily=Arial;fontSize=12;fontColor=#50667B;strokeColor=none;fillColor=none;', `x="70" y="${marginY + graphHeight + 40}" width="${pageWidth - 140}" height="100"`);
  return `<diagram id="${page.id}" name="${xml(page.name)}"><mxGraphModel dx="1200" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0" background="#F5F7FB"><root>${cells}</root></mxGraphModel></diagram>`;
}
async function main() {
  if (!process.env.FITLIFE_ERD_TOOLS) throw new Error('Set FITLIFE_ERD_TOOLS to the tools node_modules folder.');
  const viz = await require(path.join(process.env.FITLIFE_ERD_TOOLS, '@viz-js/viz')).instance();
  const diagrams = [];
  for (const page of pages) diagrams.push(await drawPage(viz, page));
  const document = `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="app.diagrams.net" agent="FitLife ERD generator" version="24.7.17" type="device" compressed="false" pages="${pages.length}">${diagrams.join('')}</mxfile>\n`;
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'FitLife-ERD.drawio'), document);
  // URL fragment is decoded by the editor; diagram content is not a server query.
  const payload = deflateRawSync(Buffer.from(encodeURIComponent(document))).toString('base64');
  const editorUrl = 'https://app.diagrams.net/?splash=0&title=FitLife-ERD.drawio#R' + payload;
  fs.writeFileSync(path.join(output, 'open-drawio.html'), `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Mở FitLife ERD trong draw.io</title><style>body{font:18px Arial;max-width:760px;margin:80px auto;line-height:1.6;color:#173449}a{color:#087F78}</style><h1>FitLife ERD — draw.io</h1><p>4 trang sơ đồ chỉnh sửa được: tổng quan, nhật ký, đổi thưởng, trainer/admin/chat.</p><p><a href="${xml(editorUrl)}">Mở sơ đồ trong draw.io</a></p><p><a href="FitLife-ERD.drawio" download>Tải file .drawio</a></p></html>\n`);
  console.log(`Generated FitLife-ERD.drawio: ${pages.length} pages, ${Object.keys(definitions).length} collections, ${relations.length} logical references.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
