/* Camada de dados: troque load()/save() por chamadas ao Supabase quando for ligar o banco. */
const KEY = 'brasa:demo:v2', P = (id, name, cat, price, desc) => ({ id, name, cat, price, desc, img: '', on: 1 });
const seed = {
  cfg: { name: 'Brasa Burger', minOrder: 0, estimatedMinutes: 45, phone: '', fee: 6, pin: '1234', open: true }, cats: ['Hambúrgueres', 'Porções', 'Bebidas', 'Sobremesas'],
  extras: [{ n: 'Bacon crocante', p: 5, cat:'Hambúrgueres' }, { n: 'Queijo extra', p: 4, cat:'Hambúrgueres' }, { n: 'Ovo', p: 3, cat:'Hambúrgueres' }, { n: 'Molho da casa', p: 2, cat:'Hambúrgueres' }, { n:'Chocolate', p:5, cat:'Sobremesas' }, { n:'Morango', p:5, cat:'Sobremesas' }, { n:'Paçoca', p:4, cat:'Sobremesas' }, { n:'Coco', p:4, cat:'Sobremesas' }],
  prods: [P(1, 'Clássico da Casa', 'Hambúrgueres', 29.9, 'Blend bovino 160 g, queijo prato, alface, tomate e molho da casa no pão brioche.'),
  P(2, 'Duplo Cheddar', 'Hambúrgueres', 36.9, 'Dois smash de 90 g, cheddar cremoso, cebola caramelizada e picles.'),
  P(3, 'Smash Bacon', 'Hambúrgueres', 34.9, 'Smash prensado na chapa, bacon crocante, queijo e maionese defumada.'),
  P(4, 'Frango Crocante', 'Hambúrgueres', 28.9, 'Filé de frango empanado, alface americana e maionese de ervas.'),
  P(5, 'Batata Rústica', 'Porções', 24.9, 'Batatas com casca, alho e alecrim. Acompanha molho especial.'),
  P(6, 'Anéis de Cebola', 'Porções', 22.9, 'Empanados sequinhos, servidos com molho barbecue.'),
  P(7, 'Limonada Suíça', 'Bebidas', 11, 'Limão siciliano batido com leite condensado e gelo.'),
  P(8, 'Refrigerante Lata', 'Bebidas', 7, 'Lata 350 ml, gelada.'),
  P(9, 'Suco Natural', 'Bebidas', 10, 'Laranja, maracujá ou abacaxi com hortelã.'),
  P(10, 'Brownie com Sorvete', 'Sobremesas', 19.9, 'Brownie de chocolate meio amargo com bola de creme.')], orders: [], coupons: [{ code: 'BEMVINDO10', type: 'pct', val: 10, min: 30, on: 1, used: 0 }]
};
let mem = null;
function load() { try { const r = localStorage.getItem(KEY); if (r) return Object.assign({ coupons: [] }, JSON.parse(r)) } catch (e) { } return mem || structuredClone(seed) }
function save() {
 try { localStorage.setItem(KEY,JSON.stringify(S)); mem=structuredClone(S); $('#sync').textContent='Demonstração • pedidos salvos neste navegador'; return true; }
 catch(e) { $('#sync').textContent='Não foi possível salvar no navegador. Libere espaço ou habilite o armazenamento.';toast('Não foi possível salvar os dados');return false; }
}
let S = structuredClone(seed), cpn = null, last = (() => { try { return +localStorage.getItem(KEY + ':last') || 0 } catch (e) { return 0 } })(), cart = [], cat = 'Todos', tab = 'dash', authed = false, cur = null, pq = 1, loc = null, pimg = '';
const $ = (s, r = document) => r.querySelector(s), brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => parseFloat(String(v || '').replace(',', '.')) || 0, sub = () => cart.reduce((a, i) => a + i.price * i.qty, 0), disc = () => { if (!cpn) return 0; const s = sub(); return s < cpn.min ? 0 : Math.min(s, cpn.type === 'pct' ? s * cpn.val / 100 : cpn.val) };
const hue = n => [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 34 + 6;
const media = p => p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="ph" style="--h:${hue(p.name)}">${esc(p.name[0])}</div>`;
const empty = (t, s) => `<div class="empty"><h3>${t}</h3><p class="mute">${s}</p></div>`;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2800) };
const drawer = o => { $('#drawer').classList.toggle('open', !!o); $('#scrim').classList.toggle('on', !!o) };
const ST = [['novo', 'Novos'], ['preparo', 'Em preparo'], ['pronto', 'Prontos'], ['entrega', 'Saiu para entrega'], ['concluido', 'Concluídos']];
const nxt = o => ({ novo: ['Aceitar e preparar', 'preparo'], preparo: ['Marcar como pronto', 'pronto'], pronto: o.mode === 'entrega' ? ['Saiu para entrega', 'entrega'] : ['Entregue ao cliente', 'concluido'], entrega: ['Concluir entrega', 'concluido'] })[o.st];
function track() {
  const o = S.orders.find(x => x.n === last); if (!o) return ''; const sp = ['novo', 'preparo', 'pronto', ...(o.mode === 'entrega' ? ['entrega'] : []), 'concluido'], i = sp.indexOf(o.st), L = { novo: 'Recebido, aguardando aceite', preparo: 'Em preparo', pronto: o.mode === 'entrega' ? 'Pronto, aguardando saída' : 'Pronto para retirada', entrega: 'Saiu para entrega', concluido: 'Concluído', cancelado: 'Cancelado' };
  return `<div class="track"><b>Pedido #${o.n}</b><span class="tag ${o.st}">${L[o.st]}</span>${i >= 0 ? `<div class="steps">${sp.map((s, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>` : ''}<button class="btn gh sm" data-act="untrack" style="margin-left:auto">Ocultar</button></div>`
}

function store() {
  const cats = ['Todos', ...S.cats], list = S.prods.filter(p => p.on && (cat === 'Todos' || p.cat === cat)), f = S.prods.find(p => p.on);
  return `<div id="trk">${track()}</div>` + `<section class="hero"><div class="wrap hero-in"><div><span class="stat ${S.cfg.open ? '' : 'off'}">${S.cfg.open ? 'Aberto agora' : 'Fechado no momento'}</span><h1>O sabor que acende sua fome.</h1><p>Blend próprio, porções generosas e entrega rápida. Monte seu pedido em poucos toques.</p><button class="btn" data-act="scroll">Ver cardápio</button></div>
 ${f ? `<div class="feat" data-act="open" data-id="${f.id}"><div class="media">${media(f)}</div><div class="fb"><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p><span class="big">${brl(f.price)}</span></div></div>` : ''}</div></section>
 <section class="wrap" id="menu"><div class="sec-h"><h2>Cardápio</h2><div class="chips">${cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-act="cat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
 <div class="grid">${list.map(p => `<article class="card" data-act="open" data-id="${p.id}"><div class="media">${media(p)}</div><div class="cb"><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p><div class="pr"><b>${brl(p.price)}</b><button class="btn sm" data-act="open" data-id="${p.id}">Adicionar</button></div></div></article>`).join('') || empty('Nada por aqui', 'Nenhum item disponível nesta categoria.')}</div></section>
 <footer><div class="wrap">${esc(S.cfg.name)}${S.cfg.phone ? ` | <a href="https://wa.me/${esc(S.cfg.phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">Falar no WhatsApp</a>` : ''}</div></footer>`
}

function productExtras(p) { return Array.isArray(p.extras) ? p.extras : S.extras.filter(x=>x.cat===p.cat); }
function parseExtras(text, category) {
 return text.split('\n').filter(l=>l.trim()).map(l=>{
  const parts=l.split(';'), name=(parts[0]||'').trim(), raw=(parts[1]||'').trim().replace(',','.');
  if(parts.length!==2 || !name || !raw || !Number.isFinite(Number(raw)) || Number(raw)<0) throw Error('Use nome;preço com valor válido e positivo para os adicionais');
  return {n:name,p:Math.round(Number(raw)*100)/100,...(category?{cat:category}:{})};
 });
}
function migrateExtras(state) {
 if(state.extras.some(x=>!x.cat)) {
  const category=state.cats.find(c=>/lanche|hamb/u.test(c.toLowerCase())) || state.cats[0];
  state.extras=state.extras.map(x=>({...x,cat:x.cat||category}));
  if(state.cats.includes('Sobremesas') && !state.extras.some(x=>x.cat==='Sobremesas')) state.extras.push(...structuredClone(seed.extras.filter(x=>x.cat==='Sobremesas')));
 }
 return state;
}
function openProd(id) {
  cur = S.prods.find(x => x.id === id); pq = 1; const p = cur, availableExtras = productExtras(p);
  $('#pm').innerHTML = `<div class="media">${media(p)}</div><div class="pb"><h3>${esc(p.name)}</h3><p class="mute" style="margin:0">${esc(p.desc)}</p>
 ${availableExtras.length ? `<h4>Adicionais</h4>${availableExtras.map((x, i) => `<label class="ck"><input type="checkbox" value="${i}"><span>${esc(x.n)}</span><b>+ ${brl(x.p)}</b></label>`).join('')}` : ''}
 <label>Observação<textarea id="pobs" rows="2" placeholder="Ex.: sem cebola"></textarea></label>
 <div class="pf"><div class="qty"><button data-act="pmm" aria-label="Diminuir">-</button><span id="pq">1</span><button data-act="pmp" aria-label="Aumentar">+</button></div><button class="btn" data-act="add">Adicionar ao pedido</button></div></div>`; $('#pm').showModal()
}

function cartUI() {
  $('#cc').textContent = cart.reduce((a, i) => a + i.qty, 0);
  $('#items').innerHTML = cart.length ? cart.map((i, k) => `<div class="li"><div><b>${esc(i.name)}</b><small>${esc([...i.extras, i.obs].filter(Boolean).join(', '))}</small></div><div class="qty"><button data-act="dec" data-k="${k}" aria-label="Diminuir">-</button><span>${i.qty}</span><button data-act="inc" data-k="${k}" aria-label="Aumentar">+</button></div><b>${brl(i.price * i.qty)}</b></div>`).join('') : '<p class="mute">Seu pedido está vazio. Escolha um item no cardápio.</p>';
  const f = $('#co'), fee = f.elements.mode.value === 'entrega' && cart.length ? num(S.cfg.fee) : 0;
  $('#tot').innerHTML = `<div><span>Subtotal</span><span>${brl(sub())}</span></div>${disc() ? `<div><span>Desconto (${esc(cpn.code)})</span><span>- ${brl(disc())}</span></div>` : ''}<div><span>Taxa de entrega</span><span>${brl(fee)}</span></div><div class="t"><span>Total</span><span>${brl(sub() + fee - disc())}</span></div>`;
  $('#send').disabled = !connected || !cart.length || !S.cfg.open || sub() < (S.cfg.minOrder || 0); $('#send').textContent = S.cfg.open ? 'Enviar pedido' : 'Loja fechada'; $('#addr').hidden = f.elements.mode.value !== 'entrega'
}

/* ---------- Painel ---------- */
function admin() {
  if (!authed) return `<div class="wrap login"><form id="login" class="panel"><h2>Painel</h2><p class="mute" style="margin:0">Digite o PIN de acesso (padrão: 1234).</p><label>PIN<input name="pin" type="password" inputmode="numeric" autofocus></label><button class="btn">Entrar</button></form></div>`;
  const T = [['dash', 'Visão geral'], ['orders', 'Pedidos'], ['hist', 'Histórico'], ['cust', 'Clientes'], ['prods', 'Produtos'], ['coup', 'Cupons'], ['cfg', 'Ajustes']], n = S.orders.filter(o => o.st === 'novo').length;
  return `<div class="adm"><aside class="side">${T.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="tab" data-v="${k}">${l}${k === 'orders' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('')}<button data-act="out">Sair</button></aside><section class="main">${{ dash: vDash, orders: vOrders, hist: vHist, cust: vCust, coup: vCoup, prods: vProds, cfg: vCfg }[tab]()}</section></div>`
}
const dk = d => new Date(d).toLocaleDateString('sv');
function oc(o) {
  const t = new Date(o.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `<div class="ord"><div class="oh"><b>Pedido #${o.n}</b><small>${t}</small></div><div><b>${esc(o.name)}</b> <small>${esc(o.phone)}</small></div>
 <ul>${o.items.map(i => `<li>${i.qty}x ${esc(i.name)}${i.extras.length ? ` (${esc(i.extras.join(', '))})` : ''}${i.obs ? `<br><small>Obs: ${esc(i.obs)}</small>` : ''}</li>`).join('')}</ul>
 <div>${o.mode === 'entrega' ? 'Entrega: ' + esc(o.addr || 'localização enviada') + (o.loc ? ` <a href="https://www.google.com/maps?q=${o.loc.lat},${o.loc.lng}" target="_blank" rel="noopener">Abrir no mapa</a>` : '') : 'Retirada no balcão'}</div>
 <div>${esc(o.pay)}${o.change ? `, troco para ${brl(o.change)} (devolver ${brl(o.change - o.total)})` : ''}</div>${o.obs ? `<div class="mute">Obs: ${esc(o.obs)}</div>` : ''}
 <div class="oh"><b>${brl(o.total)}</b><span class="tag ${o.st}">${stl[o.st]}</span></div>${nxt(o) ? `<button class="btn" data-act="adv" data-id="${o.id}">${nxt(o)[0]}</button>` : ''}<div class="oh"><select data-mv="${o.id}" aria-label="Alterar status do pedido" style="width:auto;flex:1">${[...ST, ['cancelado', 'Cancelado']].map(([k, l]) => `<option value="${k}" ${k === o.st ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn gh sm" data-act="print" data-id="${o.id}">Imprimir</button></div></div>`
}
function vOrders() {
  if (!S.orders.length) return `<h2>Pedidos</h2>` + empty('Nenhum pedido ainda', 'Quando um cliente enviar um pedido pelo site, ele aparece aqui na hora.');
  return `<h2>Pedidos</h2><div class="kan">${ST.map(([k, l]) => { const L = S.orders.filter(o => o.st === k).reverse(); return `<div class="col"><h3>${l} <span class="mute">${L.length}</span></h3>${L.map(oc).join('') || '<p class="mute">Vazio</p>'}</div>` }).join('')}</div>`
}
function vProds() { return `<div class="oh"><h2>Produtos</h2><button class="btn" data-act="pnew">Novo produto</button></div><div class="scroll"><table class="tbl"><thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Status</th><th></th></tr></thead><tbody>${S.prods.map(p => `<tr><td class="th">${media(p)}</td><td><b>${esc(p.name)}</b></td><td>${esc(p.cat)}</td><td>${brl(p.price)}</td><td><button class="btn sm ${p.on ? '' : 'gh'}" data-act="ptog" data-id="${p.id}">${p.on ? 'Ativo' : 'Pausado'}</button></td><td><button class="btn gh sm" data-act="pedit" data-id="${p.id}">Editar</button> <button class="btn gh sm" data-act="pdel" data-id="${p.id}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` }
function vCfg() {
  const c = S.cfg; return `<h2>Ajustes</h2><form id="cf"><label>Nome da lanchonete<input name="name" value="${esc(c.name)}" required></label><label>WhatsApp (com DDD)<input name="phone" value="${esc(c.phone)}" inputmode="tel"></label><label>Pedido mínimo (R$)<input name="minOrder" value="${c.minOrder || 0}" inputmode="decimal"></label><label>Prazo estimado (min)<input name="estimatedMinutes" value="${c.estimatedMinutes || 45}" inputmode="numeric"></label><label>Taxa de entrega (R$)<input name="fee" value="${c.fee}" inputmode="decimal"></label><label>PIN do painel<input name="pin" value="${esc(c.pin)}"></label>
 <label class="ck"><input type="checkbox" name="open" ${c.open ? 'checked' : ''}><span>Loja aberta para pedidos</span></label>
 <label>Categorias (uma por linha)<textarea name="cats" rows="4">${esc(S.cats.join('\n'))}</textarea></label><h3>Adicionais por categoria</h3><p class="mute">Um adicional por linha, no formato nome;preço. Deixe vazio para não oferecer adicionais.</p>${S.cats.map((cat,i)=>`<label>${esc(cat)}<textarea name="extras_${i}" rows="4">${esc(S.extras.filter(x=>x.cat===cat).map(x=>x.n+';'+x.p).join('\n'))}</textarea></label>`).join('')}<button class="btn">Salvar ajustes</button></form>`
}
function pForm(id) {
  const p = S.prods.find(x => x.id === id) || { id: 0, name: '', cat: S.cats[0], price: '', desc: '', img: '' }; pimg = p.img;
  $('#pe').innerHTML = `<form id="pf" class="pb" data-id="${p.id}"><h3>${id ? 'Editar produto' : 'Novo produto'}</h3><label>Nome<input name="name" required value="${esc(p.name)}"></label><label>Categoria<select name="cat">${S.cats.map(c => `<option ${c === p.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label>Preço (R$)<input name="price" required inputmode="decimal" value="${p.price}"></label><label>Descrição<textarea name="desc" rows="2">${esc(p.desc)}</textarea></label><label>Adicionais deste produto<select name="extraMode"><option value="category" ${!Array.isArray(p.extras)?'selected':''}>Usar adicionais da categoria</option><option value="custom" ${Array.isArray(p.extras)&&p.extras.length?'selected':''}>Personalizar este item</option><option value="none" ${Array.isArray(p.extras)&&!p.extras.length?'selected':''}>Sem adicionais</option></select></label><label id="customextras" ${!Array.isArray(p.extras)||!p.extras.length?'hidden':''}>Adicionais específicos (nome;preço)<textarea name="itemExtras" rows="4" placeholder="Bacon;5">${esc((p.extras||[]).map(x=>x.n+';'+x.p).join('\n'))}</textarea></label><label>Foto do produto<input type="file" id="pfile" accept="image/*"></label><label>Ou link da imagem<input name="url" placeholder="https://" value="${p.img && !p.img.startsWith('data:') ? esc(p.img) : ''}"></label><div class="pf"><button type="button" class="btn gh" data-act="pcancel">Cancelar</button><button class="btn">Salvar produto</button></div></form>`; $('#pe').showModal()
}
const readImg = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 900 / im.width), c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); r(c.toDataURL('image/jpeg', .82)) }; im.src = fr.result }; fr.readAsDataURL(f) });

function render() {
  const a = location.hash.startsWith('#/admin');
  const rt = a ? 1 : 0, same = render.r === rt, kn = $('.kan'), sx = same && kn ? kn.scrollLeft : 0, sy = same ? scrollY : 0; render.r = rt; $('#app').innerHTML = a ? admin() : store(); const k2 = $('.kan'); if (k2) k2.scrollLeft = sx; scrollTo(0, sy); $('#nav').innerHTML = a ? '<a href="#/">Ver site</a>' : '<a href="#/admin">Painel de demonstração</a>';
  $('#cartbtn').hidden = a; $('#brand').innerHTML = esc(S.cfg.name) + '<i></i>'; document.title = S.cfg.name; cartUI()
}
const A = {
  cat(t) { cat = t.dataset.v; render() }, scroll() { $('#menu').scrollIntoView({ behavior: 'smooth' }) }, open(t) { openProd(+t.dataset.id) }, cart() { drawer(1) }, close() { drawer(0) },
  inc(t) { cart[+t.dataset.k].qty++; cartUI() }, dec(t) { const k = +t.dataset.k; if (--cart[k].qty < 1) cart.splice(k, 1); cartUI() },
  pmm() { pq = Math.max(1, pq - 1); $('#pq').textContent = pq }, pmp() { pq++; $('#pq').textContent = pq },
  add() {
    const ex = [...$('#pm').querySelectorAll('input:checked')].map(i => productExtras(cur)[+i.value]).filter(Boolean);
    cart.push({ id: cur.id, name: cur.name, price: cur.price + ex.reduce((a, x) => a + x.p, 0), qty: pq, extras: ex.map(x => x.n), obs: $('#pobs').value.trim() }); $('#pm').close(); cartUI(); toast('Adicionado ao pedido')
  },
  geo(t) { if (!navigator.geolocation) return toast('Seu navegador não permite localização'); navigator.geolocation.getCurrentPosition(p => { loc = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }; t.textContent = 'Localização anexada' }, () => toast('Não foi possível obter a localização')) },
  tab(t) { tab = t.dataset.v; render() }, out() { authed = false; render() },
  adv(t) { const o = S.orders.find(x => x.id == t.dataset.id); const n = nxt(o); if (n) o.st = n[1]; save(); render() }, cancel(t) { S.orders.find(x => x.id == t.dataset.id).st = 'cancelado'; save(); render() },
  pnew() { pForm(0) }, pedit(t) { pForm(+t.dataset.id) }, pcancel() { $('#pe').close() },
  ptog(t) { const p = S.prods.find(x => x.id == t.dataset.id); p.on = p.on ? 0 : 1; save(); render() }, pdel(t) { S.prods = S.prods.filter(x => x.id != t.dataset.id); save(); render() }
};
document.addEventListener('click', e => { if (e.target.tagName === 'DIALOG') return e.target.close(); const t = e.target.closest('[data-act]'); if (t) A[t.dataset.act]?.(t) });
document.addEventListener('change', e => {
  const n = e.target;
  if(n.name==='extraMode') $('#customextras').hidden=n.value!=='custom';
  if (n.name === 'pay') $('#chg').hidden = n.value !== 'Dinheiro'; if (n.name === 'mode') cartUI();
  if (n.id === 'pfile' && n.files[0]) readImg(n.files[0]).then(u => { pimg = u; toast('Foto carregada') })
});
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, d = Object.fromEntries(new FormData(f));
  if (f.id === 'co') {
    if (!connected || !cart.length || !S.cfg.open) return toast('Aguarde a conexão ou abertura da loja');
    if (sub() < (S.cfg.minOrder || 0)) return toast('Pedido mínimo de ' + brl(S.cfg.minOrder));
    if (!/^\d{10,13}$/.test(d.phone.replace(/\D/g,''))) return toast('Confira o WhatsApp com DDD');
    const expectedTotal = sub() + (d.mode === 'entrega' ? num(S.cfg.fee) : 0) - disc();
    if (d.pay === 'Dinheiro' && num(d.change) && num(d.change) < expectedTotal) return toast('O valor para troco precisa cobrir o total');
    if (document.activeElement.id === 'cin') return A.cpn(); if (d.mode === 'entrega' && !d.addr && !loc) return toast('Informe o endereço ou use sua localização');
    const fee = d.mode === 'entrega' ? num(S.cfg.fee) : 0, s = sub(), n = Math.max(0, ...S.orders.map(o => o.n)) + 1;
    const previousState=structuredClone(S), previousLast=last;
    S.orders.push({ id: Date.now(), n, at: new Date().toISOString(), name: d.name, phone: d.phone, mode: d.mode, addr: d.addr || '', loc, pay: d.pay, change: num(d.change), obs: d.obs, items: cart, sub: s, fee, disc: disc(), cupom: cpn ? cpn.code : '', total: s + fee - disc(), st: 'novo' });
    if (disc()) cpn.used = (cpn.used || 0) + 1; last = n; try { localStorage.setItem(KEY + ':last', n) } catch (e) { } if(!save()){S=previousState;last=previousLast;try{localStorage.setItem(KEY+':last',last)}catch{}return;} cart = []; loc = null; cpn = null; f.reset(); $('#chg').hidden = true; drawer(0); cartUI(); toast('Pedido #' + n + ' enviado para a cozinha'); const k = $('#trk'); if (k) k.innerHTML = track()
  }
  if (f.id === 'login') { if (d.pin === String(S.cfg.pin)) { authed = true; render() } else toast('PIN incorreto') }
  if (f.id === 'pf') {
    let extras; try {extras=d.extraMode==='category'?null:d.extraMode==='none'?[]:parseExtras(d.itemExtras || '');}catch(err){return toast(err.message);}
    const id = +f.dataset.id, o = { name: d.name, cat: d.cat, price: num(d.price), desc: d.desc, img: d.url || pimg, extras };
    if (id) Object.assign(S.prods.find(x => x.id === id), o); else S.prods.push({ id: Date.now(), on: 1, ...o }); save(); $('#pe').close(); render(); toast('Produto salvo')
  }
  if (f.id === 'cf') {
    let updatedExtras;
    try { updatedExtras=S.cats.flatMap((cat,i)=>parseExtras(d['extras_'+i] || '',cat)); } catch(err) { return toast(err.message); }
    S.cfg = { ...S.cfg, name: d.name, phone: d.phone, fee: Math.max(0,num(d.fee)), minOrder: Math.max(0,num(d.minOrder)), estimatedMinutes: Math.max(1,num(d.estimatedMinutes)), pin: d.pin || '1234', open: !!d.open };
    S.cats = d.cats.split('\n').map(x => x.trim()).filter(Boolean);
    S.extras = updatedExtras.filter(x=>S.cats.includes(x.cat)); save(); render(); toast('Ajustes salvos')
  }
});
window.addEventListener('hashchange', render);
window.addEventListener('storage', e => { if (e.key === KEY) { const n = S.orders.length; S = load(); if (S.orders.length > n && authed) beep(); if (location.hash.startsWith('#/admin') && authed && ['dash', 'orders', 'hist', 'cust'].includes(tab)) render(); const k = $('#trk'); if (k) k.innerHTML = track() } });
/* Painel completo: visão geral com períodos, histórico, clientes, cupons, impressão */
let per = 1, hq = '', hs = 'all';
const stl = { ...Object.fromEntries(ST), cancelado: 'Cancelado' }, sum = a => a.reduce((x, o) => x + o.total, 0);
const keys = (n, off = 0) => [...Array(n)].map((_, i) => dk(Date.now() - (off * n + i) * 864e5)), inK = ks => S.orders.filter(o => o.st !== 'cancelado' && ks.includes(dk(o.at)));
const bars = s => { const m = Math.max(1, ...s.map(d => d.v)); return `<div class="bars ${s.length > 10 ? 'dense' : ''}">${s.map(d => `<div title="${esc(d.t)}"><i style="height:${d.v / m * 100}%"></i>${d.l}</div>`).join('')}</div>` };
const hb = (a, f) => { const m = Math.max(1, ...a.map(x => x[1])); return a.length ? a.map(([n, v]) => `<div class="hb"><span>${esc(n)}</span><div><i style="width:${v / m * 100}%"></i></div><b>${f(v)}</b></div>`).join('') : '<p class="mute">Sem dados no período.</p>' };
const grp = (L, k, g) => Object.entries(L.reduce((m, o) => (m[k(o)] = (m[k(o)] || 0) + g(o), m), {})).sort((a, b) => b[1] - a[1]);
const beep = () => { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + .25) } catch (e) { } };
function vDash() {
  const ks = keys(per), L = inK(ks), rev = sum(L), prev = sum(inK(keys(per, 1))), cn = S.orders.filter(o => o.st === 'cancelado' && ks.includes(dk(o.at))).length, dv = prev ? Math.round((rev - prev) / prev * 100) : null;
  const ser = per === 1 ? [...Array(24)].map((_, h) => { const v = sum(L.filter(o => new Date(o.at).getHours() === h)); return { l: h % 4 ? '' : h + 'h', v, t: h + 'h: ' + brl(v) } }) : [...ks].reverse().map((k, i, a) => { const v = sum(L.filter(o => dk(o.at) === k)); return { l: i % Math.ceil(a.length / 7) ? '' : k.slice(8), v, t: k + ': ' + brl(v) } });
  return `<div class="oh"><h2>Visão geral</h2><div class="chips">${[[1, 'Hoje'], [7, '7 dias'], [30, '30 dias']].map(([k, l]) => `<button class="chip ${k === per ? 'on' : ''}" data-act="per" data-v="${k}">${l}</button>`).join('')}<button class="btn sm ${S.cfg.open ? '' : 'gh'}" data-act="tog">${S.cfg.open ? 'Loja aberta' : 'Loja fechada'}</button></div></div>
 <div class="kpis"><div class="kpi"><small>Faturamento</small><b>${brl(rev)}</b><small ${dv === null ? '' : `style="color:var(--${dv >= 0 ? 'ok' : 'bad'})"`}>${dv === null ? 'Sem período anterior' : (dv >= 0 ? '+' : '') + dv + '% vs período anterior'}</small></div><div class="kpi"><small>Pedidos</small><b>${L.length}</b></div><div class="kpi"><small>Ticket médio</small><b>${brl(L.length ? rev / L.length : 0)}</b></div><div class="kpi"><small>Cancelados</small><b>${cn}</b></div><div class="kpi"><small>Aguardando aceite</small><b>${S.orders.filter(o => o.st === 'novo').length}</b></div></div>
 <div class="two"><div class="panel"><h3>Faturamento ${per === 1 ? 'por hora' : 'por dia'}</h3>${bars(ser)}</div><div class="panel"><h3>Formas de pagamento</h3>${hb(grp(L, o => o.pay, o => o.total), brl)}<h3 style="margin:20px 0 12px">Tipo de pedido</h3>${hb(grp(L, o => o.mode === 'entrega' ? 'Entrega' : 'Retirada', () => 1), v => v)}</div></div>
 <div class="two"><div class="panel"><h3>Mais vendidos</h3>${hb(grp(L.flatMap(o => o.items), i => i.name, i => i.qty).slice(0, 5), v => v + ' un.')}</div><div class="panel"><h3>Pedidos recentes</h3><ul class="rank">${S.orders.slice(-5).reverse().map(o => `<li><span>#${o.n} ${esc(o.name)}</span><span><span class="tag ${o.st}">${stl[o.st]}</span> <b>${brl(o.total)}</b></span></li>`).join('') || '<li class="mute">Nenhum pedido ainda.</li>'}</ul></div></div>`
}
const hRows = () => { const q = hq.toLowerCase(); return S.orders.filter(o => (hs === 'all' || o.st === hs) && (!q || `#${o.n} ${o.name} ${o.phone}`.toLowerCase().includes(q))).reverse() };
function hTab() { const L = hRows(); return L.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Tipo</th><th>Pagamento</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${L.map(o => `<tr><td><b>#${o.n}</b></td><td>${new Date(o.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${esc(o.name)}<br><small>${esc(o.phone)}</small></td><td>${o.mode === 'entrega' ? 'Entrega' : 'Retirada'}</td><td>${esc(o.pay)}</td><td>${brl(o.total)}</td><td><span class="tag ${o.st}">${stl[o.st]}</span></td><td><button class="btn gh sm" data-act="ver" data-id="${o.id}">Detalhes</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhum pedido encontrado', 'Ajuste a busca ou o filtro de status.') }
function vHist() { return `<div class="oh"><h2>Histórico de pedidos</h2><button class="btn gh" data-act="csv">Exportar CSV</button></div><div class="tools"><input id="hq" placeholder="Buscar por nome, telefone ou número" value="${esc(hq)}"><select id="hs">${[['all', 'Todos os status'], ...Object.entries(stl)].map(([k, l]) => `<option value="${k}" ${k === hs ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div id="htab">${hTab()}</div>` }
function vCust() {
  const m = {}; S.orders.filter(o => o.st !== 'cancelado').forEach(o => { const k = o.phone.replace(/\D/g, '') || o.name, c = m[k] = m[k] || { phone: o.phone, n: 0, t: 0, last: o.at }; c.name = o.name; c.n++; c.t += o.total; if (o.at > c.last) c.last = o.at });
  const L = Object.values(m).sort((a, b) => b.t - a.t), wa = p => { const d = p.replace(/\D/g, ''); return 'https://wa.me/' + (d.length <= 11 ? '55' + d : d) };
  return `<h2>Clientes</h2><div class="kpis"><div class="kpi"><small>Clientes</small><b>${L.length}</b></div><div class="kpi"><small>Recorrentes (2 ou mais pedidos)</small><b>${L.filter(c => c.n > 1).length}</b></div><div class="kpi"><small>Gasto médio por cliente</small><b>${brl(L.length ? L.reduce((a, c) => a + c.t, 0) / L.length : 0)}</b></div></div>` + (L.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Cliente</th><th>Pedidos</th><th>Total gasto</th><th>Ticket médio</th><th>Último pedido</th><th></th></tr></thead><tbody>${L.map(c => `<tr><td><b>${esc(c.name)}</b><br><small>${esc(c.phone)}</small></td><td>${c.n}</td><td>${brl(c.t)}</td><td>${brl(c.t / c.n)}</td><td>${new Date(c.last).toLocaleDateString('pt-BR')}</td><td><a class="btn gh sm" href="${wa(c.phone)}" target="_blank" rel="noopener">Chamar no WhatsApp</a></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhum cliente ainda', 'Os clientes aparecem aqui a partir do primeiro pedido.'))
}
function vCoup() { return `<h2>Cupons de desconto</h2><form id="cpf" class="panel tools"><label>Código<input name="code" placeholder="PROMO10" required></label><label>Tipo<select name="type"><option value="pct">Percentual (%)</option><option value="val">Valor fixo (R$)</option></select></label><label>Valor<input name="val" inputmode="decimal" required></label><label>Pedido mínimo (R$)<input name="min" inputmode="decimal"></label><button class="btn">Criar cupom</button></form>` + (S.coupons.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Usos</th><th>Status</th><th></th></tr></thead><tbody>${S.coupons.map(c => `<tr><td><b>${esc(c.code)}</b></td><td>${c.type === 'pct' ? c.val + '%' : brl(c.val)}</td><td>${brl(c.min)}</td><td>${c.used || 0}</td><td><button class="btn sm ${c.on ? '' : 'gh'}" data-act="ctog" data-v="${esc(c.code)}">${c.on ? 'Ativo' : 'Pausado'}</button></td><td><button class="btn gh sm" data-act="cdel" data-v="${esc(c.code)}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : empty('Nenhum cupom', 'Crie um código de desconto para seus clientes usarem no carrinho.')) }
const tk = o => `<h2>${esc(S.cfg.name)}</h2><p>Pedido #${o.n} - ${new Date(o.at).toLocaleString('pt-BR')}</p><hr>${o.items.map(i => `<p>${i.qty}x ${esc(i.name)} ${brl(i.price * i.qty)}${i.extras.length ? '<br>+ ' + esc(i.extras.join(', ')) : ''}${i.obs ? '<br>Obs: ' + esc(i.obs) : ''}</p>`).join('')}<hr><p>Subtotal ${brl(o.sub)}<br>Entrega ${brl(o.fee)}${o.disc ? '<br>Desconto - ' + brl(o.disc) : ''}<br><b>Total ${brl(o.total)}</b></p><p>Cliente: ${esc(o.name)}<br>${esc(o.phone)}<br>${o.mode === 'entrega' ? esc(o.addr || 'Ver localização no painel') : 'Retirada'}<br>Pagamento: ${esc(o.pay)}${o.change ? ', troco para ' + brl(o.change) : ''}</p>${o.obs ? '<p>Obs: ' + esc(o.obs) + '</p>' : ''}`;
Object.assign(A, {
  per(t) { per = +t.dataset.v; render() }, tog() { S.cfg.open = !S.cfg.open; save(); render() },
  ver(t) { $('#pm').innerHTML = `<div class="pb">${oc(S.orders.find(x => x.id == t.dataset.id))}</div>`; $('#pm').showModal() },
  print(t) { $('#ticket').innerHTML = tk(S.orders.find(x => x.id == t.dataset.id)); window.print() },
  csv() {
    const r = [['Pedido', 'Data', 'Cliente', 'Telefone', 'Tipo', 'Pagamento', 'Subtotal', 'Entrega', 'Desconto', 'Total', 'Status'], ...hRows().map(o => [o.n, new Date(o.at).toLocaleString('pt-BR'), o.name, o.phone, o.mode, o.pay, o.sub, o.fee, o.disc || 0, o.total, stl[o.st]])].map(x => x.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    try { navigator.clipboard.writeText(r) } catch (e) { } const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + r], { type: 'text/csv' })); a.download = 'pedidos.csv'; a.click(); toast('Exportação gerada')
  },
  cpn() { const c = S.coupons.find(x => x.on && x.code === $('#cin').value.trim().toUpperCase()); if (!c) return toast('Cupom inválido ou inativo'); if (sub() < c.min) return toast('Pedido mínimo de ' + brl(c.min) + ' para este cupom'); cpn = c; cartUI(); toast('Cupom aplicado') },
  ctog(t) { const c = S.coupons.find(x => x.code === t.dataset.v); c.on = c.on ? 0 : 1; save(); render() }, cdel(t) { S.coupons = S.coupons.filter(x => x.code !== t.dataset.v); save(); render() }
});
const a0 = A.adv, c0 = A.cancel; A.adv = t => { a0(t); $('#pm').close() }; A.cancel = t => { c0(t); $('#pm').close() };
document.addEventListener('input', e => { if (e.target.id === 'hq') { hq = e.target.value; $('#htab').innerHTML = hTab() } });
document.addEventListener('change', e => { if (e.target.id === 'hs') { hs = e.target.value; $('#htab').innerHTML = hTab() } });
document.addEventListener('change', e => { const m = e.target.dataset.mv; if (!m) return; S.orders.find(x => x.id == m).st = e.target.value; save(); $('#pm').close(); render(); toast('Status atualizado') });
A.untrack = () => { last = 0; try { localStorage.removeItem(KEY + ':last') } catch (e) { } render() };
document.addEventListener('submit', e => { if (e.target.id !== 'cpf') return; const d = Object.fromEntries(new FormData(e.target)), code = d.code.trim().toUpperCase(); if (S.coupons.some(c => c.code === code)) return toast('Já existe um cupom com esse código'); S.coupons.push({ code, type: d.type, val: num(d.val), min: num(d.min), on: 1, used: 0 }); save(); render(); toast('Cupom criado') });

let connected=true;
const photos={Hambúrgueres:'burger',Porções:'fries',Bebidas:'drink',Sobremesas:'brownie'};
seed.prods.forEach(p=>p.img='images/'+(p.id===3?'bacon':p.id===4?'chicken':photos[p.cat])+'.jpg');
S=migrateExtras(load());
render();
