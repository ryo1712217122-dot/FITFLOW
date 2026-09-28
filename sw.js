// FITFLOW - Service Worker(オフライン対応, v1.26.0)
//
// ジムの地下など電波の届かない場所でもアプリを開いて記録できるよう、画面の部品を端末に保存しておく。
// 記録データ自体は以前から localStorage にあり、クラウド同期はオンラインに戻った時に
// main.js の online イベントで送り直される。ここが担うのは「画面を開けること」だけ。
//
// 取得の方針:
//   - 画面(index.html)       : ネット優先。つながらない・遅い(3秒)時だけ保存分を使う。
//                              保存分を優先すると、新しい版を出しても古い画面に閉じ込められるため
//   - 自サイトのCSS/JS/画像   : 保存分を優先。index.html は ?v=<版> 付きのURLで参照しているので、
//                              版が変わればURLごと別物になり、古い保存分が使われることはない
//   - Google Fonts            : 保存分をすぐ返し、裏で取り直す
//   - それ以外(GASとの同期など): 一切触らない(同期の通信を保存するとデータが古くなる)
//
// リリース時は CACHE_VERSION も上げること(index.html と同じ版番号)。上げ忘れても
// 画面はネット優先なので新しい版は届くが、古い保存分が端末に残り続ける。

const CACHE_VERSION = 'fitflow-v1.26.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const FONT_CACHE = 'fitflow-fonts';
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        // index.html が参照している部品(?v= 付きのCSS/JS、vendor、アイコン)を
        // index.html 自体から拾って先に保存する。一覧を別に持つと更新漏れが起きるため
        const res = await fetch('./', { cache: 'no-store' });
        const html = await res.clone().text();
        await cache.put('./', res);

        const urls = new Set(['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']);
        for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
            const u = m[1];
            if (/^(?:[a-z]+:)?\/\//i.test(u) || u.startsWith('#') || u.startsWith('data:')) continue;
            urls.add(u);
        }
        // 1件の取得失敗でインストール全体を失敗させない(addAll は1件でも落ちると全滅する)
        await Promise.allSettled([...urls].map(u => cache.add(u)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // 古い版の保存分を消す(書体は版をまたいで使い回す)
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(k => k.startsWith('fitflow-v') && k !== SHELL_CACHE)
            .map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (req.mode === 'navigate') {
        event.respondWith(networkFirst(event, req));
        return;
    }
    if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(req));
        return;
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(event, req));
    }
    // それ以外(script.google.com への同期など)は素通しにする
});

async function networkFirst(event, req) {
    const cache = await caches.open(SHELL_CACHE);
    const network = fetch(req).then(res => {
        if (res.ok) {
            const copy = res.clone();
            cache.put('./', copy);
        }
        return res;
    });
    // 3秒待ってもつながらなければ保存分で開く。ネット側の取得は裏で続け、届いたら保存し直す
    event.waitUntil(network.catch(() => {}));
    const timeout = new Promise(resolve => setTimeout(resolve, NAVIGATION_TIMEOUT_MS, null));
    try {
        const res = await Promise.race([network, timeout]);
        if (res) return res;
    } catch (e) {
        // オフライン
    }
    const cached = await cache.match('./');
    return cached || network;
}

async function cacheFirst(req) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
}

async function staleWhileRevalidate(event, req) {
    const cache = await caches.open(FONT_CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
        // Google Fonts の CSS は no-cors で読むので opaque(status 0)になるが、保存はできる
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
    });
    if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
    }
    return network;
}
