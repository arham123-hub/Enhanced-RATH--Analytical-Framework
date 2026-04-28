/**
 * Mock real-time data server for testing RATH's polling feature.
 * Serves a JSON array that grows by one row on every request.
 *
 * Run:  node mock-realtime-server.js
 * URL:  http://localhost:4000/data
 *       http://localhost:4000/data?after=25  (returns only rows with id > 25)
 */

const http = require('http');
const url = require('url');

const rows = [];
let counter = 0;

function generateRow() {
    counter++;
    const categories = ['A', 'B', 'C', 'D'];
    const regions   = ['North', 'South', 'East', 'West'];
    return {
        id:         counter,
        timestamp:  new Date().toISOString(),
        category:   categories[counter % categories.length],
        region:     regions[Math.floor(Math.random() * regions.length)],
        sales:      Math.round(Math.random() * 10_000) / 100,
        quantity:   Math.floor(Math.random() * 100) + 1,
        profit:     Math.round((Math.random() * 2_000 - 500) * 100) / 100,
        rating:     Math.round(Math.random() * 40 + 10) / 10,
    };
}

// Seed with 20 initial rows
for (let i = 0; i < 20; i++) rows.push(generateRow());

const server = http.createServer((req, res) => {
    // CORS — allow requests from the RATH dev server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const parsed = url.parse(req.url, true);

    if (parsed.pathname === '/data') {
        // Add a new row on every request (simulates live data arriving)
        rows.push(generateRow());

        const afterParam = parsed.query.after;
        let result = rows;
        if (afterParam !== undefined) {
            const afterId = Number(afterParam);
            result = rows.filter(row => row.id > afterId);
            console.log(`[${new Date().toLocaleTimeString()}] Served ${result.length} rows after id=${afterId} (total: ${rows.length})`);
        } else {
            console.log(`[${new Date().toLocaleTimeString()}] Served ${rows.length} rows (added row #${counter})`);
        }

        res.end(JSON.stringify(result));
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found. Use /data or /data?after=<id>' }));
    }
});

server.listen(4000, () => {
    console.log('Mock real-time server running at http://localhost:4000/data');
    console.log('Each request adds one new row. Use this URL in RATH\'s JSON API source.');
    console.log('Use ?after=<id> for incremental fetching (e.g. /data?after=25)');
});
