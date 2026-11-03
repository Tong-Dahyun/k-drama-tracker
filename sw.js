/* TONGHUB service worker
 * - หน้าเว็บ (HTML): ดึงจากเน็ตก่อนเสมอ เพื่อให้ได้เวอร์ชันล่าสุด ถ้าออฟไลน์ค่อยใช้ตัวที่เก็บไว้
 * - ไลบรารี / ฟอนต์ / ไอคอน: ใช้ตัวที่เก็บไว้ทันที แล้วอัปเดตเบื้องหลัง (เปิดเร็ว)
 * - ข้อมูลจาก Google Sheets และ Apps Script: ไม่แตะเลย ให้วิ่งไปที่เน็ตตรงๆ ข้อมูลจึงสดเสมอ
 */
const VERSION = 'tonghub-v1';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // POST ไป Apps Script → ปล่อยผ่าน
  const url = new URL(req.url);
  if (/(^|\.)google\.com$/.test(url.hostname) && !STATIC_HOSTS.includes(url.hostname)) return; // ข้อมูลชีต → ปล่อยผ่าน
  if (url.hostname.endsWith('googleusercontent.com')) return;

  // หน้าเว็บ: network-first
  if (req.mode === 'navigate' || (url.origin === location.origin && req.destination === 'document')) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./').then(r => r || caches.match(req)))
    );
    return;
  }

  // ไฟล์ของเว็บเอง + ไลบรารี/ฟอนต์: stale-while-revalidate
  if (url.origin === location.origin || STATIC_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(VERSION).then(cache => cache.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      }))
    );
  }
  // อย่างอื่น (เช่น รูปโปสเตอร์จากเว็บภายนอก) ปล่อยให้เบราว์เซอร์จัดการตามปกติ
});
