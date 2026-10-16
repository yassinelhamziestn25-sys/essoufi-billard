(function(){
'use strict';
var app=document.getElementById('app');
var S={settings:{brand:'ESSOUFI',lowStock:3},categories:[],products:[],pages:{}};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var fmt=function(n){return new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(Number(n)||0)+' DH'};
var slugify=function(s){return String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')};
var ls={get:function(k){try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
var cart={};try{cart=JSON.parse(ls.get('ess-cart')||'{}')||{}}catch(e){cart={}}
var saveCart=function(){ls.set('ess-cart',JSON.stringify(cart))};
var trail=[location.hash];
var F={q:'',sort:'new',stock:false,page:1};
var sel=null,qty=1,gi=0,drawer=false,navOpen=false,confirmClear=false,notes=[];
var CK={name:'',phone:'',city:'',address:''},ckErr={},ckKey=null,ckRef=null,lastOrder=null;
var PER=12;
var CITIES=['Casablanca','Rabat','Marrakech','Fès','Tanger','Agadir','Meknès','Oujda','Kénitra','Tétouan','Salé','Nador','Béni Mellal','El Jadida','Mohammedia','Laâyoune','Safi','Khouribga','Berkane','Taza','Settat','Larache','Al Hoceïma','Khémisset','Errachidia','Ouarzazate','Dakhla'];

/* ---------- aides ---------- */
var catOf=function(id){return S.categories.find(function(c){return c.id===id})};
var pubs=function(){return S.products.filter(function(p){return p.status==='published'})};
var avs=function(p){return (p.variants||[]).filter(function(v){return v.active})};
var inS=function(v){return Number(v.stock)>0};
var anyStock=function(p){return avs(p).some(inS)};
var findV=function(id){for(var i=0;i<S.products.length;i++){var p=S.products[i];var v=(p.variants||[]).find(function(x){return x.id===id});if(v)return {p:p,v:v}}return null};
var vlabel=function(v){return String(v.label||'Standard')};
var showLabel=function(p,v){return avs(p).length>1||vlabel(v)!=='Standard'};
var priceOf=function(p){var a=avs(p);var s=a.filter(inS);var l=s.length?s:a;if(!l.length)return {min:0,multi:false};var ps=l.map(function(v){return Number(v.price)});var mn=Math.min.apply(null,ps),mx=Math.max.apply(null,ps);return {min:mn,multi:mn!==mx}};
var normPhone=function(s){s=String(s||'').replace(/[\s.\-()]/g,'');var m=s.match(/^(?:\+212|00212|0)([5-7]\d{8})$/);return m?'212'+m[1]:null};
var waLink=function(text){var n=normPhone(S.settings.whatsapp);if(!n)return null;return 'https://wa.me/'+n+'?text='+encodeURIComponent(text)};
var uid=function(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
var setMeta=function(title,desc){document.title=title;var d=document.querySelector('meta[name=description]');if(d&&desc)d.setAttribute('content',desc)};

/* ---------- visuels générés (quand un produit n'a pas encore de photo) ---------- */
var artN=0;
function artKind(p){var c=catOf((p.cats||[])[0]);var n=slugify((c?c.name:'')+' '+p.name);
 if(/queue|cue/.test(n))return 'cue';if(/bille|jeu|ball/.test(n))return 'balls';if(/craie|proced|tip/.test(n))return 'chalk';
 if(/triangle|rack/.test(n))return 'rack';if(/etui|housse|case/.test(n))return 'case';if(/entretien|brosse|tapis/.test(n))return 'brush';if(/table/.test(n))return 'table';return 'balls'}
function ball(cx,cy,r,col,id,num){var g='b'+id;return '<defs><radialGradient id="'+g+'" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="'+col+'"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs><ellipse cx="'+cx+'" cy="'+(cy+r*.95)+'" rx="'+r*.9+'" ry="'+r*.22+'" fill="#000" opacity=".35"/><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+col+'"/><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="url(#'+g+')"/>'+(num?'<circle cx="'+cx+'" cy="'+cy+'" r="'+r*.38+'" fill="#f4f0e4"/><text x="'+cx+'" y="'+(cy+r*.16)+'" font-size="'+r*.5+'" text-anchor="middle" font-family="Georgia,serif" font-weight="700" fill="#111">'+num+'</text>':'')}
function art(p){var k=artKind(p);var id='a'+(++artN);var o='';
 if(k==='cue'){o='<g transform="rotate(-32 200 205)"><polygon points="20,186 250,193 250,207 20,214" fill="#3a2214"/><polygon points="20,186 250,193 250,196 20,190" fill="#6b4226" opacity=".7"/><rect x="48" y="188" width="6" height="24" fill="#C9A45C"/><rect x="62" y="188.4" width="3" height="23" fill="#C9A45C"/><polygon points="250,193 372,197 372,203 250,207" fill="#ecdcb4"/><rect x="372" y="197" width="9" height="6" fill="#e6e6e6"/><rect x="381" y="197.2" width="8" height="5.6" rx="2" fill="#2f6fa8"/></g>'}
 else if(k==='balls'){o=ball(140,170,62,'#b3261e',id+'a')+ball(262,200,62,'#e3b01a',id+'b')+ball(196,274,62,'#161616',id+'c','8')}
 else if(k==='chalk'){o='<g transform="rotate(-12 200 210)"><ellipse cx="200" cy="318" rx="92" ry="14" fill="#000" opacity=".35"/><rect x="128" y="190" width="144" height="124" fill="#caa64e"/><rect x="128" y="190" width="144" height="26" fill="#2f78b8"/><polygon points="128,190 272,190 250,160 150,160" fill="#4a9ad8"/><rect x="128" y="258" width="144" height="5" fill="#8a6a1f"/></g>'}
 else if(k==='rack'){o='<polygon points="200,70 330,310 70,310" fill="none" stroke="#C9A45C" stroke-width="14" stroke-linejoin="round"/>'+ball(200,160,26,'#b3261e',id+'a')+ball(176,208,26,'#e3b01a',id+'b')+ball(224,208,26,'#b3261e',id+'c')+ball(152,256,26,'#b3261e',id+'d')+ball(200,256,26,'#161616',id+'e','8')+ball(248,256,26,'#e3b01a',id+'f')}
 else if(k==='case'){o='<g transform="rotate(-28 200 200)"><rect x="40" y="165" width="320" height="70" rx="34" fill="#2b1a10" stroke="#C9A45C" stroke-width="3"/><rect x="40" y="165" width="320" height="26" rx="13" fill="#fff" opacity=".07"/><rect x="120" y="165" width="10" height="70" fill="#C9A45C"/><rect x="270" y="165" width="10" height="70" fill="#C9A45C"/><circle cx="325" cy="200" r="9" fill="#C9A45C"/></g>'}
 else if(k==='brush'){o='<g transform="rotate(-18 200 200)"><rect x="90" y="160" width="220" height="48" rx="8" fill="#3a2214"/><rect x="90" y="160" width="220" height="14" rx="6" fill="#fff" opacity=".1"/><rect x="100" y="208" width="200" height="34" fill="#d9c79a"/><g stroke="#8d7a4c" stroke-width="2">'+Array.apply(null,Array(18)).map(function(_,i){return '<line x1="'+(106+i*11)+'" y1="208" x2="'+(106+i*11)+'" y2="242"/>'}).join('')+'</g></g>'}
 else{o='<polygon points="70,170 330,170 370,235 30,235" fill="#14583f" stroke="#2b1a10" stroke-width="12" stroke-linejoin="round"/><rect x="38" y="235" width="324" height="22" fill="#3a2214"/><rect x="58" y="257" width="22" height="86" fill="#2b1a10"/><rect x="320" y="257" width="22" height="86" fill="#2b1a10"/>'+ball(150,196,14,'#b3261e',id+'a')+ball(250,205,14,'#e3b01a',id+'b')}
 return '<svg viewBox="0 0 400 400" role="img" aria-label="'+esc(p.name)+'" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="'+id+'" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#1f7655"/><stop offset="1" stop-color="#07201a"/></radialGradient></defs><rect width="400" height="400" fill="url(#'+id+')"/>'+o+'</svg>'}
var img=function(p,i,big){var im=(p.images||[])[i||0];return im?'<img src="'+esc(im.src)+'" alt="'+esc(im.alt||p.name)+'" '+(big?'':'loading="lazy" ')+'width="600" height="600">':art(p)};

/* ---------- panier ---------- */
function lines(){var out=[];Object.keys(cart).forEach(function(vid){var f=findV(vid);var n;
 if(!f||f.p.status!=='published'||!f.v.active){delete cart[vid];n="Un article n'est plus disponible et a été retiré de votre panier.";if(notes.indexOf(n)<0)notes.push(n);return}
 if(!inS(f.v)){delete cart[vid];n=f.p.name+' est épuisé et a été retiré de votre panier.';if(notes.indexOf(n)<0)notes.push(n);return}
 var q=cart[vid];if(q>f.v.stock){q=cart[vid]=Number(f.v.stock);n='Quantité ajustée pour '+f.p.name+' : '+q+' disponible(s).';if(notes.indexOf(n)<0)notes.push(n)}
 out.push({p:f.p,v:f.v,q:q,sub:q*Number(f.v.price)})});saveCart();return out}
var subtotal=function(L){return L.reduce(function(a,l){return a+l.sub},0)};
var cartCount=function(){return S.products.length?lines().reduce(function(a,l){return a+l.q},0):Object.keys(cart).reduce(function(a,k){return a+cart[k]},0)};

/* ---------- gabarits ---------- */
var I={
 truck:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
 star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
 chat:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
 lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
 cart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
 menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'};
function logo(){var b=S.settings.brand||'ESSOUFI';return '<a class="logo" href="#" aria-label="'+esc(b)+', accueil"><b>'+esc(b.toUpperCase())+'</b><span>Billard &amp; accessoires</span></a>'}
function header(r){var cur=function(k){return r===k?' aria-current="page"':''};var n=cartCount();
 return '<header class="top"><div class="wrap">'+logo()+'<nav class="nav'+(navOpen?' open':'')+'" aria-label="Navigation principale"><a href="#boutique"'+cur('boutique')+'>Boutique</a>'+S.categories.filter(function(c){return c.active}).slice(0,3).map(function(c){return '<a href="#c-'+esc(c.id)+'"'+(r==='c-'+c.id?' aria-current="page"':'')+'>'+esc(c.name)+'</a>'}).join('')+'<a href="#livraison"'+cur('livraison')+'>Livraison</a><a href="#contact"'+cur('contact')+'>Contact</a></nav>'
 +'<button class="iconbtn" data-act="cart" aria-label="Panier, '+n+' article'+(n>1?'s':'')+'">'+I.cart+(n?'<span class="cnt">'+n+'</span>':'')+'</button><button class="iconbtn burger" data-act="nav" aria-label="Menu" aria-expanded="'+navOpen+'">'+(navOpen?I.close:I.menu)+'</button></div></header>'}
function backbar(r){if(r==='home')return '';return '<div class="backbar"><div class="wrap"><button class="backbtn" data-act="back" aria-label="Retour à la page précédente">'+I.back+'<span>Retour</span></button></div></div>'}
function footer(){var s=S.settings;var b=s.brand||'ESSOUFI';var wa=waLink('Bonjour, j’ai une question.');
 return '<footer class="foot"><div class="wrap"><div class="cols"><div><div class="logo" style="margin-bottom:14px"><b>'+esc(b.toUpperCase())+'</b><span>Billard &amp; accessoires</span></div><p>'+esc(s.footer||'')+'</p></div>'
 +'<div><h3>Boutique</h3><a href="#boutique">Tous les produits</a>'+S.categories.filter(function(c){return c.active}).slice(0,5).map(function(c){return '<a href="#c-'+esc(c.id)+'">'+esc(c.name)+'</a>'}).join('')+'</div>'
 +'<div><h3>Infos</h3><a href="#livraison">Livraison</a><a href="#cgv">Conditions de vente</a><a href="#confidentialite">Confidentialité</a><a href="#contact">Contact</a>'+(wa?'<a href="'+esc(wa)+'" target="_blank" rel="noopener">WhatsApp</a>':'')+(s.phone?'<a href="tel:'+esc(s.phone.replace(/\s/g,''))+'">'+esc(s.phone)+'</a>':'')+'</div></div><div class="copy">© '+new Date().getFullYear()+' '+esc(b)+'. Paiement à la livraison.</div></div></footer>'}
function card(p){var pr=priceOf(p);var out=!anyStock(p);
 return '<a class="pc" href="#p-'+esc(p.slug)+'"><div class="im">'+(out?'<span class="badge out">Épuisé</span>':(p.isNew?'<span class="badge">Nouveau</span>':''))+img(p)+'</div><div class="bd">'+(p.brand?'<span class="br">'+esc(p.brand)+'</span>':'')+'<h3>'+esc(p.name)+'</h3><span class="price">'+(pr.multi?'<small>À partir de</small>':'')+fmt(pr.min)+'</span></div></a>'}
function emptyShop(){return '<div class="empty"><h3>Aucun produit pour le moment</h3><p>La boutique se prépare. Écrivez-nous pour connaître les prochaines arrivées.</p><a class="btn line" href="#contact">Nous contacter</a></div>'}
var TI=[[I.truck,'Livraison partout','Tarif confirmé selon votre ville'],[I.star,'Matériel sélectionné','Des produits choisis un par un'],[I.chat,'Conseil sur WhatsApp','Réponse rapide à vos questions'],[I.lock,'Paiement à la livraison','En espèces, à la réception']];

/* ---------- pages ---------- */
function pageHome(){var P=pubs();var cats=S.categories.filter(function(c){return c.active&&P.some(function(p){return (p.cats||[]).indexOf(c.id)>=0})});
 var feat=P.filter(function(p){return p.featured}).slice(0,8);if(feat.length<4)feat=P.slice(0,8);
 var wa=waLink('Bonjour, j’aimerais des conseils pour choisir mon matériel de billard.');
 return '<section class="hero"><div class="wrap"><div><span class="eyebrow" style="color:var(--gold2)">The essentials of the game</span><h1>Le matériel de billard,<br><em>choisi par des joueurs.</em></h1><p class="lead">Queues, billes, accessoires et entretien du tapis. Commandez en quelques clics, payez à la livraison.</p><div class="acts"><a class="btn gold" href="#boutique">Découvrir la boutique →</a>'+(cats[0]?'<a class="btn ghost" href="#c-'+esc(cats[0].id)+'">'+esc(cats[0].name)+'</a>':'')+'</div></div><div class="frame"><img src="assets/hero.jpg" alt="Table de billard avec queues, billes et accessoires" width="1255" height="832"></div></div></section>'
 +'<div class="tr"><div class="wrap">'+TI.map(function(t){return '<div class="ti">'+t[0]+'<b>'+t[1]+'</b><span>'+t[2]+'</span></div>'}).join('')+'</div></div>'
 +(cats.length?'<section class="sec sand"><div class="wrap"><div class="shead"><div><span class="eyebrow">Univers</span><h2>Nos catégories</h2></div><a class="link" href="#boutique">Tout voir</a></div><div class="cats">'+cats.map(function(c){var n=P.filter(function(p){return (p.cats||[]).indexOf(c.id)>=0}).length;var fake={name:c.name,cats:[c.id],images:[]};
   return '<a class="cat" href="#c-'+esc(c.id)+'">'+art(fake)+'<span>'+esc(c.name)+'<small>'+n+' produit'+(n>1?'s':'')+'</small></span></a>'}).join('')+'</div></div></section>':'')
 +'<section class="sec"><div class="wrap"><div class="shead"><div><span class="eyebrow">Sélection</span><h2>À découvrir</h2></div><a class="link" href="#boutique">Toute la boutique</a></div>'+(feat.length?'<div class="grid">'+feat.map(card).join('')+'</div>':emptyShop())+'</div></section>'
 +'<section class="sec felt"><div class="wrap"><span class="eyebrow">Simple</span><h2>Comment commander</h2><div class="steps"><div class="step"><b>1</b><h3>Choisissez</h3><p>Ajoutez vos produits au panier.</p></div><div class="step"><b>2</b><h3>Validez</h3><p>Nom, téléphone et ville suffisent. Votre commande nous arrive tout de suite.</p></div><div class="step"><b>3</b><h3>Confirmez sur WhatsApp</h3><p>Nous confirmons avec vous la livraison et son tarif. Vous payez à la réception.</p></div></div></div></section>'
 +'<section class="cta"><div class="wrap"><h2>Un conseil pour bien choisir ?</h2><p style="color:#cdc6b0">Queue, poids, procédé : écrivez-nous, nous vous guidons.</p>'+(wa?'<a class="btn gold" href="'+esc(wa)+'" target="_blank" rel="noopener">Écrire sur WhatsApp</a>':'<a class="btn gold" href="#contact">Nous contacter</a>')+'</div></section>'}

function filtered(cat){var P=pubs();var q=slugify(F.q);
 if(cat)P=P.filter(function(p){return (p.cats||[]).indexOf(cat)>=0});
 if(q)P=P.filter(function(p){return slugify(p.name+' '+(p.brand||'')+' '+(p.desc||'')).indexOf(q)>=0});
 if(F.stock)P=P.filter(anyStock);
 var by={new:function(a,b){return (b.createdAt||0)-(a.createdAt||0)},asc:function(a,b){return priceOf(a).min-priceOf(b).min},desc:function(a,b){return priceOf(b).min-priceOf(a).min},name:function(a,b){return a.name.localeCompare(b.name)}}[F.sort];
 return P.slice().sort(by)}
function resultsHtml(cat){var P=filtered(cat);var pages=Math.max(1,Math.ceil(P.length/PER));if(F.page>pages)F.page=pages;var sl=P.slice((F.page-1)*PER,F.page*PER);
 if(!P.length)return '<div class="empty"><h3>'+(S.products.length?'Aucun résultat':'Aucun produit pour le moment')+'</h3><p>'+(S.products.length?'Essayez une autre recherche ou une autre catégorie.':'La boutique se prépare.')+'</p>'+(F.q||F.stock?'<button class="btn line" data-act="reset">Effacer les filtres</button>':'')+'</div>';
 var pg='';if(pages>1){pg='<nav class="pager" aria-label="Pages">';for(var i=1;i<=pages;i++)pg+='<button data-act="page" data-n="'+i+'"'+(i===F.page?' aria-current="true"':'')+'>'+i+'</button>';pg+='</nav>'}
 return '<p class="muted" role="status">'+P.length+' produit'+(P.length>1?'s':'')+'</p><div class="grid">'+sl.map(card).join('')+'</div>'+pg}
var curCat='';
function pageShop(cat){curCat=cat||'';var c=cat?catOf(cat):null;if(cat&&!c)return page404();
 var title=c?c.name:'Boutique';setMeta(title+' | '+S.settings.brand,'Accessoires et matériel de billard : '+title.toLowerCase()+'.');
 var chips='<a class="chip" href="#boutique"'+(!cat?' aria-current="true"':'')+'>Tout</a>'+S.categories.filter(function(x){return x.active}).map(function(x){return '<a class="chip" href="#c-'+esc(x.id)+'"'+(cat===x.id?' aria-current="true"':'')+'>'+esc(x.name)+'</a>'}).join('');
 return '<div class="pagehead"><div class="wrap"><span class="eyebrow">Catalogue</span><h1>'+esc(title)+'</h1><p>'+(c?'Tous nos produits de cette catégorie.':'Tous les accessoires et le matériel de billard.')+'</p></div></div><div class="wrap"><div class="tools"><div class="chips">'+chips+'</div><div class="row2"><input class="in" type="search" placeholder="Rechercher un produit" aria-label="Rechercher" data-flt="q" value="'+esc(F.q)+'"><select class="in" aria-label="Trier" data-flt="sort">'+[['new','Nouveautés'],['asc','Prix croissant'],['desc','Prix décroissant'],['name','Nom A-Z']].map(function(o){return '<option value="'+o[0]+'"'+(F.sort===o[0]?' selected':'')+'>'+o[1]+'</option>'}).join('')+'</select><label class="chip" style="display:inline-flex;align-items:center;gap:8px"><input type="checkbox" data-flt="stock"'+(F.stock?' checked':'')+'> En stock</label></div></div><div id="results" style="padding-bottom:70px">'+resultsHtml(cat)+'</div></div>'}

function pageProduct(slug){var p=S.products.find(function(x){return x.slug===slug&&x.status==='published'});if(!p)return page404();
 setMeta((p.seoTitle||p.name+(p.brand?' - '+p.brand:''))+' | '+S.settings.brand,p.seoDesc||String(p.desc||'').slice(0,155));
 var vs=avs(p);if(!sel&&vs.length===1)sel=vs[0].id;if(sel&&!vs.some(function(v){return v.id===sel}))sel=null;
 var cur=sel?vs.find(function(v){return v.id===sel}):null;var pr=priceOf(p);var c=catOf((p.cats||[])[0]);
 var ims=p.images||[];if(gi>=Math.max(1,ims.length))gi=0;
 var low=Number(S.settings.lowStock)||0;
 var stock='';if(cur){stock=!inS(cur)?'<div class="stock out">Épuisé</div>':(Number(cur.stock)<=low?'<div class="stock low">Plus que '+cur.stock+' en stock</div>':'<div class="stock ok">En stock</div>')}else if(!anyStock(p))stock='<div class="stock out">Épuisé</div>';
 var pills=vs.length>1?'<div class="fld" style="margin-bottom:0"><label>Option</label></div><div class="pills" role="group" aria-label="Option">'+vs.map(function(v){return '<button class="pill" data-act="pickv" data-v="'+esc(v.id)+'" aria-pressed="'+(sel===v.id)+'"'+(inS(v)?'':' disabled')+'>'+esc(vlabel(v))+'<small>'+fmt(v.price)+'</small></button>'}).join('')+'</div>':'';
 var can=cur&&inS(cur);
 return '<div class="wrap"><div class="crumbs"><a href="#">Accueil</a> / <a href="#boutique">Boutique</a>'+(c?' / <a href="#c-'+esc(c.id)+'">'+esc(c.name)+'</a>':'')+' / '+esc(p.name)+'</div><div class="pd"><div class="gal"><div class="main">'+img(p,gi,true)+'</div>'+(ims.length>1?'<div class="thumbs">'+ims.map(function(im,i){return '<button data-act="gi" data-n="'+i+'" aria-label="Photo '+(i+1)+'" aria-current="'+(i===gi)+'"><img src="'+esc(im.src)+'" alt="" loading="lazy"></button>'}).join('')+'</div>':'')+'</div>'
 +'<div>'+(p.brand?'<span class="eyebrow">'+esc(p.brand)+'</span>':'')+'<h1>'+esc(p.name)+'</h1><div class="big">'+(cur?fmt(cur.price):(pr.multi?'<small class="muted" style="font-family:var(--body);font-size:.9rem">À partir de </small>':'')+fmt(pr.min))+'</div>'+(p.desc?'<p>'+esc(p.desc)+'</p>':'')+pills+stock
 +'<div class="buy"><div class="qty"><button data-act="qm" aria-label="Moins">−</button><span aria-live="polite">'+qty+'</span><button data-act="qp" aria-label="Plus">+</button></div><button class="btn gold" data-act="add"'+(can?'':' disabled')+'>'+(cur?(can?'Ajouter au panier':'Épuisé'):'Choisissez une option')+'</button></div>'
 +'<ul class="pts"><li>Paiement à la livraison</li><li>Commande confirmée avec vous sur WhatsApp</li><li>Livraison selon votre ville, tarif confirmé avant l’envoi</li></ul>'
 +(p.notes?'<div class="specs"><h3>Caractéristiques</h3>'+esc(p.notes)+'</div>':'')+'</div></div>'
 +relatedHtml(p)+'</div>'}
function relatedHtml(p){var r=pubs().filter(function(x){return x.id!==p.id&&(x.cats||[]).some(function(c){return (p.cats||[]).indexOf(c)>=0})}).slice(0,4);
 return r.length?'<div style="padding-bottom:70px"><h2>Vous aimerez aussi</h2><div class="grid">'+r.map(card).join('')+'</div></div>':''}

function pageCheckout(){var L=lines();
 if(!L.length)return '<div class="wrap" style="padding-block:72px"><div class="empty"><h3>Votre panier est vide</h3><p>Ajoutez un produit pour passer commande.</p><a class="btn" href="#boutique">Voir la boutique</a></div></div>';
 var sub=subtotal(L);
 var f=function(id,label,input,hint){return '<div class="fld"><label for="'+id+'">'+label+'</label>'+input+(ckErr[id]?'<span class="err" id="'+id+'-e" role="alert">'+ckErr[id]+'</span>':'')+(hint&&!ckErr[id]?'<span class="muted" style="font-size:.84rem">'+hint+'</span>':'')+'</div>'};
 var inv=function(id){return ckErr[id]?' aria-invalid="true" aria-describedby="'+id+'-e"':''};
 return '<div class="pagehead"><div class="wrap"><span class="eyebrow">Commande</span><h1>Finaliser ma commande</h1><p>Trois informations suffisent. Le reste se règle avec vous sur WhatsApp.</p></div></div><div class="wrap co"><form class="form" id="ckform" novalidate>'+(notes.length?'<div class="note warn" role="status">'+notes.map(esc).join('<br>')+'</div>':'')
 +f('ck-name','Nom','<input id="ck-name" class="in" autocomplete="name" data-ck="name" value="'+esc(CK.name)+'"'+inv('ck-name')+'>')
 +f('ck-phone','Téléphone','<input id="ck-phone" class="in" type="tel" inputmode="tel" autocomplete="tel" data-ck="phone" value="'+esc(CK.phone)+'"'+inv('ck-phone')+'>','Exemple : 06 12 34 56 78')
 +f('ck-city','Ville','<input id="ck-city" class="in" list="cities" autocomplete="address-level2" data-ck="city" value="'+esc(CK.city)+'"'+inv('ck-city')+'><datalist id="cities">'+CITIES.map(function(c){return '<option value="'+c+'">'}).join('')+'</datalist>','La livraison et son tarif sont confirmés sur WhatsApp selon votre ville.')
 +f('ck-address','Quartier ou adresse (facultatif)','<input id="ck-address" class="in" autocomplete="street-address" data-ck="address" value="'+esc(CK.address)+'">')
 +'<div class="note"><b>Paiement à la livraison</b><br>Vous réglez en espèces à la réception.</div><button class="btn gold block" type="submit">Valider ma commande</button></form>'
 +'<aside class="sum" aria-label="Récapitulatif"><h2>Votre sélection</h2>'+L.map(function(l){return '<div class="sl"><span>'+l.q+' × '+esc(l.p.name)+(showLabel(l.p,l.v)?'<small>'+esc(vlabel(l.v))+' · '+fmt(l.v.price)+'</small>':'<small>'+fmt(l.v.price)+'</small>')+'</span><span>'+fmt(l.sub)+'</span></div>'}).join('')+'<div class="tot big2"><span>Total articles</span><span>'+fmt(sub)+'</span></div><p class="muted" style="font-size:.88rem;margin-top:10px">Livraison à confirmer sur WhatsApp selon votre ville.</p></aside></div>'}
function orderText(o){var t='*Nouvelle commande '+(S.settings.brand||'')+'*\nRéf : '+o.ref+'\nNom : '+o.name+'\nTél : '+o.phone+'\nVille : '+o.city+'\n'+(o.address?'Adresse : '+o.address+'\n':'')+'\nArticles :\n';
 o.lines.forEach(function(l){t+='- '+l.q+' × '+l.name+(l.fmt&&l.fmt!=='Standard'?' ('+l.fmt+')':'')+' · '+fmt(l.price)+' = '+fmt(l.q*l.price)+'\n'});
 return t+'\n*Total articles : '+fmt(o.sub)+'*\nLivraison : à confirmer ('+o.city+')\nPaiement à la livraison.'}
function pageOrder(){var o=lastOrder;if(!o){location.hash='boutique';return ''}
 var wa=waLink(orderText(o));
 return '<div class="pagehead"><div class="wrap">'+(o.saved?'<span class="eyebrow">Merci</span><h1>Commande enregistrée</h1>':'<span class="eyebrow">Dernière étape</span><h1>Envoyez votre commande</h1>')+'</div></div><div class="wrap prose">'
 +(o.saved?'<div class="note" role="status" style="margin-bottom:24px"><b>Votre commande a bien été reçue.</b><br>La boutique vous contacte sur WhatsApp pour confirmer la livraison et son tarif. Vous pouvez aussi lui écrire tout de suite avec le bouton ci-dessous.</div>':'<div class="note warn" role="status" style="margin-bottom:24px"><b>Votre commande n’est pas encore transmise.</b><br>Appuyez sur le bouton, puis envoyez le message WhatsApp déjà rédigé. La boutique le reçoit et confirme avec vous la livraison.</div>')
 +'<p><span class="eyebrow">Référence</span><br><b style="font-family:var(--display);font-size:1.8rem">'+esc(o.ref)+'</b></p><div class="sum" style="position:static;margin-block:24px">'+o.lines.map(function(l){return '<div class="sl"><span>'+l.q+' × '+esc(l.name)+(l.fmt&&l.fmt!=='Standard'?'<small>'+esc(l.fmt)+' · '+fmt(l.price)+'</small>':'<small>'+fmt(l.price)+'</small>')+'</span><span>'+fmt(l.q*l.price)+'</span></div>'}).join('')+'<div class="tot big2"><span>Total articles</span><span>'+fmt(o.sub)+'</span></div><p class="muted" style="font-size:.88rem">Livraison à confirmer sur WhatsApp ('+esc(o.city)+').<br>Contact : '+esc(o.name)+', '+esc(o.phone)+'</p></div>'
 +'<div class="acts">'+(wa?'<a class="btn gold" href="'+esc(wa)+'" target="_blank" rel="noopener" data-act="sent">'+(o.saved?'Écrire à la boutique sur WhatsApp':'Envoyer sur WhatsApp')+'</a>':'')+'<button class="btn line" data-act="copyorder">Copier le message</button></div><p class="muted" id="cpmsg" style="margin-top:12px;font-size:.88rem" role="status"></p><p style="margin-top:24px"><a class="link" href="#boutique">Continuer mes achats</a></p></div>'}

var LIV='<p>Nous livrons partout au Maroc. Le tarif et le délai dépendent de votre ville : ils sont confirmés avec vous sur WhatsApp avant l’envoi, sans engagement.</p><h2>Comment ça se passe</h2><p>Vous validez votre commande, puis la boutique vous contacte sur WhatsApp pour confirmer l’adresse, le tarif de livraison et le délai.</p><h2>Paiement</h2><p>Le paiement se fait en espèces à la livraison. Vérifiez votre colis à la réception.</p><h2>Un problème ?</h2><p>Contactez-nous sur WhatsApp avec votre référence de commande.</p>';
var CGV='<p>Ces conditions encadrent les commandes passées sur ce site. Elles sont données à titre général et doivent être relues et adaptées par la boutique avant le lancement.</p><h2>Commande</h2><p>Une commande est confirmée avec le client sur WhatsApp. Les prix sont indiqués en dirhams marocains (DH). Les frais de livraison sont communiqués avant l’envoi.</p><h2>Paiement</h2><p>Paiement à la livraison, en espèces.</p><h2>Retours</h2><p>Les conditions de retour et d’échange sont précisées par la boutique lors de la confirmation de commande.</p>';
var PRIV='<p>Cette page explique quelles données sont utilisées lorsque vous commandez.</p><h2>Données collectées</h2><p>Nom, numéro de téléphone, ville et, si vous le souhaitez, adresse. Elles servent uniquement à traiter et livrer votre commande.</p><h2>Partage</h2><p>Vos données ne sont ni vendues ni partagées à des fins publicitaires.</p><h2>Vos droits</h2><p>Vous pouvez demander la suppression de vos données en contactant la boutique.</p>';
function prose(k,title,def){var txt=S.pages[k];return '<div class="pagehead"><div class="wrap"><span class="eyebrow">Informations</span><h1>'+title+'</h1></div></div><div class="wrap prose">'+(txt?esc(txt).split(/\n\s*\n/).map(function(x){return '<p>'+x.replace(/\n/g,'<br>')+'</p>'}).join(''):def)+'</div>'}
function pageContact(){var s=S.settings;var wa=waLink('Bonjour, j’ai une question.');
 return '<div class="pagehead"><div class="wrap"><span class="eyebrow">Contact</span><h1>Nous contacter</h1><p>Une question sur un produit ? Écrivez-nous, nous répondons rapidement.</p></div></div><div class="wrap contact"><div><h2>Coordonnées</h2>'
 +(s.phone?'<p><b>Téléphone</b><br><a href="tel:'+esc(s.phone.replace(/\s/g,''))+'">'+esc(s.phone)+'</a></p>':'')+(wa?'<p><b>WhatsApp</b><br><a href="'+esc(wa)+'" target="_blank" rel="noopener">Discuter sur WhatsApp</a></p>':'')+(s.email?'<p><b>Email</b><br><a href="mailto:'+esc(s.email)+'">'+esc(s.email)+'</a></p>':'')+(s.address?'<p><b>Adresse</b><br>'+esc(s.address)+'</p>':'')+(s.hours?'<p><b>Horaires</b><br>'+esc(s.hours)+'</p>':'')+'</div>'
 +(wa?'<form class="form" id="cform" novalidate><h2>Envoyer un message</h2><div class="fld"><label for="c-name">Votre nom</label><input id="c-name" class="in" autocomplete="name"></div><div class="fld"><label for="c-msg">Message</label><textarea id="c-msg" class="in" rows="5" style="min-height:130px"></textarea><span class="err" id="c-err" role="alert"></span></div><button class="btn gold" type="submit">Envoyer sur WhatsApp</button></form>':'')+'</div>'}
function page404(){setMeta('Page introuvable | '+S.settings.brand,'');return '<div class="wrap nf"><span class="eyebrow">Erreur 404</span><h1>Page introuvable</h1><p class="muted">Cette page n’existe pas ou n’est plus disponible.</p><a class="btn" href="#boutique">Voir la boutique</a></div>'}
function drawerHtml(){if(!drawer)return '';var L=lines();var sub=subtotal(L);
 return '<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Panier"><header><h2>Votre panier</h2><button class="iconbtn" style="color:var(--fg)" data-act="close" aria-label="Fermer">'+I.close+'</button></header><div class="body">'
 +(notes.length?'<div class="note warn" role="status" style="margin-top:14px">'+notes.map(esc).join('<br>')+' <button class="lnk" data-act="dismiss">OK</button></div>':'')
 +(L.length?L.map(function(l){return '<div class="li"><div class="t">'+img(l.p,0)+'</div><div><b>'+esc(l.p.name)+'</b>'+(showLabel(l.p,l.v)?'<small>'+esc(vlabel(l.v))+'</small>':'')+'<small>'+fmt(l.v.price)+'</small><div class="mini"><button data-act="cm" data-v="'+esc(l.v.id)+'" aria-label="Moins">−</button><span>'+l.q+'</span><button data-act="cp" data-v="'+esc(l.v.id)+'" aria-label="Plus">+</button></div></div><div style="text-align:right"><b>'+fmt(l.sub)+'</b><br><button class="lnk" data-act="rm" data-v="'+esc(l.v.id)+'">Retirer</button></div></div>'}).join(''):'<div class="empty" style="margin-top:24px"><p>Votre panier est vide.</p><a class="btn line" href="#boutique" data-act="close">Voir la boutique</a></div>')+'</div>'
 +(L.length?'<footer><div class="tot"><span>Total articles</span><span>'+fmt(sub)+'</span></div><p class="muted" style="font-size:.84rem">Livraison confirmée sur WhatsApp selon votre ville.</p><a class="btn gold block" href="#checkout" data-act="close">Commander</a><p style="text-align:center;margin:12px 0 0">'+(confirmClear?'Vider le panier ? <button class="lnk" data-act="clearyes">Oui</button> · <button class="lnk" data-act="clearno">Non</button>':'<button class="lnk" data-act="clear">Vider le panier</button>')+'</p></footer>':'')+'</aside>'}

/* ---------- API ---------- */
function api(path,opt){opt=opt||{};opt.headers={'Content-Type':'application/json'};return fetch(path,opt).then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok){var e=new Error(j.message||'Erreur');e.status=r.status;throw e}return j})})}
function loadCatalog(silent){if(!silent&&!S.products.length)app.innerHTML='<div style="padding:140px 20px;text-align:center;color:var(--muted)">Chargement…</div>';
 return api('/api/catalog').then(function(c){S={settings:Object.assign({brand:'ESSOUFI',lowStock:3},c.settings||{}),categories:c.categories||[],products:c.products||[],pages:c.pages||{}};render(!!silent)},function(){if(!silent)app.innerHTML='<div style="padding:140px 20px;text-align:center"><p>Connexion impossible pour le moment.</p><button class="btn" data-act="retry">Réessayer</button></div>'})}

/* ---------- routeur ---------- */
function route(){var h=location.hash.slice(1);var s=S.settings;
 if(h===''){setMeta(s.brand+' | Billard et accessoires au Maroc','Boutique en ligne de matériel de billard au Maroc : queues, billes, craies, accessoires. Paiement à la livraison.');return['home',pageHome()]}
 if(h==='boutique')return[h,pageShop('')];
 if(h.indexOf('c-')===0)return[h,pageShop(h.slice(2))];
 if(h.indexOf('p-')===0)return['product',pageProduct(h.slice(2))];
 if(h==='checkout'){setMeta('Commande | '+s.brand,'');return[h,pageCheckout()]}
 if(h==='commande'){setMeta('Votre commande | '+s.brand,'');return[h,pageOrder()]}
 if(h==='livraison'){setMeta('Livraison | '+s.brand,'Livraison selon votre ville et paiement à la livraison.');return[h,'<div class="pagehead"><div class="wrap"><span class="eyebrow">Informations</span><h1>Livraison</h1></div></div><div class="wrap prose">'+(S.pages.livraison?esc(S.pages.livraison).split(/\n\s*\n/).map(function(x){return '<p>'+x.replace(/\n/g,'<br>')+'</p>'}).join(''):LIV)+'</div>']}
 if(h==='cgv'){setMeta('Conditions de vente | '+s.brand,'');return[h,prose('terms','Conditions de vente',CGV)]}
 if(h==='confidentialite'){setMeta('Confidentialité | '+s.brand,'');return[h,prose('privacy','Confidentialité',PRIV)]}
 if(h==='contact'){setMeta('Contact | '+s.brand,'Contactez la boutique.');return[h,pageContact()]}
 return['404',page404()]}
function render(keep){var y=window.scrollY;var R=route();app.innerHTML=header(R[0])+backbar(R[0])+'<main>'+R[1]+'</main>'+footer()+drawerHtml();if(keep)window.scrollTo(0,y)}
function renderResults(){var el=document.getElementById('results');if(el)el.innerHTML=resultsHtml(curCat)}

/* ---------- événements ---------- */
window.addEventListener('hashchange',function(){var hh=location.hash;if(trail.length>1&&trail[trail.length-2]===hh)trail.pop();else trail.push(hh);navOpen=false;drawer=false;sel=null;qty=1;gi=0;F.page=1;render();window.scrollTo(0,0)});
document.addEventListener('input',function(e){var t=e.target;
 if(t.dataset.flt){var k=t.dataset.flt;F[k]=t.type==='checkbox'?t.checked:t.value;F.page=1;renderResults();return}
 if(t.dataset.ck)CK[t.dataset.ck]=t.value});
document.addEventListener('submit',function(e){e.preventDefault();var id=e.target.id;
 if(id==='cform'){var m=document.getElementById('c-msg').value.trim(),n=document.getElementById('c-name').value.trim();if(!m){document.getElementById('c-err').textContent='Écrivez votre message.';return}var l=waLink((n?'Bonjour, c’est '+n+'.\n':'Bonjour,\n')+m);if(l)window.open(l,'_blank','noopener')||(location.href=l);return}
 if(id==='ckform'){var L=lines();ckErr={};var ph=normPhone(CK.phone);
  if(CK.name.trim().length<3)ckErr['ck-name']='Saisissez votre nom.';
  if(!ph)ckErr['ck-phone']='Numéro marocain invalide. Exemple : 06 12 34 56 78 ou +212 612 345 678.';
  if(CK.city.trim().length<2)ckErr['ck-city']='Indiquez votre ville.';
  if(CK.name.length>100||CK.city.length>80||CK.address.length>300)ckErr['ck-name']='Un champ est trop long.';
  if(!L.length){render();return}
  if(Object.keys(ckErr).length){render(true);var first=document.querySelector('[aria-invalid="true"]');if(first)first.focus();return}
  if(notes.length){render(true);return}
  if(!ckKey){ckKey=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():uid('k');var d=new Date();var ymd=String(d.getFullYear()).slice(2)+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2);ckRef='ESS-'+ymd+'-'+Math.random().toString(36).slice(2,6)}
  var form=e.target,btn=form.querySelector('button[type=submit]');if(btn){btn.disabled=true;btn.textContent='Envoi en cours…'}
  var body={key:ckKey,ref:ckRef,name:CK.name.trim(),phone:'+'+ph,city:CK.city.trim(),address:CK.address.trim(),hp:'',lines:L.map(function(l){return{p:l.p.id,v:l.v.id,q:l.q}})};
  api('/api/orders',{method:'POST',body:JSON.stringify(body)}).then(function(r){
   lastOrder={key:ckKey,ref:r.ref,name:body.name,phone:ph,city:body.city,address:body.address,sub:r.sub,saved:true,lines:r.lines};
   cart={};saveCart();ckKey=null;notes=[];CK.address='';loadCatalog(true);location.hash='commande'},
  function(er){if(er&&er.status>=400&&er.status<500){notes=[er.message||'Commande refusée.'];loadCatalog(true).then(function(){render(true);window.scrollTo(0,0)});return}
   lastOrder={key:ckKey,ref:ckRef,name:body.name,phone:ph,city:body.city,address:body.address,sub:subtotal(L),saved:false,lines:L.map(function(l){return{q:l.q,name:l.p.name,fmt:vlabel(l.v),price:Number(l.v.price)}})};
   location.hash='commande'})}});
document.addEventListener('click',function(e){var b=e.target.closest('[data-act]');if(!b||(b.tagName==='INPUT'&&b.type!=='checkbox'))return;var a=b.dataset.act;
 var rr=function(){render(true)};
 switch(a){
 case 'back':if(trail.length>1){history.back()}else{var bh=location.hash.slice(1);location.hash=(bh.indexOf('p-')===0||bh==='checkout')?'boutique':''}break;
 case 'nav':navOpen=!navOpen;rr();break;
 case 'cart':drawer=true;confirmClear=false;rr();break;
 case 'close':drawer=false;rr();break;
 case 'dismiss':notes=[];rr();break;
 case 'reset':F.q='';F.stock=false;F.page=1;rr();break;
 case 'page':F.page=+b.dataset.n;renderResults();window.scrollTo(0,0);break;
 case 'gi':gi=+b.dataset.n;rr();break;
 case 'pickv':sel=b.dataset.v;qty=1;rr();break;
 case 'qm':qty=Math.max(1,qty-1);rr();break;
 case 'qp':var sv=sel&&findV(sel);qty=Math.min(sv?Number(sv.v.stock):1,qty+1);rr();break;
 case 'add':var f=sel&&findV(sel);if(!f||!inS(f.v))break;cart[sel]=Math.min(Number(f.v.stock),(cart[sel]||0)+qty);saveCart();qty=1;drawer=true;rr();break;
 case 'cm':case 'cp':var v=b.dataset.v;var fv=findV(v);if(!fv)break;cart[v]=Math.max(1,Math.min(Number(fv.v.stock),(cart[v]||1)+(a==='cp'?1:-1)));saveCart();rr();break;
 case 'rm':delete cart[b.dataset.v];saveCart();rr();break;
 case 'clear':confirmClear=true;rr();break;
 case 'clearno':confirmClear=false;rr();break;
 case 'clearyes':cart={};saveCart();confirmClear=false;rr();break;
 case 'sent':break;
 case 'retry':loadCatalog();break;
 case 'copyorder':var txt=orderText(lastOrder);var m=document.getElementById('cpmsg');var ok=function(){m.textContent='Message copié. Collez-le dans WhatsApp.'};var ko=function(){m.textContent='Copie impossible. Utilisez le bouton WhatsApp.'};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,ko);else ko();break}});
loadCatalog();
})();
