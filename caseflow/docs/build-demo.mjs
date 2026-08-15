/**
 * Собирает витрину docs/cabinets.html из исходников docs/demo/*.
 * Один самодостаточный файл: ни внешних запросов, ни зависимостей.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, 'demo', name), 'utf8');

const SCRIPTS = ['data.js', 'core.js', 'views-company.js', 'views-case.js', 'views-portal.js', 'app.js'];

const html = `${read('shell.html')}
<style>
${read('styles.css')}
</style>

<script>
(function () {
${SCRIPTS.map((name) => `// ---- ${name} ----\n${read(name)}`).join('\n\n')}
})();
</script>
`;

const target = join(here, 'cabinets.html');
writeFileSync(target, html);
console.log(`cabinets.html — ${Math.round(html.length / 1024)} КБ`);
