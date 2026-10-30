/* Listener Advisor · prototipo navegable
   Una sola página con rutas por hash. Estado en localStorage. */
(() => {
  const { MUNDOS, ORDER, POSTURA, CHARLA, CITIES, PLACES, EVENTS, ORGS } = LA;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* ---------- fechas ---------- */
  const today = new Date(); today.setHours(0, 0, 0, 0);

  /* ---------- normalización de datos (los generados traen fecha absoluta) ---------- */
  for (const e of EVENTS) {
    if (e.date) e.d = Math.round((new Date(e.date + 'T00:00:00') - today) / 864e5);
    e.lineup ||= []; e.genres ||= [];
  }
  for (let i = EVENTS.length - 1; i >= 0; i--) if (EVENTS[i].d < 0) EVENTS.splice(i, 1);
  for (const p of PLACES) { p.sys ||= []; p.followers ||= 0; p.desc ||= ''; }
  const placeById = Object.fromEntries(PLACES.map(p => [p.id, p]));
  const evById = Object.fromEntries(EVENTS.map(e => [e.id, e]));
  const dateOf = d => { const x = new Date(today); x.setDate(x.getDate() + d); return x; };
  const fmtLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const dayLabel = d => d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : cap(fmtLong.format(dateOf(d)).split(',')[0]);
  const shortDate = d => cap(fmtShort.format(dateOf(d)).replace('.', ''));
  const priceLabel = e => {
    if (e.tickets) { const min = Math.min(...e.tickets.map(t => t.price)); return min ? min + ' €' : 'Gratis'; }
    if (e.priceText) return e.priceText;
    if (!e.price && e.ticketed) return 'Con entrada';
    return e.price ? e.price + ' €' : 'Gratis';
  };
  const soldOut = e => !!e.tickets && e.tickets.every(t => t.left === 0);
  const fewLeft = e => !!e.tickets && !soldOut(e) && e.tickets.reduce((a, t) => a + t.left, 0) <= 8;

  /* ---------- estado ---------- */
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem('la.' + k)) ?? d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem('la.' + k, JSON.stringify(v));
  const S = {
    city: load('city', 'bcn'),
    when: 'semana', mundos: new Set(), postura: null, openNow: false,
    saved: new Set(load('saved', [])), following: new Set(load('following', [])),
    wait: new Set(load('wait', [])), orders: load('orders', []),
    form: load('form', { step: 1, mundo: null, formato: null, title: '', desc: '', place: null, d: 2, t: '20:00', price: '', postura: null, charla: null, dur: '', trae: '' }),
    yoTab: 'guardados', showMap: false, searchOpen: false,
  };
  if (!CITIES[S.city]) S.city = Object.keys(CITIES)[0];
  const persist = () => { save('city', S.city); save('saved', [...S.saved]); save('following', [...S.following]); save('wait', [...S.wait]); save('orders', S.orders); save('form', S.form); };

  /* ---------- arte ---------- */
  function art(k, seed, w = 400, h = 240, scale) {
    const c = MUNDOS[k].color;
    let s = [...String(seed)].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 233280;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const sc = scale ?? Math.max(w, h) / 400;
    const cx = w * (0.3 + rnd() * 0.4), cy = h * (0.3 + rnd() * 0.4);
    let rings = '';
    [16, 40, 66, 94, 124, 156, 190, 226, 264, 306].forEach((r, i) => {
      rings += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * sc).toFixed(1)}" stroke-opacity="${Math.max(0.06, 0.9 - i * 0.09).toFixed(2)}" stroke-width="${Math.max(0.6, (1.7 - i * 0.1) * Math.min(1.4, sc)).toFixed(2)}"/>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#26302F"/><g fill="none" stroke="${c}">${rings}</g><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${Math.max(2.5, 4 * sc).toFixed(1)}" fill="${c}"/></svg>`;
  }
  // Imagen real si la hay (enlazada desde la fuente, sin copiar), anillos si no.
  const pic = (x, k, seed, w, h, scale, cls = '') => x && x.img
    ? `<div class="art photo ${cls}"><img src="${esc(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove('photo');this.outerHTML=${JSON.stringify(art(k, seed, w, h, scale)).replace(/"/g, '&quot;')}"></div>`
    : `<div class="art ${cls}">${art(k, seed, w, h, scale)}</div>`;
  const thumb = (k, seed, x) => pic(x, k, seed, 72, 72, 0.3, 'thumb');

  const ICON = {
    heart: on => `<svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z"/></svg>`,
    share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V4m0 0 4 4m-4-4L8 8M5 13v6h14v-6"/></svg>`,
    search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s6-5.4 6-10a6 6 0 0 0-12 0c0 4.6 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/></svg>`,
    tab: {
      Agenda: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
      Mapa: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
      Lugares: '<svg viewBox="0 0 24 24"><path d="M12 21s6-5.4 6-10a6 6 0 0 0-12 0c0 4.6 6 10 6 10Z"/><circle cx="12" cy="11" r="2"/></svg>',
      Mundos: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10.5"/></svg>',
      Yo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
    },
  };

  /* ---------- router ---------- */
  function route() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { name: parts[0] || 'home', id: parts[1], q };
  }
  const go = h => { location.hash = '/' + h; };

  /* ---------- helpers ---------- */
  function whenRange() {
    const dow = today.getDay();
    switch (S.when) {
      case 'hoy': return [0, 0];
      case 'finde': return dow === 0 ? [0, 0] : dow >= 5 ? [0, 7 - dow] : [5 - dow, 7 - dow];
      case 'semana': return [0, 6];
      default: return [0, 99];
    }
  }
  function isOpen(p) {
    if (!p.hours) return null;
    const now = new Date(), h = now.getHours() + now.getMinutes() / 60, dow = now.getDay();
    const { d, o, c } = p.hours;
    if (d.includes(dow) && h >= o && h < c) return true;
    if (c > 24 && d.includes((dow + 6) % 7) && h < c - 24) return true;
    return false;
  }
  const cityEvents = () => EVENTS.filter(e => placeById[e.place].city === S.city).sort((a, b) => a.d - b.d || a.t.localeCompare(b.t));
  const cityPlaces = () => PLACES.filter(p => p.city === S.city);
  function filteredEvents(extra = () => true) {
    const [a, b] = whenRange();
    return cityEvents().filter(e => e.d >= a && e.d <= b && (!S.mundos.size || S.mundos.has(e.mundo)) && (!S.postura || e.postura === S.postura) && extra(e));
  }
  const filteredPlaces = () => cityPlaces().filter(p => (!S.mundos.size || S.mundos.has(p.mundo)) && (!S.postura || p.postura === S.postura) && (!S.openNow || isOpen(p)));

  /* ---------- componentes ---------- */
  const chip = (label, on, attrs, color) => `<button class="chip${on ? ' on' : ''}" ${attrs}>${color ? `<i class="dot" style="--c:${color}"></i>` : ''}${label}</button>`;
  const saveBtn = (id, cls = '') => `<button class="iconbtn save ${cls}${S.saved.has(id) ? ' on' : ''}" data-save="${id}" aria-label="Guardar">${ICON.heart(S.saved.has(id))}</button>`;
  const howTags = x => `<div class="how"><span>${POSTURA[x.postura]}</span><span>${CHARLA[x.charla]}</span>${x.dur ? `<span>${esc(x.dur)}</span>` : ''}</div>`;
  const mundoMeta = (e, extra) => `<div class="meta"><i class="dot c-${e.mundo}"></i>${MUNDOS[e.mundo].name}${extra ? ' · ' + esc(extra) : ''}</div>`;

  function filtersBar(opts = {}) {
    let h = '<div class="filters">';
    if (opts.when !== false) h += `<div class="group"><span class="glabel">Cuándo</span>${[['hoy', 'Hoy'], ['finde', 'Este finde'], ['semana', '7 días'], ['todo', 'Todo']].map(([k, l]) => chip(l, S.when === k, `data-when="${k}"`)).join('')}</div>`;
    if (opts.open) h += `<div class="group">${chip('Abierto ahora', S.openNow, 'data-open')}</div>`;
    if (opts.mundo !== false) h += `<div class="group"><span class="glabel">Mundo</span>${ORDER.map(k => chip(MUNDOS[k].name, S.mundos.has(k), `data-mundo="${k}"`, MUNDOS[k].color)).join('')}</div>`;
    h += `<div class="group"><span class="glabel">Postura</span>${Object.entries(POSTURA).map(([k, l]) => chip(l, S.postura === k, `data-postura="${k}"`)).join('')}</div>`;
    if (opts.mapToggle) h += `<div class="group mapview">${chip(S.showMap ? 'Ver lista' : 'Ver mapa', false, 'data-togglemap')}</div>`;
    return h + '</div>';
  }

  function eventRow(e, opts = {}) {
    const p = placeById[e.place];
    const out = soldOut(e);
    return `<article class="row" data-go="evento/${e.id}">
      <div class="time">${opts.date ? shortDate(e.d) + '<br>' : ''}${e.t}</div>${thumb(e.mundo, e.id, e)}
      <div class="body">${mundoMeta(e, e.formato)}<h3>${esc(e.title)}</h3><div class="venue">${opts.hidePlace ? esc(e.lineup.join(', ')) : [p.name, p.barrio].filter(Boolean).map(esc).join(' · ')}</div>${howTags(e)}</div>
      <div class="right"><div class="price${out ? ' out' : ''}">${out ? 'Agotado' : priceLabel(e)}</div>${saveBtn(e.id, 'sm')}</div>
    </article>`;
  }
  function dayList(evs, opts = {}) {
    if (!evs.length) return `<p class="empty">No hay nada con estos filtros. Prueba otra fecha o quita un filtro. Los lugares de escucha abren aunque no haya evento: míralos en <a class="link" href="#/lugares">Lugares</a>.</p>`;
    let h = '', last = null;
    for (const e of evs) {
      if (e.d !== last) { last = e.d; h += `<div class="day"><span>${dayLabel(e.d)}</span><em>${shortDate(e.d)}</em></div>`; }
      h += eventRow(e, opts);
    }
    return h;
  }
  function fcard(e) {
    const p = placeById[e.place];
    const badge = soldOut(e) ? '<span class="badge out">Agotado · lista de espera</span>' : fewLeft(e) ? '<span class="badge warn">Quedan pocas</span>' : '';
    return `<div class="fcard" data-go="evento/${e.id}">${pic(e, e.mundo, e.id, 400, 240, 1).replace('</div>', badge + saveBtn(e.id) + '</div>')}${mundoMeta(e, e.formato)}<h3>${esc(e.title)}</h3><div class="sub">${dayLabel(e.d)} · ${e.t} · ${esc(p.name)} · ${priceLabel(e)}</div></div>`;
  }
  function vcard(p) {
    const open = isOpen(p); const next = EVENTS.filter(e => e.place === p.id).sort((a, b) => a.d - b.d)[0];
    const st = open === null ? (next ? `${dayLabel(next.d)} · ${next.t}` : 'Solo eventos') : open ? `Abierto · hasta ${p.hours.label.split('–').pop()}` : `Cerrado · ${p.hours.label}`;
    return `<div class="vcard" data-go="lugar/${p.id}">${pic(p, p.mundo, p.id, 400, 240, 1).replace('</div>', saveBtn('p:' + p.id) + '</div>')}<div class="meta"><i class="dot c-${p.mundo}"></i>${esc(p.type)}</div><h3>${esc(p.name)}</h3><div class="mute" style="font-size:14px">${esc(p.barrio)}</div><div class="sys">${esc(p.system)}</div><div class="status${open ? ' yes' : ''}"><i></i>${st}</div></div>`;
  }
  const mundoItem = (k, title, sub, href) => `<div class="mundo-item c-${k}" data-go="${href}"><div class="bar"></div><div><b>${esc(title)}</b><small>${esc(sub)}</small></div></div>`;
  const railMundos = () => `<div class="block"><div class="meta">Los cuatro mundos</div>${ORDER.map(k => mundoItem(k, MUNDOS[k].name, MUNDOS[k].short, 'mundo/' + k)).join('')}</div>`;
  const railOpen = () => { const open = cityPlaces().filter(isOpen); return open.length ? `<div class="block"><div class="meta">Abierto ahora</div>${open.map(p => mundoItem(p.mundo, p.name, `${p.type} · ${p.barrio} · hasta las ${p.hours.label.split('–').pop()}`, 'lugar/' + p.id)).join('')}</div>` : ''; };
  const railNews = () => `<div class="news"><b style="font-weight:500;font-size:17px">Esta semana se escucha en ${CITIES[S.city].name}</b><p>Un correo cada jueves con lo que merece la pena escuchar. Sin ruido.</p><input class="input" placeholder="tu@correo.com"><button class="btn primary" data-toast="Apuntado. Primer correo el jueves.">Apuntarme</button></div>`;

  /* ---------- vistas ---------- */
  function vHome() {
    const evs = filteredEvents();
    const feat = cityEvents().filter(e => e.featured && e.d <= 9).slice(0, 4);
    const intro = S.mundos.size === 1 ? (() => { const m = MUNDOS[[...S.mundos][0]]; return `<p style="font-size:15px;max-width:640px;color:var(--mute)">${m.desc} <a class="link" href="#/mundo/${[...S.mundos][0]}">Ir a la sección</a></p>`; })() : '';
    return `${filtersBar()}
    <div class="hero"><h1>${CITIES[S.city].name}</h1><p>${(() => { const n7 = cityEvents().filter(e => e.d <= 6).length, nAll = cityEvents().length, bars = cityPlaces().filter(p => p.hours).length; return `${n7 ? `Esta semana se escucha en ${new Set(cityEvents().filter(e => e.d <= 6).map(e => e.place)).size} sitios: ${n7} ${n7 === 1 ? 'evento' : 'eventos'}.` : 'Esta semana no hay nada publicado todavía.'} ${nAll} en el próximo mes, ${cityPlaces().length} lugares${bars ? `, ${bars} bares de escucha` : ''}.`; })()}</p>${intro}</div>
    ${S.mundos.size || S.postura || S.when !== 'semana' ? '' : `<div class="section" style="padding-top:40px"><div class="h-row"><h2>Destacados</h2><a class="link" href="#/mundos">Explorar por mundo</a></div><div class="feat">${feat.map(fcard).join('')}</div></div>`}
    <div class="cols" style="padding-top:48px">
      <div class="main"><h2>Por día</h2>${dayList(evs)}${S.when === 'semana' && evs.length ? `<div style="padding:28px 0"><button class="btn ghost" data-when="todo">Ver el resto del mes ↓</button></div>` : ''}</div>
      <div class="rail">${railMundos()}${railOpen()}${railNews()}</div>
    </div>`;
  }

  function vMapa() {
    const evs = filteredEvents();
    const open = cityPlaces().filter(isOpen);
    return `${filtersBar({ mapToggle: true })}
    <div class="split${S.showMap ? ' showmap' : ''}">
      <div class="list">
        <div class="intro"><h2>${S.when === 'hoy' ? 'Hoy' : S.when === 'finde' ? 'Este finde' : 'Esta semana'} en ${CITIES[S.city].name}</h2><span class="mute" style="font-size:14px">${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'} · ${open.length} ${open.length === 1 ? 'lugar abierto' : 'lugares abiertos'} ahora</span></div>
        ${dayList(evs)}
        ${open.length ? `<div class="day"><span>Lugares abiertos ahora</span><em>${open.length}</em></div>${open.map(p => `<article class="row" data-go="lugar/${p.id}" data-pl="${p.id}"><div class="time">${p.hours.o}–${(p.hours.c % 24).toString().padStart(2, '0')}</div>${thumb(p.mundo, p.id)}<div class="body"><div class="meta"><i class="dot c-${p.mundo}"></i>${esc(p.type)}</div><h3>${esc(p.name)}</h3><div class="venue">${esc(p.barrio)} · ${esc(p.system)}</div></div><div class="right"><div class="status yes"><i></i>Abierto</div></div></article>`).join('')}` : ''}
      </div>
      <div class="mapwrap"><div id="map"></div><div class="legend">${ORDER.map(k => `<div><i class="dot c-${k}"></i>${MUNDOS[k].name}</div>`).join('')}<hr><div><i class="ring"></i>Lugar</div><div><i class="dot"></i>Con evento en la fecha</div></div></div>
    </div>`;
  }

  function vLugares() {
    const ps = filteredPlaces();
    return `${filtersBar({ when: false, open: true })}
    <div class="hero"><h1>Lugares de escucha</h1><p>${cityPlaces().length} sitios en ${CITIES[S.city].name} donde el plan es escuchar. Los bares abren aunque no haya evento.</p></div>
    <div class="section" style="padding-top:40px">${ps.length ? `<div class="vgrid">${ps.map(vcard).join('')}</div>` : '<p class="empty">Nada con estos filtros.</p>'}</div>`;
  }

  function vLugar(id) {
    const p = placeById[id]; if (!p) return notFound();
    const open = isOpen(p); const evs = EVENTS.filter(e => e.place === id).sort((a, b) => a.d - b.d);
    const fol = S.following.has('p:' + id);
    return `${pic(p, p.mundo, p.id + 'hero', 1440, 420, 1.4, 'hero-art')}
    <div class="detail">
      <div class="main">
        <div class="sec" style="gap:14px">${mundoMeta(p, p.type)}<h1>${esc(p.name)}</h1>
          <div class="when">${esc(p.barrio)}, ${CITIES[p.city].name} · ${p.hours ? esc(p.hours.label) + ` · <span class="status${open ? ' yes' : ''}"><i></i>${open ? 'Abierto ahora' : 'Cerrado ahora'}</span>` : 'Abre solo para eventos'}</div>
          <div class="actions"><button class="btn${fol ? ' on' : ''}" data-follow="p:${id}">${fol ? 'Siguiendo' : 'Seguir'} · ${(p.followers + (fol ? 1 : 0)).toLocaleString('es')}</button>${saveBtn('p:' + id)}<button class="iconbtn" data-share="${id}">${ICON.share}</button></div>
        </div>
        <div class="sec"><div class="meta">Sistema de sonido</div>${p.sys.length ? `<div class="kvgrid">${p.sys.map(([k, v]) => `<div class="kv"><small>${esc(k)}</small><span>${esc(v)}</span></div>`).join('')}</div>` : `<p class="p">Sin confirmar todavía. ${p.url ? `<a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">Ver el lugar en la fuente ↗</a>. ` : ''}Si es tu local, reclama la ficha y cuéntanos qué suena aquí.</p>`}</div>
        <div class="sec"><div class="meta">Cómo se escucha aquí</div><div class="kvgrid"><div class="kv"><small>Postura</small><span>${POSTURA[p.postura]}</span></div><div class="kv"><small>Conversación</small><span>${CHARLA[p.charla]}</span></div></div></div>
        <div class="sec"><div class="meta">El lugar</div><p class="p">${esc(p.desc)}</p></div>
        <div class="sec"><div class="meta">Próximas fechas</div>${evs.length ? dayList(evs, { hidePlace: true }) : `<p class="p">No hay fechas especiales publicadas.${p.hours ? ' El bar abre en su horario habitual.' : ''}</p>`}</div>
      </div>
      <div class="rail">
        <div class="art" style="height:220px;width:100%;border-radius:8px" id="minimap" data-ll="${p.ll.join(',')}" data-c="${MUNDOS[p.mundo].color}"></div>
        <div class="box"><div class="kv"><small>Dirección</small><span>${esc(p.addr)}</span></div><div class="kv"><small>Horario</small><span>${p.hours ? esc(p.hours.label) : 'Solo con evento'}</span></div>${p.org ? `<div class="kv"><small>Programa</small><span data-go="org/${p.org}" class="link" style="font-size:15px">${esc(ORGS[p.org].name)}</span></div>` : ''}<button class="btn" data-toast="Abriría la app de mapas">Cómo llegar</button><span class="faint" style="font-size:12px">¿Es tu local? <a class="link" href="#/enviar">Reclama la ficha</a>.</span></div>
      </div>
    </div>`;
  }

  function vEvento(id) {
    const e = evById[id]; if (!e) return notFound();
    const p = placeById[e.place]; const out = soldOut(e); const org = e.org ? ORGS[e.org] : null;
    const waiting = S.wait.has(id);
    const tiers = e.tickets ? `<div class="tiers">${e.tickets.map((t, i) => `<div class="tier${t.left === 0 ? ' out' : ''}${i === 0 && t.left ? ' on' : ''}" data-tier="${i}"><div class="body"><b>${esc(t.name)}</b><small>${t.left === 0 ? 'Agotado' : t.left <= 5 ? `Quedan ${t.left}` : 'Gastos incluidos'}</small></div><div class="tprice">${t.price} €</div></div>`).join('')}</div>` : '';
    const cta = out
      ? `<div class="wl"><b>Agotado.</b> Apúntate a la lista de espera y te avisamos si se libera una plaza. Sin compromiso.</div><button class="btn primary block" data-wait="${id}">${waiting ? 'En la lista de espera ✓' : 'Lista de espera'}</button>`
      : e.url ? `<div class="kv"><small>Precio</small><span>${priceLabel(e)}</span></div><a class="btn primary block" href="${esc(e.url)}" target="_blank" rel="noopener">${e.ticketed ? 'Entradas e info' : 'Más información'} · ${e.source === 'ra' ? 'RA' : 'fuente'} ↗</a><button class="btn block" data-rsvp="${id}">${S.orders.some(o => o.ev === id) ? 'Vas a ir ✓' : 'Voy a ir'}</button><span class="fee">Las entradas se compran en la web del organizador. Nosotros solo enlazamos.</span>`
      : e.tickets ? `${tiers}<button class="btn primary block" data-go="compra/${id}">Comprar · desde ${priceLabel(e)}</button><span class="fee">El precio incluye gastos. Sin sorpresas al final.</span>`
      : `<div class="kv"><small>Precio</small><span>Entrada libre${e.aforo ? ` · ${e.aforo} plazas` : ''}</span></div><button class="btn primary block" data-rsvp="${id}">${S.orders.some(o => o.ev === id) ? 'Vas a ir ✓' : 'Voy a ir'}</button><span class="fee">No hace falta entrada. Decir que vas ayuda a la sala a calcular el aforo.</span>`;
    const good = [['Duración', e.dur || 'Sin confirmar'], ['Puertas', `${e.t} · se recomienda llegar 10 min antes`], ['Edad', e.age || 'Consultar con la sala'], ['Entradas', e.tickets ? 'Nominativas · reembolso hasta 48 h antes' : e.url ? 'En la web del organizador' : 'No hace falta entrada'], e.genres.length ? ['Géneros', e.genres.join(' · ')] : ['Accesibilidad', 'Consultar con la sala'], ['Móvil', 'En silencio durante la escucha']];
    const more = cityEvents().filter(x => x.mundo === e.mundo && x.id !== id).slice(0, 3);
    return `${pic(e, e.mundo, e.id + 'hero', 1440, 420, 1.4, 'hero-art')}
    <div class="detail">
      <div class="main">
        <div class="sec" style="gap:14px">${mundoMeta(e, e.formato)}<h1>${esc(e.title)}</h1>
          <div class="when">${cap(fmtLong.format(dateOf(e.d)))} · ${e.t}${e.dur && /h|noche/.test(e.dur) ? ' → ' + esc(e.dur.replace('Toda la noche · ', '')) : ''}<br><u data-go="lugar/${p.id}">${esc(p.name)}</u> · ${esc(p.barrio)}, ${CITIES[p.city].name}</div>
          <div class="actions">${saveBtn(id)}<button class="iconbtn" data-share="${id}">${ICON.share}</button><button class="btn sm" data-toast="Añadido al calendario (simulado)">Añadir al calendario</button></div>
        </div>
        <div class="sec"><div class="meta">Line-up</div><div class="lineup">${e.lineup.map(a => `<div><div class="avatar">${esc(a.split(' ').map(w => w[0]).join('').slice(0, 2))}</div><span class="grow">${esc(a)}</span>${/abierto|equipo/i.test(a) ? '' : `<button class="btn sm${S.following.has('a:' + a) ? ' on' : ''}" data-follow="a:${esc(a)}">${S.following.has('a:' + a) ? 'Siguiendo' : 'Seguir'}</button>`}</div>`).join('')}</div></div>
        <div class="sec"><div class="meta">Cómo se escucha</div><div class="kvgrid"><div class="kv"><small>Postura</small><span>${POSTURA[e.postura]}</span></div><div class="kv"><small>Conversación</small><span>${CHARLA[e.charla]}</span></div><div class="kv"><small>Duración</small><span>${esc(e.dur)}</span></div><div class="kv"><small>Aforo</small><span>${e.aforo ? e.aforo + ' plazas' : 'Sin límite'}</span></div>${e.trae ? `<div class="kv wide"><small>Qué traer</small><span>${esc(e.trae)}</span></div>` : ''}</div></div>
        <div class="sec"><div class="meta">Qué vas a vivir</div><p class="p">${esc(e.desc)}</p></div>
        <div class="sec"><div class="meta">Bueno saber</div><div class="good">${good.map(([k, v]) => `<div><b>${k}</b><span>${esc(v)}</span></div>`).join('')}</div></div>
        <div class="sec"><div class="meta">El lugar</div><div class="place-card" data-go="lugar/${p.id}">${thumb(p.mundo, p.id)}<div class="body">${mundoMeta(p, p.type)}<h3>${esc(p.name)}</h3><div class="venue">${esc(p.barrio)} · ${esc(p.system)}</div></div><span class="link">Ver lugar</span></div></div>
        ${org ? `<div class="sec"><div class="meta">Organiza</div><div class="org"><div class="avatar">${esc(org.name[0])}</div><div class="body"><b data-go="org/${org.id}" style="cursor:pointer">${esc(org.name)}</b><small>${esc(org.desc)} · ${org.events} eventos</small></div><button class="btn sm${S.following.has('o:' + org.id) ? ' on' : ''}" data-follow="o:${org.id}">${S.following.has('o:' + org.id) ? 'Siguiendo' : 'Seguir'}</button></div></div>` : ''}
        <div class="sec"><span class="link faint" style="font-size:12px" data-toast="Gracias. Lo revisamos.">Reportar este evento</span></div>
      </div>
      <div class="rail">
        <div class="box"><div class="kv"><small>Cuándo</small><span>${shortDate(e.d)} · ${e.t}</span></div><div class="kv"><small>Dónde</small><span>${esc(p.name)}, ${esc(p.barrio)}</span></div>${cta}</div>
        ${more.length ? `<div class="block"><div class="meta">Más ${MUNDOS[e.mundo].name.toLowerCase()} en ${CITIES[S.city].name}</div>${more.map(x => mundoItem(x.mundo, x.title, `${dayLabel(x.d)} · ${x.t} · ${placeById[x.place].name}`, 'evento/' + x.id)).join('')}</div>` : ''}
      </div>
    </div>
    <div class="sticky-cta">${out ? `<button class="btn primary" data-wait="${id}">${waiting ? 'En la lista ✓' : 'Lista de espera'}</button>` : e.url ? `<button class="btn" data-save="${id}">${S.saved.has(id) ? 'Guardado' : 'Guardar'}</button><a class="btn primary" href="${esc(e.url)}" target="_blank" rel="noopener">${e.ticketed ? 'Entradas' : 'Info'} ↗</a>` : e.tickets ? `<button class="btn" data-save="${id}">${S.saved.has(id) ? 'Guardado' : 'Guardar'}</button><button class="btn primary" data-go="compra/${id}">Comprar · ${priceLabel(e)}</button>` : `<button class="btn" data-save="${id}">${S.saved.has(id) ? 'Guardado' : 'Guardar'}</button><button class="btn primary" data-rsvp="${id}">${S.orders.some(o => o.ev === id) ? 'Vas a ir ✓' : 'Voy a ir'}</button>`}</div>`;
  }

  function vCompra(id) {
    const e = evById[id]; if (!e || !e.tickets) return notFound();
    const p = placeById[e.place];
    const c = S.cart && S.cart.ev === id ? S.cart : (S.cart = { ev: id, tier: e.tickets.findIndex(t => t.left > 0), qty: 1 });
    const t = e.tickets[c.tier]; const total = t.price * c.qty;
    return `<div class="check">
      <div><span class="link" data-go="evento/${id}">← Volver al evento</span></div>
      <h1>Entradas</h1>
      <div class="summary">${thumb(e.mundo, e.id)}<div class="body"><b style="font-weight:500">${esc(e.title)}</b><span class="mute" style="font-size:13px">${cap(fmtLong.format(dateOf(e.d)))} · ${e.t} · ${esc(p.name)}</span></div></div>
      <div class="field"><label>Tipo de entrada</label><div class="tiers">${e.tickets.map((x, i) => `<div class="tier${x.left === 0 ? ' out' : ''}${i === c.tier ? ' on' : ''}" data-ctier="${i}"><div class="body"><b>${esc(x.name)}</b><small>${x.left === 0 ? 'Agotado' : x.left <= 5 ? `Quedan ${x.left}` : 'Gastos incluidos'}</small></div><div class="tprice">${x.price} €</div></div>`).join('')}</div></div>
      <div class="field"><label>Cantidad</label><div class="qty"><button data-qty="-1">−</button><span>${c.qty}</span><button data-qty="1">+</button></div><span class="hint">Máximo ${Math.min(4, t.left)} por persona. Son entradas nominativas.</span></div>
      <div class="two"><div class="field"><label>Nombre</label><input class="input" id="f-name" placeholder="Nombre y apellidos" value="${esc(S.user?.name || '')}"></div><div class="field"><label>Correo</label><input class="input" id="f-mail" placeholder="tu@correo.com" value="${esc(S.user?.mail || '')}"></div></div>
      <div class="total"><div class="sum"><span>${c.qty} × ${esc(t.name)}</span><span>${total} €</span></div><div class="sum"><span>Gastos de gestión</span><span>Incluidos</span></div><div class="sum"><span>Total</span><b>${total} €</b></div></div>
      <button class="btn primary block" data-pay="${id}">Pagar ${total} €</button>
      <span class="fee">Prototipo: no se cobra nada. La entrada aparecerá en <a class="link" href="#/yo?tab=entradas">Mis entradas</a>. Reembolso hasta 48 h antes.</span>
    </div>`;
  }

  function vOk(orderId) {
    const o = S.orders.find(x => x.id === orderId); if (!o) return notFound();
    const e = evById[o.ev]; const p = placeById[e.place];
    return `<div class="check"><div class="meta">Listo</div><h1>${o.qty ? 'Ya tienes tu entrada' : 'Apuntado'}</h1><p class="p">${o.qty ? `Te hemos enviado ${o.qty === 1 ? 'la entrada' : 'las entradas'} a ${esc(o.mail || 'tu correo')}. También ${o.qty === 1 ? 'está' : 'están'} en Mis entradas.` : 'Le hemos dicho a la sala que vas. Si al final no puedes, quítalo en Mis entradas.'}</p>${ticketCard(o)}<div class="actions"><button class="btn" data-go="yo?tab=entradas">Mis entradas</button><button class="btn" data-toast="Añadido al calendario (simulado)">Añadir al calendario</button><button class="btn ghost" data-go="">Volver a la agenda</button></div></div>`;
  }
  function ticketCard(o) {
    const e = evById[o.ev]; const p = placeById[e.place];
    const qr = Array.from({ length: 64 }, (_, i) => ((o.id.charCodeAt(i % o.id.length) * (i + 3)) % 7 < 3) ? `<rect x="${(i % 8) * 11}" y="${Math.floor(i / 8) * 11}" width="11" height="11"/>` : '').join('');
    return `<div class="ticket"><div class="top">${mundoMeta(e, e.formato)}<b style="font-weight:500;font-size:18px;line-height:1.25">${esc(e.title)}</b><span class="mute" style="font-size:13px">${cap(fmtLong.format(dateOf(e.d)))} · ${e.t} · ${esc(p.name)}, ${esc(p.barrio)}</span></div><div class="bottom"><div class="qr"><svg viewBox="0 0 88 88" fill="#303D41">${qr}</svg></div><div class="body"><b>${o.qty ? `${o.qty} × ${esc(o.tier)}` : 'Entrada libre · voy a ir'}</b><span>${esc(o.name || 'Sin nombre')}</span><span class="mono">${o.id}</span></div></div></div>`;
  }

  function vMundos() {
    return `<div class="hero"><h1>Los cuatro mundos</h1><p>Un gradiente de la oreja al cuerpo. A la izquierda escuchas la música. A la derecha dejas que el sonido te atraviese.</p></div>
    <div class="worlds" style="padding-top:40px">${ORDER.map(k => { const n = cityEvents().filter(e => e.mundo === k && e.d <= 6).length; return `<div class="wcard c-${k}" data-go="mundo/${k}"><div class="meta t-${k}"><i class="dot c-${k}"></i>${MUNDOS[k].formatos.join(' · ')}</div><h3>${MUNDOS[k].name}</h3><p>${MUNDOS[k].desc}</p><span class="n">${n} esta semana · ${cityPlaces().filter(p => p.mundo === k).length} lugares</span></div>`; }).join('')}</div>`;
  }

  function vMundo(k) {
    const m = MUNDOS[k]; if (!m) return notFound();
    const evs = cityEvents().filter(e => e.mundo === k && (!S.postura || e.postura === S.postura) && (!S.fmt || e.formato === S.fmt));
    const ps = cityPlaces().filter(p => p.mundo === k);
    const idx = ORDER.indexOf(k);
    return `<div class="world-hero c-${k}"><div class="meta t-${k}"><i class="dot c-${k}"></i>Mundo ${idx + 1} de 4 · ${CITIES[S.city].name}</div><h1>${m.name}</h1><p class="p">${m.desc}</p><div class="group" style="flex-wrap:wrap">${chip('Todo', !S.fmt, 'data-fmt=""')}${m.formatos.map(f => chip(f, S.fmt === f, `data-fmt="${f}"`)).join('')}</div></div>
    ${evs.filter(e => e.featured).length ? `<div class="section" style="padding-top:48px"><div class="h-row"><h2>Esta semana</h2></div><div class="feat">${evs.filter(e => e.featured).slice(0, 4).map(fcard).join('')}</div></div>` : ''}
    <div class="cols" style="padding-top:56px">
      <div class="main"><h2>Lugares de este mundo</h2><div class="vgrid" style="margin-top:20px">${ps.map(vcard).join('')}</div><div style="margin-top:56px"><h2>Agenda</h2>${dayList(evs)}</div></div>
      <div class="rail">${k === 'cuerpo' ? '<div class="box"><div class="meta">Antes de ir</div><p style="font-size:14px;line-height:1.6;color:rgba(238,241,238,.75)">Ropa cómoda, llegar diez minutos antes y el móvil en silencio. Casi siempre hay esterillas y mantas, pero la ficha de cada sesión lo dice.</p></div>' : k === 'escucha' ? '<div class="box"><div class="meta">Cómo funciona</div><p style="font-size:14px;line-height:1.6;color:rgba(238,241,238,.75)">Los bares abren en su horario aunque no haya evento. Entre disco y disco se habla; durante el disco, no.</p></div>' : ''}<div class="block"><div class="meta">Los otros mundos</div>${ORDER.filter(x => x !== k).map(x => mundoItem(x, MUNDOS[x].name, MUNDOS[x].short, 'mundo/' + x)).join('')}</div></div>
    </div>`;
  }

  function vOrg(id) {
    const o = ORGS[id]; if (!o) return notFound();
    const evs = EVENTS.filter(e => e.org === id).sort((a, b) => a.d - b.d);
    const fol = S.following.has('o:' + id);
    return `<div class="hero"><div class="meta">Organizador</div><h1>${esc(o.name)}</h1><p>${esc(o.desc)} · ${o.events} eventos · ${(o.followers + (fol ? 1 : 0)).toLocaleString('es')} siguiendo</p><div class="actions"><button class="btn${fol ? ' on' : ''}" data-follow="o:${id}">${fol ? 'Siguiendo' : 'Seguir'}</button></div></div>
    <div class="cols" style="padding-top:40px"><div class="main"><h2>Próximos eventos</h2>${dayList(evs, { date: true })}</div><div class="rail">${railMundos()}</div></div>`;
  }

  function vBuscar(q) {
    const s = (q || '').trim().toLowerCase();
    const evs = s ? EVENTS.filter(e => [e.title, e.formato, ...e.lineup, placeById[e.place].name, placeById[e.place].barrio].join(' ').toLowerCase().includes(s)) : [];
    const ps = s ? PLACES.filter(p => [p.name, p.type, p.barrio, p.system].join(' ').toLowerCase().includes(s)) : [];
    const ms = s ? ORDER.filter(k => (MUNDOS[k].name + ' ' + MUNDOS[k].formatos.join(' ')).toLowerCase().includes(s)) : [];
    return `<div class="hero"><div class="meta">Buscar</div><h1 style="font-size:40px">${s ? `“${esc(q)}”` : 'Escribe algo'}</h1><p>${evs.length} eventos · ${ps.length} lugares${ms.length ? ' · ' + ms.length + ' mundos' : ''}</p></div>
    <div class="cols" style="padding-top:32px"><div class="main">${ms.length ? `<div class="block" style="margin-bottom:32px"><div class="meta">Mundos</div>${ms.map(k => mundoItem(k, MUNDOS[k].name, MUNDOS[k].short, 'mundo/' + k)).join('')}</div>` : ''}${ps.length ? `<h2>Lugares</h2><div class="vgrid" style="margin:20px 0 40px">${ps.map(vcard).join('')}</div>` : ''}${evs.length ? `<h2>Eventos</h2>${dayList(evs.sort((a, b) => a.d - b.d), { date: true })}` : s ? '<p class="empty">Ningún evento con ese nombre. Prueba con un artista, un lugar o un barrio.</p>' : ''}</div><div class="rail">${railMundos()}</div></div>`;
  }

  function vYo(tab) {
    S.yoTab = tab || S.yoTab;
    const saved = [...S.saved]; const evs = saved.filter(i => evById[i]).map(i => evById[i]).sort((a, b) => a.d - b.d); const ps = saved.filter(i => i.startsWith('p:')).map(i => placeById[i.slice(2)]).filter(Boolean);
    const wait = [...S.wait].map(i => evById[i]).filter(Boolean);
    const fol = [...S.following];
    const body = S.yoTab === 'entradas'
      ? (S.orders.length ? `<div style="display:flex;flex-direction:column;gap:16px;padding-top:24px">${S.orders.slice().reverse().map(o => `<div style="display:flex;flex-direction:column;gap:8px">${ticketCard(o)}<div class="actions"><button class="btn sm ghost" data-cancel="${o.id}">${o.qty ? 'Pedir reembolso' : 'Ya no voy'}</button></div></div>`).join('')}</div>` : '<p class="empty">Aún no tienes entradas. Cuando compres una o digas que vas a un evento, aparecerá aquí con su código.</p>')
      : S.yoTab === 'espera'
      ? (wait.length ? dayList(wait, { date: true }) : '<p class="empty">No estás en ninguna lista de espera. Cuando un evento se agota puedes apuntarte y te avisamos si se libera una plaza.</p>')
      : S.yoTab === 'siguiendo'
      ? (fol.length ? `<div class="block" style="padding-top:8px">${fol.map(f => { const [t, v] = [f.slice(0, 1), f.slice(2)]; const label = t === 'p' ? placeById[v]?.name : t === 'o' ? ORGS[v]?.name : v; const sub = t === 'p' ? 'Lugar' : t === 'o' ? 'Organizador' : 'Artista'; const href = t === 'p' ? 'lugar/' + v : t === 'o' ? 'org/' + v : 'buscar?q=' + encodeURIComponent(v); return `<div class="mundo-item" data-go="${href}"><div class="bar"></div><div style="flex:1"><b>${esc(label || v)}</b><small>${sub}</small></div><button class="btn sm on" data-follow="${esc(f)}">Siguiendo</button></div>`; }).join('')}</div>` : '<p class="empty">Sigue a artistas, lugares y organizadores para enterarte cuando publiquen algo nuevo.</p>')
      : (evs.length || ps.length ? `${ps.length ? `<div class="vgrid" style="margin:24px 0 32px">${ps.map(vcard).join('')}</div>` : ''}${evs.length ? dayList(evs, { date: true }) : ''}` : '<p class="empty">Nada guardado todavía. Toca el corazón en cualquier evento o lugar y lo tendrás aquí.</p>');
    return `<div class="hero"><h1>Tu escucha</h1><p>Guardados, entradas y a quién sigues. Todo se guarda en este navegador.</p></div>
    <div class="section" style="padding-top:32px"><div class="tabs">${[['guardados', `Guardados · ${saved.length}`], ['entradas', `Mis entradas · ${S.orders.length}`], ['espera', `Lista de espera · ${wait.length}`], ['siguiendo', `Siguiendo · ${fol.length}`]].map(([k, l]) => `<button class="${S.yoTab === k ? 'on' : ''}" data-yotab="${k}">${l}</button>`).join('')}</div>${body}</div>`;
  }

  function vEnviar() {
    const f = S.form; const step = f.step;
    const steps = ['Qué es', 'Cuándo y dónde', 'Cómo se escucha', 'Revisar'];
    const stepsBar = `<div class="steps">${steps.map((s, i) => `<span class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}">${i + 1} · ${s}</span>`).join('')}</div>`;
    let body = '';
    if (step === 1) body = `<div class="rule">Si la gente va a bailar, no entra.<br>Si la gente va a escuchar, entra.</div>
      <div class="field"><label>¿En qué mundo encaja?</label><div class="radios">${ORDER.map(k => `<div class="radio${f.mundo === k ? ' on' : ''}" data-fmundo="${k}"><b><i class="dot c-${k}"></i>${MUNDOS[k].name}</b><small>${MUNDOS[k].short}</small></div>`).join('')}</div></div>
      ${f.mundo ? `<div class="field"><label>Formato</label><div class="group" style="flex-wrap:wrap">${MUNDOS[f.mundo].formatos.map(x => chip(x, f.formato === x, `data-fformato="${esc(x)}"`)).join('')}</div></div>` : ''}
      <div class="field"><label>Título</label><input class="input" data-f="title" value="${esc(f.title)}" placeholder="Qué se va a escuchar"></div>
      <div class="field"><label>Qué va a vivir la gente</label><textarea class="input" data-f="desc" placeholder="Describe la experiencia, no lo buena que es la fiesta. Sin promesas médicas.">${esc(f.desc)}</textarea><span class="hint">Lo revisamos antes de publicar. Suele tardar un día.</span></div>`;
    if (step === 2) body = `<div class="field"><label>Lugar</label><select class="input" data-f="place"><option value="">Elige un lugar de ${CITIES[S.city].name}</option>${cityPlaces().map(p => `<option value="${p.id}"${f.place === p.id ? ' selected' : ''}>${esc(p.name)} · ${esc(p.barrio)}</option>`).join('')}</select><span class="hint">¿No está? <span class="link" data-toast="En la versión real podrías dar de alta un lugar nuevo.">Añadir un lugar nuevo</span>.</span></div>
      <div class="two"><div class="field"><label>Día</label><select class="input" data-f="d">${Array.from({ length: 30 }, (_, i) => `<option value="${i}"${+f.d === i ? ' selected' : ''}>${dayLabel(i)} · ${shortDate(i)}</option>`).join('')}</select></div><div class="field"><label>Hora</label><input class="input" data-f="t" value="${esc(f.t)}" placeholder="20:00"></div></div>
      <div class="field"><label>Precio</label><input class="input" data-f="price" value="${esc(f.price)}" placeholder="0 si es entrada libre"><span class="hint">Si pones precio, las entradas se venden aquí con los gastos incluidos y reembolso hasta 48 h antes.</span></div>`;
    if (step === 3) body = `<div class="field"><label>Postura</label><div class="group">${Object.entries(POSTURA).map(([k, l]) => chip(l, f.postura === k, `data-fpostura="${k}"`)).join('')}</div></div>
      <div class="field"><label>Conversación</label><div class="group">${Object.entries(CHARLA).map(([k, l]) => chip(l, f.charla === k, `data-fcharla="${k}"`)).join('')}</div></div>
      <div class="two"><div class="field"><label>Duración</label><input class="input" data-f="dur" value="${esc(f.dur)}" placeholder="90 min"></div><div class="field"><label>Qué traer</label><input class="input" data-f="trae" value="${esc(f.trae)}" placeholder="Esterilla, manta, auriculares…"></div></div>
      <p class="hint" style="font-size:13px;color:var(--mute);line-height:1.5">Esto es lo que diferencia a Listener Advisor: la gente sabe antes de ir si se va a sentar, tumbar o quedar en la barra, y si hay que estar en silencio.</p>`;
    if (step === 4) {
      const fake = { id: 'nuevo', place: f.place || cityPlaces()[0].id, d: +f.d, t: f.t || '20:00', mundo: f.mundo || 'ambient', formato: f.formato || 'Concierto', price: +f.price || 0, title: f.title || 'Sin título', lineup: [], postura: f.postura || 'sentado', charla: f.charla || 'silencio', dur: f.dur || '' };
      body = `<div class="field"><label>Así se verá en la agenda</label><div class="preview">${eventRow(fake)}</div></div>
      <div class="field"><label>Revisión editorial</label><div class="good"><div><b>Regla de entrada</b><span>${f.mundo ? '✓ Encaja en ' + MUNDOS[f.mundo].name : '— Falta elegir mundo'}</span></div><div><b>Cómo se escucha</b><span>${f.postura && f.charla ? '✓ Postura y conversación definidas' : '— Faltan datos del paso 3'}</span></div><div><b>Tono</b><span>${/cura|sana|frecuencia/i.test(f.desc) ? '⚠ Evita promesas médicas o de frecuencias' : '✓ Sin promesas médicas'}</span></div></div></div>`;
    }
    const nav = `<div class="actions" style="justify-content:flex-end">${step > 1 ? '<button class="btn ghost" data-fstep="-1">Atrás</button>' : ''}${step < 4 ? `<button class="btn primary" data-fstep="1">Siguiente · ${steps[step]}</button>` : '<button class="btn primary" data-fsend>Enviar a revisión</button>'}</div>`;
    return `<div class="cols" style="padding-top:56px;gap:96px"><div class="main" style="gap:36px;max-width:720px">${stepsBar}<h1 style="font-size:52px">Enviar un evento</h1><div class="form">${body}${nav}</div></div>
    <div class="rail"><div class="box"><div class="meta">Qué entra</div><p style="font-size:14px;line-height:1.7;color:rgba(238,241,238,.75)">Listening bars, escuchas de disco, conciertos ambient y experimentales, sleep concerts, meetups de modular, sound baths con sonido en directo.</p></div><div class="box" style="background:transparent;border:1px solid rgba(238,241,238,.12)"><div class="meta">Qué no entra</div><p style="font-size:14px;line-height:1.7;color:rgba(238,241,238,.75)">Fiestas y DJ sets para la pista, bares con música de fondo, yoga con una lista de Spotify.</p></div></div></div>`;
  }
  const vEnviado = () => `<div class="check"><div class="meta">Enviado</div><h1>Gracias</h1><p class="p">Lo revisamos y te escribimos en un día. Si encaja, se publica en la agenda de ${CITIES[S.city].name} y en su mundo. Si no, te explicamos por qué.</p><div class="actions"><button class="btn primary" data-go="">Volver a la agenda</button><button class="btn" data-fstep="reset">Enviar otro</button></div></div>`;
  const notFound = () => `<div class="hero"><h1>No está</h1><p>Esta página no existe en el prototipo.</p><a class="btn" href="#/">Volver a la agenda</a></div>`;

  /* ---------- shell ---------- */
  function header(r) {
    const on = n => (r.name === n || (n === 'home' && r.name === 'home') ? ' on' : '');
    return `<a class="brand" href="#/"><div class="logo"><i></i></div><b>Listener Advisor</b></a>
    <form class="search${S.searchOpen ? ' open' : ''}" id="searchform"><button type="button" class="iconbtn" style="border:0;width:28px;height:28px" data-searchtoggle>${ICON.search}</button><input id="q" placeholder="Buscar eventos, artistas, lugares" value="${esc(r.name === 'buscar' ? r.q.q || '' : '')}"><span class="sep"></span><select id="city" aria-label="Ciudad">${Object.entries(CITIES).map(([k, c]) => `<option value="${k}"${S.city === k ? ' selected' : ''}>${c.name}</option>`).join('')}</select></form>
    <nav class="nav"><a href="#/" class="${on('home')}">Agenda</a><a href="#/mapa" class="${on('mapa')}">Mapa</a><a href="#/lugares" class="${on('lugares')}">Lugares</a><a href="#/mundos" class="${on('mundos') || on('mundo')}">Mundos</a><a href="#/yo" class="${on('yo')}">Tú</a></nav>
    <a class="btn submit" href="#/enviar">Enviar evento</a>`;
  }
  const footer = () => `<div class="fc"><b>Listener Advisor</b><span>Música para escuchar, no para bailar.</span><span class="faint">Prototipo${typeof LA.GENERATED !== 'undefined' ? ` · ${LA.GENERATED.events} eventos y ${LA.GENERATED.places} lugares desde Resident Advisor y datos abiertos, clasificados automáticamente · actualizado ${LA.GENERATED.at}` : ' · todos los lugares y eventos son inventados'}</span></div><div class="cols2"><div class="fc"><b>Ciudades</b>${Object.entries(CITIES).map(([k, c]) => `<a href="#/" data-city="${k}">${c.name}</a>`).join('')}<span class="faint">Lisboa · pronto</span></div><div class="fc"><b>Mundos</b>${ORDER.map(k => `<a href="#/mundo/${k}">${MUNDOS[k].name}</a>`).join('')}</div><div class="fc"><b>Participa</b><a href="#/enviar">Enviar evento</a><a href="#/enviar">Reclamar un lugar</a><a href="#/" data-toast="Apuntado al boletín (simulado)">Newsletter</a></div></div>`;
  function tabbar(r) {
    const tabs = [['Agenda', ''], ['Mapa', 'mapa'], ['Lugares', 'lugares'], ['Mundos', 'mundos'], ['Yo', 'yo']];
    const cur = r.name === 'home' ? '' : r.name === 'mundo' ? 'mundos' : r.name;
    return tabs.map(([l, h]) => `<a class="tab${cur === h ? ' on' : ''}" href="#/${h}">${ICON.tab[l]}${l}</a>`).join('');
  }

  /* ---------- mapa ---------- */
  let map, layer;
  function initMap() {
    const el = $('#map'); if (!el || typeof L === 'undefined') return;
    const c = CITIES[S.city];
    map = L.map(el, { zoomControl: false }).setView(c.center, c.zoom);
    L.control.zoom({ position: 'topleft' }).addTo(map);
    const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri · HERE · OpenStreetMap', maxZoom: 16 }).addTo(map);
    L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, opacity: .7 }).addTo(map);
    layer = L.layerGroup().addTo(map);
    const evs = filteredEvents(); const byPlace = {}; evs.forEach(e => (byPlace[e.place] ||= []).push(e));
    for (const p of cityPlaces()) {
      const list = byPlace[p.id] || []; const open = isOpen(p); let style, tip;
      if (list.length) { const col = MUNDOS[list[0].mundo].color; style = { radius: 7 + Math.min(list.length, 4) * 1.6, color: col, weight: 2, fillColor: col, fillOpacity: .9 }; tip = `<b>${esc(p.name)}</b> · ${list.length} ${list.length === 1 ? 'evento' : 'eventos'}`; }
      else if (open) { const col = MUNDOS[p.mundo].color; style = { radius: 7, color: col, weight: 2.5, fillColor: col, fillOpacity: .25 }; tip = `<b>${esc(p.name)}</b> · abierto`; }
      else { style = { radius: 4.5, color: 'rgba(238,241,238,.45)', weight: 1.5, fill: false }; tip = esc(p.name); }
      L.circleMarker(p.ll, style).bindTooltip(tip, { direction: 'top', offset: [0, -6] }).on('click', () => go(list.length === 1 ? 'evento/' + list[0].id : 'lugar/' + p.id)).addTo(layer);
    }
  }
  function initMiniMap() {
    const el = $('#minimap'); if (!el || typeof L === 'undefined') return;
    const ll = el.dataset.ll.split(',').map(Number);
    const m = L.map(el, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, attributionControl: false }).setView(ll, 15);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16 }).addTo(m);
    L.circleMarker(ll, { radius: 8, color: el.dataset.c, weight: 2.5, fillColor: el.dataset.c, fillOpacity: .9 }).addTo(m);
  }

  /* ---------- render ---------- */
  function render() {
    const r = route();
    if (map) { map.remove(); map = null; }
    $('#header').innerHTML = header(r);
    $('#tabbar').innerHTML = tabbar(r);
    $('#footer').innerHTML = footer();
    const views = { home: vHome, mapa: vMapa, lugares: vLugares, lugar: () => vLugar(r.id), evento: () => vEvento(r.id), compra: () => vCompra(r.id), ok: () => vOk(r.id), mundos: vMundos, mundo: () => vMundo(r.id), org: () => vOrg(r.id), buscar: () => vBuscar(r.q.q), yo: () => vYo(r.q.tab), enviar: () => S.form.sent ? vEnviado() : vEnviar() };
    $('#app').innerHTML = (views[r.name] || notFound)();
    document.title = 'Listener Advisor' + (r.name !== 'home' ? ' · ' + cap(r.name) : '');
    if (r.name === 'mapa') initMap();
    if (r.name === 'lugar') initMiniMap();
    if (!render.keepScroll) window.scrollTo(0, 0);
    render.keepScroll = false;
  }
  const rerender = () => { render.keepScroll = true; render(); };

  /* ---------- interacción ---------- */
  let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); };
  const toggle = (set, id) => { set.has(id) ? set.delete(id) : set.add(id); persist(); return set.has(id); };

  document.addEventListener('click', e => {
    const t = e.target;
    const d = sel => t.closest(sel);
    let b;
    if ((b = d('[data-save]'))) { e.preventDefault(); e.stopPropagation(); const on = toggle(S.saved, b.dataset.save); toast(on ? 'Guardado en Tú → Guardados' : 'Quitado de guardados'); rerender(); return; }
    if ((b = d('[data-follow]'))) { e.preventDefault(); e.stopPropagation(); const on = toggle(S.following, b.dataset.follow); toast(on ? 'Siguiendo. Te avisamos de lo nuevo.' : 'Has dejado de seguir'); rerender(); return; }
    if ((b = d('[data-wait]'))) { e.stopPropagation(); const on = toggle(S.wait, b.dataset.wait); toast(on ? 'En la lista de espera. Te avisamos si se libera una plaza.' : 'Fuera de la lista de espera'); rerender(); return; }
    if ((b = d('[data-rsvp]'))) { e.stopPropagation(); const id = b.dataset.rsvp; const ex = S.orders.find(o => o.ev === id); if (ex) { S.orders = S.orders.filter(o => o !== ex); persist(); toast('Ya no vas'); rerender(); } else { const o = { id: 'LA-' + Math.random().toString(36).slice(2, 8).toUpperCase(), ev: id, qty: 0, name: S.user?.name || '' }; S.orders.push(o); persist(); go('ok/' + o.id); } return; }
    if ((b = d('[data-share]'))) { e.stopPropagation(); openModal(`<h2>Compartir</h2><div class="share"><button data-toast="Enlace copiado">🔗 Copiar enlace</button><button data-toast="Abriría WhatsApp">💬 WhatsApp</button><button data-toast="Abriría Instagram">📷 Instagram</button><button data-toast="Abriría el correo">✉️ Correo</button></div>`); return; }
    if ((b = d('[data-tier]'))) { b.parentElement.querySelectorAll('.tier').forEach(x => x.classList.remove('on')); if (!b.classList.contains('out')) b.classList.add('on'); return; }
    if ((b = d('[data-ctier]'))) { if (b.classList.contains('out')) return; S.cart.tier = +b.dataset.ctier; S.cart.qty = 1; rerender(); return; }
    if ((b = d('[data-qty]'))) { const e2 = evById[S.cart.ev]; const max = Math.min(4, e2.tickets[S.cart.tier].left); S.cart.qty = Math.max(1, Math.min(max, S.cart.qty + +b.dataset.qty)); rerender(); return; }
    if ((b = d('[data-pay]'))) { const e2 = evById[b.dataset.pay]; const name = $('#f-name').value.trim(), mail = $('#f-mail').value.trim(); if (!name || !mail.includes('@')) { toast('Falta el nombre o el correo'); return; } S.user = { name, mail }; const tier = e2.tickets[S.cart.tier]; tier.left -= S.cart.qty; const o = { id: 'LA-' + Math.random().toString(36).slice(2, 8).toUpperCase(), ev: e2.id, qty: S.cart.qty, tier: tier.name, name, mail, total: tier.price * S.cart.qty }; S.orders.push(o); S.cart = null; persist(); go('ok/' + o.id); return; }
    if ((b = d('[data-cancel]'))) { const o = S.orders.find(x => x.id === b.dataset.cancel); if (o) { if (o.qty) { const e2 = evById[o.ev]; const tier = e2.tickets.find(x => x.name === o.tier); if (tier) tier.left += o.qty; } S.orders = S.orders.filter(x => x !== o); persist(); toast(o.qty ? 'Reembolso solicitado (simulado)' : 'Quitado'); rerender(); } return; }
    if ((b = d('[data-yotab]'))) { S.yoTab = b.dataset.yotab; rerender(); return; }
    if ((b = d('[data-when]'))) { S.when = b.dataset.when; rerender(); return; }
    if ((b = d('[data-mundo]'))) { toggle(S.mundos, b.dataset.mundo); rerender(); return; }
    if ((b = d('[data-postura]'))) { S.postura = S.postura === b.dataset.postura ? null : b.dataset.postura; rerender(); return; }
    if ((b = d('[data-open]'))) { S.openNow = !S.openNow; rerender(); return; }
    if ((b = d('[data-fmt]'))) { S.fmt = b.dataset.fmt || null; rerender(); return; }
    if ((b = d('[data-togglemap]'))) { S.showMap = !S.showMap; rerender(); return; }
    if ((b = d('[data-searchtoggle]'))) { if (innerWidth <= 860) { S.searchOpen = !S.searchOpen; rerender(); if (S.searchOpen) $('#q').focus(); } else $('#q').focus(); return; }
    if ((b = d('[data-city]'))) { e.preventDefault(); S.city = b.dataset.city; persist(); go(''); render(); return; }
    if ((b = d('[data-fmundo]'))) { S.form.mundo = b.dataset.fmundo; S.form.formato = null; persist(); rerender(); return; }
    if ((b = d('[data-fformato]'))) { S.form.formato = b.dataset.fformato; persist(); rerender(); return; }
    if ((b = d('[data-fpostura]'))) { S.form.postura = b.dataset.fpostura; persist(); rerender(); return; }
    if ((b = d('[data-fcharla]'))) { S.form.charla = b.dataset.fcharla; persist(); rerender(); return; }
    if ((b = d('[data-fstep]'))) { if (b.dataset.fstep === 'reset') { S.form = { step: 1, mundo: null, formato: null, title: '', desc: '', place: null, d: 2, t: '20:00', price: '', postura: null, charla: null, dur: '', trae: '' }; } else { if (b.dataset.fstep === '1' && S.form.step === 1 && !S.form.mundo) { toast('Elige un mundo para seguir'); return; } S.form.step = Math.max(1, Math.min(4, S.form.step + +b.dataset.fstep)); } persist(); render(); return; }
    if ((b = d('[data-fsend]'))) { S.form.sent = true; persist(); render(); return; }
    if ((b = d('[data-close]')) || t === $('#overlay')) { $('#overlay').classList.remove('open'); return; }
    if ((b = d('[data-toast]'))) { e.preventDefault(); toast(b.dataset.toast); $('#overlay').classList.remove('open'); return; }
    if ((b = d('[data-go]'))) { e.preventDefault(); go(b.dataset.go); return; }
  });
  document.addEventListener('input', e => { const f = e.target.dataset.f; if (f) { S.form[f] = e.target.value; persist(); } });
  document.addEventListener('change', e => { if (e.target.id === 'city') { S.city = e.target.value; persist(); const r = route(); if (['lugar', 'evento', 'org', 'compra', 'ok'].includes(r.name)) go(''); else render(); } const f = e.target.dataset.f; if (f) { S.form[f] = e.target.value; persist(); } });
  document.addEventListener('submit', e => { if (e.target.id === 'searchform') { e.preventDefault(); const q = $('#q').value.trim(); S.searchOpen = false; if (q) go('buscar?q=' + encodeURIComponent(q)); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#overlay').classList.remove('open'); });
  function openModal(html) { $('#overlay').innerHTML = `<div class="modal" role="dialog">${html}<button class="btn ghost" data-close>Cerrar</button></div>`; $('#overlay').classList.add('open'); }

  window.addEventListener('hashchange', render);
  render();
})();
