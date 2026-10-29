<?php
// Director's Cut: TMDB proxy on vinciamomedia.com/pages/directors-cut-api/.
// Holds the TMDB key server-side so it never ships in the public extension.
// GET ?path=<tmdb path>[&query params]  e.g. ?path=movie/824/videos
// Kill switch: 07_Tools/Claude Code setup.md, C and E (pause file: ~/directors-cut-private/proxy-off).

declare(strict_types=1);

const TMDB_BASE = 'https://api.themoviedb.org/3/';
const CACHE_DAYS = 7;          // film/person data barely changes
const SEARCH_CACHE_DAYS = 1;
const RATE_LIMIT = 300;        // requests per IP per window (cached hits count too)
const RATE_WINDOW = 600;       // seconds

// --- Allowlist: only the TMDB calls the extension makes ---
const ALLOWED_PATHS = [
    '#^movie/\d+/videos$#',
    '#^(movie|tv)/\d+/(images|credits)$#',
    '#^person/\d+/images$#',
    '#^find/tt\d+$#',
    '#^search/person$#',
];
const ALLOWED_PARAMS = ['language', 'include_image_language', 'include_video_language', 'external_source', 'query', 'include_adult', 'page'];

function privateDir(): string { return dirname(__DIR__, 3) . '/directors-cut-private'; }
function dataDir(): string { return dirname(__DIR__, 3) . '/directors-cut-data'; }

function reply(int $status, string $json, string $cacheState = 'none'): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('X-Robots-Tag: noindex, nofollow');
    header('X-Proxy-Cache: ' . $cacheState);
    echo $json;
    exit;
}

function fail(int $status, string $message): never {
    reply($status, json_encode(['error' => $message]));
}

// --- Rate limit per IP (hashed; the raw IP is never stored) ---
function overRateLimit(string $ip): bool {
    $dir = dataDir() . '/rate';
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    $file = $dir . '/' . hash('sha256', $ip) . '.json';
    $now = time();
    $state = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    if (($state['start'] ?? 0) < $now - RATE_WINDOW) $state = ['start' => $now, 'count' => 0];
    $state['count']++;
    file_put_contents($file, json_encode($state), LOCK_EX);
    return $state['count'] > RATE_LIMIT;
}

// --- Request checks ---
if (is_file(privateDir() . '/proxy-off')) fail(503, 'Paused');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') reply(204, '');
if ($_SERVER['REQUEST_METHOD'] !== 'GET') fail(405, 'GET only');

$path = trim((string) ($_GET['path'] ?? ''), '/');
$allowed = false;
foreach (ALLOWED_PATHS as $pattern) {
    if (preg_match($pattern, $path)) { $allowed = true; break; }
}
if (!$allowed) fail(404, 'Path not allowed');

$params = [];
foreach (ALLOWED_PARAMS as $name) {
    if (isset($_GET[$name]) && is_string($_GET[$name]) && strlen($_GET[$name]) <= 200) $params[$name] = $_GET[$name];
}
ksort($params);
if ($path === 'search/person' && trim($params['query'] ?? '') === '') fail(400, 'query required');

if (overRateLimit((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'))) fail(429, 'Too many requests');

// --- Cache ---
$url = TMDB_BASE . $path . ($params ? '?' . http_build_query($params) : '');
$cacheDir = dataDir() . '/cache';
if (!is_dir($cacheDir)) mkdir($cacheDir, 0700, true);
$cacheFile = $cacheDir . '/' . sha1($url) . '.json';
$maxAge = 86400 * (str_starts_with($path, 'search/') ? SEARCH_CACHE_DAYS : CACHE_DAYS);
if (is_file($cacheFile) && filemtime($cacheFile) > time() - $maxAge) {
    reply(200, (string) file_get_contents($cacheFile), 'hit');
}

// --- Fetch from TMDB ---
$key = trim((string) @file_get_contents(privateDir() . '/tmdb-key.txt'));
if ($key === '') fail(503, 'Not configured');

$curl = curl_init($url);
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'Accept: application/json'],
    CURLOPT_USERAGENT => 'DirectorsCut/0.1 (+https://github.com/jwiemer/letterboxd-directors-cut)',
]);
$body = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($body === false || $status === 0) {
    // TMDB unreachable: serve a stale copy if we have one
    if (is_file($cacheFile)) reply(200, (string) file_get_contents($cacheFile), 'stale');
    fail(502, 'TMDB unreachable');
}
if ($status === 200) {
    file_put_contents("$cacheFile.tmp", $body);
    chmod("$cacheFile.tmp", 0600);
    rename("$cacheFile.tmp", $cacheFile);
}
reply($status, (string) $body, 'miss');
