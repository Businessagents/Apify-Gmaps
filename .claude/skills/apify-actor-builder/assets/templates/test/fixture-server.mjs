// Offline fixture server: serves HTML that mimics the target site's DOM so the
// whole crawler pipeline (scrolling, extraction, filtering, saving) can be
// exercised without network access or hitting the real site.
//
// Run the actor against it with:
//   TARGET_BASE_URL=http://127.0.0.1:38471 \
//   CHROME_EXECUTABLE_PATH=/opt/pw-browsers/chromium \
//   APIFY_HEADLESS=1 CRAWLEE_HEADLESS=1 npm start
import http from 'node:http';

const ITEMS = [
    { id: 'alpha', name: 'Alpha Example', /* add the fields your extractor reads */ },
    { id: 'beta', name: 'Beta Example' },
];

const listPage = () => `<!doctype html><html><body>
    <div id="results">
        ${ITEMS.map((it) => `<a href="/item/${it.id}" data-name="${it.name}">${it.name}</a>`).join('\n')}
    </div>
</body></html>`;

const detailPage = (it) => `<!doctype html><html><body>
    <h1>${it.name}</h1>
    <!-- Mirror the real detail-page structure your extractor queries. -->
</body></html>`;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (url.pathname.startsWith('/search')) return res.end(listPage());
    if (url.pathname.startsWith('/item/')) {
        const it = ITEMS.find((x) => x.id === url.pathname.split('/').pop());
        if (!it) { res.statusCode = 404; return res.end('not found'); }
        return res.end(detailPage(it));
    }
    res.statusCode = 404;
    res.end('not found');
});

server.listen(38471, '127.0.0.1', () => console.log('fixture server on http://127.0.0.1:38471'));
