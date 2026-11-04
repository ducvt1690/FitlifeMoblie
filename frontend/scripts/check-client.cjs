const fs = require('node:fs'),
  path = require('node:path');
const parser = require('@babel/parser'),
  traverse = require('@babel/traverse').default;
const files = ['App.js'];
function walk(dir) {
  for (const e of fs.readdirSync(dir, {
    withFileTypes: true
  })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);else if (p.endsWith('.js')) files.push(p);
  }
}
walk('src');
const globals = new Set([...Object.getOwnPropertyNames(globalThis), 'window', 'document', 'navigator', '__DEV__', 'require', 'module', 'exports', 'requestAnimationFrame', 'cancelAnimationFrame']);
const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['jsx']
  });
  traverse(ast, {
    ReferencedIdentifier(p) {
      if (!p.scope.hasBinding(p.node.name) && !globals.has(p.node.name)) failures.push(`${file}:${p.node.loc.start.line} unbound ${p.node.name}`);
    },
    ImportDeclaration(p) {
      const from = p.node.source.value;
      if (!from.startsWith('.')) return;
      const target = path.resolve(path.dirname(file), from.endsWith('.js') ? from : from + '.js');
      if (!fs.existsSync(target)) {
        failures.push(`${file}: missing ${from}`);
        return;
      }
      const targetAst = parser.parse(fs.readFileSync(target, 'utf8'), {
        sourceType: 'module',
        plugins: ['jsx']
      });
      const exported = new Set();
      for (const n of targetAst.program.body) {
        if (n.type === 'ExportDefaultDeclaration') exported.add('default');
        if (n.type === 'ExportNamedDeclaration') {
          for (const spec of n.specifiers || []) exported.add(spec.exported.name);
          if (n.declaration?.id) exported.add(n.declaration.id.name);
          for (const d of n.declaration?.declarations || []) exported.add(d.id.name);
        }
      }
      for (const spec of p.node.specifiers) {
        if (spec.type === 'ImportSpecifier' && !exported.has(spec.imported.name)) failures.push(`${file}: ${from} does not export ${spec.imported.name}`);
      }
    }
  });
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`PASS ${files.length} JS files: syntax, bindings and relative import contracts.`);
