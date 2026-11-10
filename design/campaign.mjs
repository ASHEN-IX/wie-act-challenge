/** Complete professional Noveris startup identity and communication system. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {color as c, brandGradient} from './tokens.mjs';
import {generateStartupPosts} from './startup-posts.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url));
const cli=process.env.FIGCRAFT_CLI || 'C:/Program Files/ArtCraft/FigCraft/figcraft-cli.exe';
const source=path.join(dir,'design.pre-campaign.figcraft');
const target=path.join(dir,'design-noveris-live.figcraft');
const first=process.argv.includes('--first-three');
const out=path.join(dir,first?'campaign.first-three.figcraft':'campaign.pending.figcraft');
const ops=[], manifest=[];
let seq=0;
const ref=name=>({$ref:name});
function op(command,params={},named=false){const as=named?`c${++seq}`:undefined; ops.push({command,params,...(as?{as}:{})});return as?ref(as):null;}
const page=name=>op('page.add',{name:`NOVERIS / STARTUP LAUNCH / ${name}`},true);
const put=(type,name,parent,x,y,width,height,props={})=>op('node.create',{type,name,parent,x,y,width,height,props},true);
const set=(id,props)=>op('node.set',{id,...props});
const grad={type:'linearGradient',stops:[c.violet,c.mPurple,c.cyan],from:[0,0],to:[1,1]};
const glow={type:'radialGradient',stops:['#30245E','#171536',c.mBg]};
const accent=[c.cyan,c.violetSoft,c.amber,c.pink,c.cyanSoft];
let currentPage;
function newPage(name){currentPage=`NOVERIS / STARTUP LAUNCH / ${name}`;page(name);}
class Canvas{
 constructor(name,w=1080,h=1350,index=0,units=1080,kind='social',transparent=false){
  this.s=w/units;this.w=units;this.h=h/this.s;this.name=name;
  this.id=put('frame',name,undefined,(index%4)*(w+100),Math.floor(index/4)*(h+120),w,h,{fills:transparent?[]:[c.mBg],clip:true});
  manifest.push({name,page:currentPage,width:w,height:h,kind,transparent});
  op('export.add',{ids:[this.id],setting:kind==='print'?{format:'pdf',bleed:'3mm',cropMarks:true,cmyk:true}:{format:'png',size:'1x'}});
 }
 rect(name,x,y,w,h,fill=c.mSurfaceDeep,r=22,stroke=null,parent=this.id){return put('rectangle',name,parent,x*this.s,y*this.s,w*this.s,h*this.s,{fills:fill?[fill]:[],cornerRadius:r*this.s,...(stroke?{strokes:[stroke],strokeWeight:this.s}:{})});}
 ellipse(name,x,y,w,h,fill=null,stroke=null,weight=2){return put('ellipse',name,this.id,x*this.s,y*this.s,w*this.s,h*this.s,{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:weight*this.s}:{})});}
 text(name,text,x,y,w,size=32,fill=c.mInk,bold=false,align='left',parent=this.id){
  const props={fontFamily:bold?'Sora':'Inter',fontStyle:bold?'Bold':'Regular',fontSize:size*this.s,lineHeight:bold?'110%':'145%',letterSpacing:bold?-0.025*size*this.s:0,textAutoResize:'height',textAlign:align,fills:[fill]};
  const id=op('text.create',{name,text,parent,x:x*this.s,y:y*this.s,width:w*this.s,props},true);
  op('style.apply',{ids:[id],style:bold?'Heading/H2':'Body/Default'});set(id,props);return id;
 }
 line(name,x,y,w,col=c.border){return put('line',name,this.id,x*this.s,y*this.s,w*this.s,0,{strokes:[col],strokeWeight:this.s});}
 path(name,p,x,y,w,h,fill=grad,stroke=null,sw=2){return op('vector.create',{name,path:p,parent:this.id,x:x*this.s,y:y*this.s,width:w*this.s,height:h*this.s,props:{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:sw*this.s,strokeCap:'round',strokeJoin:'round'}:{})}},true);}
 image(stage,x,y,size){return op('image.place',{name:`Approved Nardouch / ${stage}`,path:path.join(dir,`../apps/web/public/images/nardouch-${stage}-transparent.png`),parent:this.id,x:x*this.s,y:y*this.s,width:size*this.s,height:size*this.s,mode:'fit'},true);}
 label(text,x,y,w=900,col=c.violetSoft,size=20){return this.text(`Label / ${text}`,text,x,y,w,size,col,true);}
 ground(){this.ellipse('Atmosphere / violet',300,-260,1100,1100,glow);this.ellipse('Orbit / outer',260,430,1000,1000,null,c.border,1);this.ellipse('Orbit / inner',310,480,900,900,null,c.border,1);}
 brand(x=64,y=50,size=40){
  const id=op('instance.create',{component:321,parent:this.id,x:x*this.s,y:y*this.s},true);op('transform.scale',{ids:[id],factor:size/80*this.s});
  this.text('Brand / Noveris wordmark','Noveris',x+size*1.7,y-3,Math.min(600,this.w-x-size*1.7-24),size,c.mInk,true);
 }
 header(n,category='PRODUCT & BRAND'){
  this.brand();this.line('Header / rule',64,120,952);this.label(category,64,154,952,c.violetSoft,20);
 }
 headline(text,sub='',size=82){this.text('Headline',text,64,214,952,size,c.mInk,true);if(sub)this.text('Supporting copy',sub,68,214+text.split('\n').length*size*1.1+28,920,29,c.mMuted);}
 footer(cta='LEARN TOGETHER. GROW FURTHER.'){
  const y=this.h-130;this.line('Footer / rule',64,y-28,952);
  this.text('Call to action',cta,64,y,790,27,c.mInk,true);
  this.label('↗',938,y-8,70,c.cyan,42);
  instance(this,'Brand signature',64,this.h-62);
 }
 card(title,body,x,y,w=448,h=190,col=c.cyan,num=''){
  const root=this.rect(`Card / ${title}`,x,y,w,h,c.mSurfaceDeep,22,c.border);
  this.rect('Card / accent',x,y,5,h,col,2);
  if(num)this.label(num,x+24,y+22,w-48,col,19);
  this.text(`Card title / ${title}`,title,x+24,y+(num?58:26),w-48,28,c.mInk,true);
  if(body)this.text(`Card description / ${title}`,body,x+24,y+(num?105:78),w-48,23,c.mMuted);
  return root;
 }
 progress(x,y,w,value=0.95,label='EXAMPLE PRODUCT STATE'){
  this.label(label,x,y,w,c.cyan,20);this.rect('Progress / track',x,y+42,w,14,c.secondary,7);this.rect('Progress / fill',x,y+42,w*value,14,grad,7);
 }
 star(x,y,size,col=c.amber){this.path('Achievement / sparkle','M 50 0 L 61 39 L 100 50 L 61 61 L 50 100 L 39 61 L 0 50 L 39 39 Z',x,y,size,size,col);}
 qr(x,y,size=164){op('image.place',{name:'QR / https://noveris.live',path:path.join(dir,'noveris-qr.png'),parent:this.id,x:x*this.s,y:y*this.s,width:size*this.s,height:size*this.s,mode:'fit'},true);}
 placeholder(text,x,y,w,h){this.rect(`Replaceable / ${text}`,x,y,w,h,c.mSurface,22,c.violetSoft);this.label(text,x+20,y+h/2-14,w-40,c.mMuted,21);}
}


// All foundation pages are reviewed and adapted to the startup brand.
execFileSync(cli,['convert',source,path.join(dir,'foundations.local.json')],{stdio:'pipe'});
const foundation=JSON.parse(fs.readFileSync(path.join(dir,'foundations.local.json')));
const pageNames=['01 · Brand colour','02 · Brand typography','03 · Spacing & surfaces','04 · Format & layout system','05 · Noveris identity','06 · Product components','07 · Square brand template','08 · Companion introduction','09 · Story brand template','10 · Product link card','11 · Product workflow template','12 · Company introduction slide','13 · Mascot asset library'];
foundation.pages.forEach((id,i)=>{set(id,{name:pageNames[i]});const root=foundation.nodes[foundation.nodes[id].children[0]];const height=i===0?2020:root.height;set(root.id,{name:`NOVERIS-FOUNDATION-${String(i+1).padStart(2,'0')}`,height});manifest.push({name:`NOVERIS-FOUNDATION-${String(i+1).padStart(2,'0')}`,page:pageNames[i],width:root.width,height,kind:'foundation',transparent:false});});
const copy={
 4:'Brand colour',5:'The Noveris startup palette: a navy foundation, a violet identity and purposeful cyan accents. Use light surfaces for editorial contrast.',
 138:'Use the semantic colours consistently. Check text contrast at the final export size on both light and dark backgrounds.',
 141:'Brand typography',142:'Sora gives Noveris its distinctive voice. Inter keeps product stories, captions and information clear.',
 196:'Spacing & surfaces',197:'A consistent spacing and surface system for a professional learning product, from social content to company materials.',
 256:'Format & layout system',257:'One layout language for product storytelling, company communication and learning experiences. Use clear margins and one main message.',
 314:'A4 handout',319:'Noveris identity',320:'The original Noveris mark and Sora wordmark. Preserve the approved geometry and clear space across every startup touchpoint.',
 358:'Company decks, signage and print',392:'Product components',393:'Reusable elements for the Noveris product and brand. Keep hierarchy, spacing and copy consistent across each channel.',
 419:'Work or personal e-mail',420:'name@example.com',422:'Work or personal e-mail',423:'learner@example.com',427:'Example state',
 447:'Companion states',448:'The five approved Nardouch illustrations are product assets. Choose a state to suit the story, with consistent scale and colour.',
 467:'Illustration variant',468:'Use mascot illustrations as brand assets. They do not certify knowledge, learning outcomes or professional qualifications.',
 496:'A moment to reflect.',511:'NOVERIS / PEER LEARNING',514:'Course material, guided practice and peer discussion, brought into one connected learning experience.',528:'LEARN TOGETHER. GROW FURTHER.',
 534:'MEET NARDOUCH',535:'A companion\nfor your learning.',538:'Nardouch',539:'Explain. Explore. Keep thinking.',543:'A clearer explanation, a different example, and space to ask another question. Meet the companion inside Noveris.',
 550:'NOVERIS / CONNECTED LEARNING',551:'Learn together.\nGrow further.',552:'Bring your questions, explore your course material and make room for shared understanding.',557:'Explore Noveris',558:'FOLLOW THE NOVERIS JOURNEY',
 565:'Learning,\nmore connected.',566:'Your course material. Guided practice. A space for thoughtful peer discussion.',
 576:'From material\nto understanding.',579:'Bring your course material into a personal learning space.',582:'Ask & practise',583:'Explore explanations and put the ideas into practice.',586:'Share & reflect',587:'Discuss with peers and choose what to revisit.',
 597:'NOVERIS / COMPANY INTRODUCTION',600:'An AI-powered peer learning companion connecting course material, guided practice and shared understanding.',603:'Course-led',604:'Guidance around your course material',
 615:'NARDOUCH / APPROVED BRAND ASSETS',616:'One companion. Five expressions.',622:'Welcome',629:'Learn',636:'Explore',643:'Practise',650:'Reflect',651:'A moment to reflect.'
};
for(const [id,characters] of Object.entries(copy))set(Number(id),{characters});
// Fit new template text deliberately within the existing architecture.
set(535,{fontSize:80,width:1080,textAutoResize:'height'});set(538,{fontSize:42});set(539,{fontSize:17});set(543,{fontSize:21,width:800,textAutoResize:'height'});
set(551,{fontSize:92,width:888,textAutoResize:'height'});set(558,{fontSize:18,width:888,textAutoResize:'height'});set(528,{fontSize:17,width:540,x:460,textAlign:'right'});
set(616,{fontSize:44,width:1296,textAutoResize:'height'});set(468,{fontSize:12,width:1008,textAutoResize:'height'});
for(const n of Object.values(foundation.nodes)){if(/ednova|ieee|challenge/i.test(n.name||''))set(n.id,{name:n.type==='text'?'Brand / Noveris identification':n.name.replace(/EdNova|IEEE|Challenge/gi,'Noveris')});}

// Shared startup components.
newPage('08 — Reusable Brand Components');
const kit=new Canvas('NOVERIS-Brand-Components',1440,1760,0,1080,'reference');kit.header(8,'BRAND COMPONENTS');kit.headline('Clear by design.\nConsistent everywhere.','The Noveris brand system, built for a professional learning product.',63);
const masters={};
function master(name,x,y,w,h,fn){const root=put('component',`Noveris / ${name}`,kit.id,x*kit.s,y*kit.s,w*kit.s,h*kit.s,{fills:[c.mSurfaceDeep],cornerRadius:16*kit.s});fn(root);masters[name]=root;return root;}
master('Product label',64,470,420,70,p=>kit.text('Editable product label','PEER LEARNING',20,24,380,18,c.violetSoft,true,'left',p));
master('CTA',540,470,476,70,p=>kit.text('Editable CTA','EXPLORE NOVERIS  ↗',24,23,430,20,c.mInk,true,'left',p));
master('Product description',64,580,952,80,p=>kit.text('Product positioning','Your AI-powered peer learning companion.',24,28,900,22,c.mMuted,false,'left',p));
kit.label('EXAMPLE PRODUCT STATE',64,730,952,c.violetSoft,20);kit.rect('Example state / track',64,777,952,10,c.secondary,5);kit.rect('Example state / progress',64,777,590,10,c.violet,5);
kit.qr(64,850,160);kit.card('Feature card','A concise title, a useful description, one clear action.',260,850,756,160,c.violetSoft,'PRODUCT STORY');
kit.text('Component guidance','Use the approved logo, shared type styles and purposeful spacing. Keep marketing claims specific and source-backed. Use the supplied company website and update contact details before publication.',64,1055,940,25,c.mMuted);
master('Brand signature',64,1180,952,36,p=>kit.text('Brand signature / live text','LEARN TOGETHER. GROW FURTHER.',0,0,940,17,c.violetSoft,true,'left',p));
set(masters['Brand signature'],{fills:[],layout:'horizontal',padding:0,gap:0,crossAlign:'center'});
function instance(canvas,name,x,y){const id=op('instance.create',{component:masters[name],parent:canvas.id,x:x*canvas.s,y:y*canvas.s},true);op('transform.scale',{ids:[id],factor:canvas.s/kit.s});return id;}

const startup=generateStartupPosts({count:first?3:12});ops.push(...startup.ops);manifest.push(...startup.frames);

if(!first){
 newPage('03 — Product Stories (12)');
 const stories=[
 ['Meet Noveris.','A more connected way to approach learning.','FOLLOW THE JOURNEY','learner'],
 ['More material.\nWhere to begin?','Bring structure to the next step in your learning.','QUESTION STICKER',null],
 ['What helps you\nunderstand?','A simpler explanation, a different example, or a conversation?','NATIVE POLL STICKER',null],
 ['A clearer\nexplanation.','Meet Nardouch, the companion inside Noveris.','QUESTION STICKER','explorer'],
 ['Your course.\nA clearer path.','From source material to guided learning and practice.','LINK STICKER / noveris.live',null],
 ['Learning is\na conversation.','Bring your questions. Share your thinking.','TAG A STUDY PARTNER',null],
 ['See it.\nExplore it.','Make space to approach a concept visually.','QUESTION STICKER',null],
 ['One thoughtful\nstep at a time.','Read, practise and reflect on what needs another look.','NATIVE POLL STICKER',null],
 ['Your curiosity.\nYour language.','English, French and Darija.','QUESTION STICKER',null],
 ['For learning.\nFor teaching.','A shared foundation for learners and educators.','QUESTION STICKER',null],
 ['Clarity.\nConnection.\nCuriosity.','The principles behind what we’re building.','FOLLOW THE JOURNEY',null],
 ['Let’s shape\nbetter learning.','What would make your next study session better?','NATIVE QUESTION STICKER',null]
 ];
 stories.forEach(([title,sub,sticker,stage],i)=>{
  const a=new Canvas(`NOVERIS-STORY-${String(i+1).padStart(2,'0')}`,1080,1920,i);a.brand(64,260);a.label('LEARN TOGETHER. GROW FURTHER.',64,362,952,c.violetSoft,18);
  const size=i===10?76:84;a.text('Story headline',title,64,440,952,size,c.mInk,true);a.text('Story context',sub,68,440+title.split('\n').length*size*1.1+34,930,30,c.mMuted);
  if(stage){a.ellipse('Companion / quiet orbit',310,900,460,460,null,c.border,2);a.image(stage,280,840,520);}
  else if(i===1){['Your course material','A question worth asking','A clearer next step'].forEach((t,j)=>a.card(t,'',64,860+j*165,952,132,c.violetSoft,`0${j+1}`));}
  else if(i===2){a.text('Editorial / question','“Can we look\nat it another way?”',64,940,952,72,c.mInk,true);a.text('Editorial / reflection','Different approaches can open up a concept.',68,1205,920,30,c.mMuted);}
  else if(i===4){[['Bring your material','Start with course documents.'],['Review the content','Check it before publication.'],['Learn and practise','Ask questions and explore activities.']].forEach(([t,b],j)=>a.card(t,b,64,850+j*180,952,156,c.violetSoft,`0${j+1}`));}
  else if(i===5){a.card('Ask. Discuss. Reflect.','Shared discussion with space\nfor individual understanding.',64,950,952,280,c.violetSoft,'STUDY TOGETHER');}
  else if(i===6){a.rect('Visual Lab / illustration',64,880,952,420,c.mSurfaceDeep,22,c.border);a.label('VISUAL LEARNING LAB / ILLUSTRATION',96,925,860,c.violetSoft,18);a.line('Concept / axis',140,1210,780,c.mQuiet);a.path('Concept / curve','M 0 170 C 90 170 90 100 200 100 C 290 100 300 0 400 0',155,1035,720,180,null,c.cyan,5);}
  else if(i===7){['Read a concept.','Try it yourself.','Reflect and revisit.'].forEach((t,j)=>a.card(t,'',64,890+j*152,952,124,c.violetSoft,`0${j+1}`));}
  else if(i===8){['Let’s understand it.','Comprendre, ensemble.','Nefhmou m3a baadhna.'].forEach((t,j)=>{a.text('Language / sample',t,64,900+j*170,952,45,[c.mInk,c.violetSoft,c.cyanSoft][j],true);if(j<2)a.line('Language / divider',64,1020+j*170,952);});}
  else if(i===9){a.card('For learners','Course material, guided practice\nand room to ask questions.',64,880,952,200,c.violetSoft);a.card('For educators','Reviewed content and\nstructured peer discussion.',64,1120,952,200,c.cyanSoft);}
  else if(i===10){a.line('Philosophy / rule',64,955,952);a.text('Philosophy / belief','Technology should bring\nlearning closer.',64,1020,952,60,c.mInk,true);}
  else {a.rect('Conversation / invitation',64,930,952,370,c.mSurfaceDeep,28,c.border);a.label('WE’RE LISTENING',100,980,880);a.text('Feedback / question','Your experience can help\nshape what comes next.',100,1060,880,50,c.mInk,true);}
  a.placeholder(`${sticker} / ADD IN INSTAGRAM`,100,1470,880,175);
 });

 newPage('04 — Team Identity Cards (3)');
 const mm=n=>n*72/25.4;
 const roles=[['MOHAMED HABIB ALLAH BIBANI',c.violetSoft,'MHB','CEO'],['MOHAMED AZIZ KAMMOUN',c.cyanSoft,'MAK','CTO'],['TASNIM REBHI',c.amber,'TR','HEAD OF PRODUCT']];
 roles.forEach(([role,col,initials,title],i)=>{const a=new Canvas(`NOVERIS-ID-TEAM-${i+1}-FRONT`,mm(90),mm(120),i,360,'print');a.rect('Identity / frame',12,12,336,456,c.mSurface,16,c.border);a.rect('Lanyard / quiet area',140,18,80,10,c.mSurfaceDeep,5);a.brand(28,51,30);a.label('LEARN TOGETHER. GROW FURTHER.',28,103,304,c.mMuted,9);a.ellipse('Portrait / initials placeholder',102,151,156,156,c.mSurfaceDeep,c.border,1);a.text('Initials / replace',initials,106,194,148,initials.length>2?40:48,col,true,'center');a.rect('Department / accent',28,331,304,4,col,2);a.text('Name / replace',role,28,355,304,role.length>22?15:role.length>15?18:24,c.mInk,true);a.text('Job title / replace',title,28,398,304,14,c.mMuted);a.label('NOVERIS TEAM',28,442,304,col,12);});
 const back=new Canvas('NOVERIS-ID-SHARED-BACK',mm(90),mm(120),5,360,'print');back.brand(28,43,30);back.text('Brand belief','Learning,\nmore connected.',28,118,304,34,c.mInk,true);back.qr(116,235,128);back.text('Contact purpose','noveris.live',28,380,304,10,c.mMuted,true,'center');back.text('Contact / replace','Contact@noveris.live\nnoveris.live',28,417,304,12,c.mMuted);

 newPage('05 — Brand Stickers (7)');
 const stickerNames=['Noveris','STAY\nCURIOUS.','LEARN\nTOGETHER.','KEEP\nASKING WHY.','MAKE ROOM\nTO LEARN.','IDEAS GROW\nTOGETHER.','THINK. EXPLORE.\nUNDERSTAND.'];
 function sticker(a,i,ox=0,oy=0,k=1){
  const x=ox+32*k,y=oy+32*k,w=536*k,h=536*k;
  const shape=(name,xx,yy,ww,hh,fill,stroke=null)=>i===2?a.path(name,'M25 0 L75 0 L100 25 L100 75 L75 100 L25 100 L0 75 L0 25 Z',xx,yy,ww,hh,fill,stroke):i===3?a.ellipse(name,xx,yy,ww,hh,fill,stroke):a.rect(name,xx,yy,ww,hh,fill,(i===1?170:i===5?145:100)*k,stroke);
  shape('Sticker / white contour',x,y,w,h,c.white);shape('Sticker / brand surface',x+14*k,y+14*k,w-28*k,h-28*k,c.mBg);
  if(i===0){const id=op('instance.create',{component:321,parent:a.id,x:(ox+200*k)*a.s,y:(oy+120*k)*a.s},true);op('transform.scale',{ids:[id],factor:1.9*k*a.s});}
  else if(i===2){a.path('Learning / book','M0 0 Q35 -10 70 10 L70 100 Q35 80 0 90 Z M70 10 Q105 -10 140 0 L140 90 Q105 80 70 100',ox+210*k,oy+130*k,180*k,140*k,null,c.violetSoft,7*k);}
  else if(i===3){a.text('Curiosity / question','?',ox+180*k,oy+88*k,240*k,170*k,c.cyanSoft,true,'center');}
  else if(i===5){a.ellipse('Connection / one',ox+175*k,oy+140*k,150*k,150*k,null,c.violetSoft,8*k);a.ellipse('Connection / two',ox+275*k,oy+140*k,150*k,150*k,null,c.cyanSoft,8*k);}
  else a.star(ox+235*k,oy+125*k,130*k,c.violetSoft);
  a.text('Sticker / phrase',stickerNames[i],ox+72*k,oy+355*k,456*k,(i===0?66:i===6?34:43)*k,c.mInk,true,'center');
  const cut=shape('CUT CONTOUR / VENDOR ADAPTATION REQUIRED',x,y,w,h,null,c.pink);set(cut,{visible:false});
 }
 for(let i=0;i<7;i++){const a=new Canvas(`NOVERIS-STICKER-${String(i+1).padStart(2,'0')}`,600,600,i,600,'sticker',true);sticker(a,i);}
 const sheet=new Canvas('NOVERIS-Sticker-Sheet',1440,1640,7,1440,'reference');sheet.text('Sticker collection title','A little curiosity, everywhere.',64,56,1312,58,c.mInk,true);sheet.label('NOVERIS / BRAND STICKER COLLECTION',64,146,1312,c.violetSoft,22);for(let i=0;i<7;i++)sticker(sheet,i,60+(i%3)*450,235+Math.floor(i/3)*450,.68);sheet.text('Production note','Seven individual transparent designs. Hidden source contours and separate magenta SVG guides are provided for vendor adaptation.',550,1270,790,28,c.mMuted);

 newPage('06 — Product Posters (2)');
 const p1=new Canvas('NOVERIS-A3-01-BRAND',mm(297),mm(420),0,1080,'print');p1.header(1,'INTRODUCING NOVERIS');p1.headline('Learn together.\nGrow further.','Your AI-powered peer learning companion.',103);p1.text('Product positioning','Course material. Guided practice.\nA space for shared understanding.',68,562,900,34,c.mMuted);p1.ellipse('Brand / quiet orbit',440,700,460,460,null,c.border,2);p1.image('learner',440,660,500);p1.qr(64,1160,158);p1.text('Contact / placeholder','noveris.live\nScan to explore Noveris.',260,1190,720,28,c.mMuted);p1.footer('A clearer, more connected way to learn.');
 const p2=new Canvas('NOVERIS-A3-02-WORKFLOW',mm(297),mm(420),1,1080,'print');p2.header(2,'THE PRODUCT EXPERIENCE');p2.headline('From material\nto understanding.','A connected workflow around what you’re studying.',87);[['Your course material','Bring the context you want to learn from.'],['Guidance and practice','Explore explanations and work through ideas.'],['Peer discussion','Ask questions and share your thinking.']].forEach(([t,b],i)=>p2.card(t,b,64,590+i*196,952,172,c.violetSoft,`0${i+1}`));p2.qr(64,1235,140);p2.text('Contact / placeholder','noveris.live\nLearn more about the product.',245,1260,770,27,c.mMuted);p2.footer('Keep the questions coming.');

 newPage('07 — Company Flyer (Front + Back)');
 const f=new Canvas('NOVERIS-A5-FLYER-FRONT',mm(148),mm(210),0,540,'print');f.brand(32,38,35);f.label('YOUR PEER LEARNING COMPANION',32,104,476,c.violetSoft,12);f.text('Flyer headline','Learning,\nmore connected.',32,158,476,49,c.mInk,true);f.text('Product description','Bring course material, guided practice and peer discussion into one learning experience.',32,302,244,21,c.mMuted);f.image('learner',264,330,245);f.qr(32,580,104);f.text('Product CTA','EXPLORE NOVERIS',160,591,348,20,c.violetSoft,true);f.text('Contact / placeholder','noveris.live\nContact@noveris.live',160,636,348,14,c.mMuted);f.line('Footer / rule',32,718,476);f.label('LEARN TOGETHER. GROW FURTHER.',32,739,476,c.violetSoft,11);
 const fb=new Canvas('NOVERIS-A5-FLYER-BACK',mm(148),mm(210),1,540,'print');fb.text('Information headline','Make room\nfor understanding.',32,38,476,34,c.mInk,true);[['LEARN WITH GUIDANCE','Ask for a clearer explanation, explore a different example and work through a concept.'],['THINK WITH PEERS','Discuss ideas and questions, with space for individual practice and reflection.'],['EXPLORE VISUALLY','Approach concepts through interactive practice in Visual Learning Lab.'],['FOR LEARNERS & EDUCATORS','Personal learning and reviewed course content, connected by a shared learning foundation.']].forEach(([t,b],i)=>{fb.label(t,32,172+i*111,476,c.violetSoft,13);fb.text('Product detail / '+t,b,32,201+i*111,476,17,c.mMuted);});fb.qr(32,659,72);fb.text('Contact / placeholder','noveris.live\nContact@noveris.live',126,667,382,13,c.mMuted);fb.label('NOVERIS / LEARN TOGETHER. GROW FURTHER.',32,741,476,c.violetSoft,10);

 newPage('01 — Startup Brand Overview');
 const cover=new Canvas('NOVERIS-Startup-Overview',1600,1200,0,1600,'reference');cover.brand(80,65,60);cover.label('STARTUP BRAND & PRODUCT COMMUNICATION',80,180,1440,c.violetSoft,23);cover.text('Brand statement','Learn together.\nGrow further.',80,268,1440,132,c.mInk,true);cover.text('Product positioning','An AI-powered peer learning companion.\nA clearer, more connected way to approach learning.',80,620,1440,37,c.mMuted);cover.line('Overview / divider',80,800,1440);cover.text('Collection index','12 feed posts / 12 Stories / 3 team identity cards + back\n7 brand stickers + sheet / 2 posters / a double-sided company flyer',80,850,1440,32,c.mInk);cover.text('Brand principles','Professional. Clear. Curious. Human.\nOriginal Noveris identity, Sora + Inter, purposeful violet and cyan accents.',80,1030,1440,29,c.mMuted);

 newPage('09 — Production & Brand Guidelines');
 const prod=new Canvas('NOVERIS-Production-Guidelines',1440,1900,0,1080,'reference');prod.header(9,'PRODUCTION & BRAND GUIDELINES');prod.headline('A professional brand.\nReady to communicate.','Product-led messaging across every channel.',63);[['BRAND VOICE','Clear, considered and human. Speak about real learning needs.\nUse specific product descriptions and one clear invitation.'],['CONTENT & CLAIMS','No invented customer numbers, results, partnerships or release dates.\nKeep examples visibly illustrative and contact details replaceable.'],['DIGITAL FORMATS','Feed 1080 × 1350 px / Stories 1080 × 1920 px.\nKeep key Story content between the top and bottom 250 px.'],['PRINT FORMATS','A3 297 × 420 mm / A5 148 × 210 mm / IDs 90 × 120 mm.\n3 mm bleed, safe text margins and embedded fonts in proofs.'],['PRODUCTION HANDOFF','Check contact details and QR codes before release.\nPrint profiles, finishing and cutting contours require vendor confirmation.']].forEach(([t,b],i)=>prod.card(t,b,64,505+i*178,952,155,c.violetSoft));
}

if(!first){const order=['01 — Startup Brand Overview','Feed Posts (12)','03 — Product Stories (12)','04 — Team Identity Cards (3)','05 — Brand Stickers (7)','06 — Product Posters (2)','07 — Company Flyer (Front + Back)','08 — Reusable Brand Components','09 — Production & Brand Guidelines'];
 for(const [i,name] of order.entries())op('page.move',{id:{$ref:ops.find(o=>o.command==='page.add'&&o.params.name.endsWith(name)).as},index:13+i});
 op('page.select',{id:{$ref:ops.find(o=>o.command==='page.add'&&o.params.name.endsWith(order[0])).as}});
}
fs.writeFileSync(path.join(dir,'campaign.script.json'),JSON.stringify(ops));
fs.writeFileSync(path.join(dir,'campaign.manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(dir,'startup.manifest.json'),JSON.stringify(startup.frames,null,2));
const result=execFileSync(cli,['run',path.join(dir,'campaign.script.json'),'--in',source,'--out',out],{encoding:'utf8',maxBuffer:30*1024*1024});
fs.writeFileSync(path.join(dir,'campaign.build.log'),result);
console.log(`Built ${manifest.length} export frames across all 22 Noveris pages: ${out}`);
if(!first){fs.copyFileSync(out,target);console.log('Updated the complete Noveris startup design system and marketing file.');}
