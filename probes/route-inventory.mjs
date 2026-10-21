// Read-only dump of every route the Express app exposes, with the middleware
// chain of each. Used to build the route-inventory allow-list.
import 'dotenv/config';
import { app } from '../src/app.js';

const walk = (stack, prefix = '') => {
  const out = [];
  for (const layer of stack) {
    if (layer.route) {
      const handlers = layer.route.stack.map((h) => h.name).filter(Boolean);
      out.push({
        path: `${prefix}${layer.route.path}`,
        methods: Object.keys(layer.route.methods).join(',').toUpperCase(),
        handlers,
      });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const base = layer.regexp?.source || '';
      const m = base.match(/^\^\\\/((?:[^\\\/]|\\\/)+)/);
      const mount = m ? `/${m[1].replace(/\\\//g, '/')}` : '';
      out.push(...walk(layer.handle.stack, `${prefix}${mount === '/' ? '' : mount}`));
    }
  }
  return out;
};

const routes = walk(app._router.stack);
for (const r of routes) {
  console.log(`${r.methods.padEnd(12)} ${r.path.padEnd(46)} [${r.handlers.join(', ')}]`);
}
console.log(`\nTOTAL ${routes.length}`);
