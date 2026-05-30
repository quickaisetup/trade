// Netlify serverless function — fetches RSS feed server-side, no CORS issues
exports.handler = async function(event) {
  var url = event.queryStringParameters && event.queryStringParameters.url;
  if (!url) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing url param' }) };
  }

  // Only allow known RSS domains for security
  var allowed = [
    'forexlive.com', 'fxstreet.com', 'cnbc.com', 'dowjones.io',
    'investing.com', 'marketwatch.com', 'bloomberg.com', 'reuters.com',
    'kitco.com', 'financialjuice.com', 'dailyfx.com', 'forexfactory.com'
  ];
  var isAllowed = allowed.some(function(d) { return url.indexOf(d) > -1; });
  if (!isAllowed) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Domain not allowed' }) };
  }

  try {
    var https = require('https');
    var http = require('http');
    var urlModule = require('url');

    var parsed = urlModule.parse(url);
    var client = parsed.protocol === 'https:' ? https : http;

    var body = await new Promise(function(resolve, reject) {
      var req = client.get({
        hostname: parsed.hostname,
        path: parsed.path,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        timeout: 8000
      }, function(res) {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          reject(new Error('REDIRECT:' + res.headers.location));
          return;
        }
        var chunks = [];
        res.on('data', function(c) { chunks.push(c); });
        res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf8')); });
      });
      req.on('error', reject);
      req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=120' // cache 2 minutes
      },
      body: body
    };
  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
