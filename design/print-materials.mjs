/** Rebuilds the print and badge pages (IDs, stickers, posters, flyer) in the current design file. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {color as c} from './tokens.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const cli=process.env.FIGCRAFT_CLI||'figcraft-cli';
const target=path.join(dir,'design-noveris.figcraft');
const P='NOVERIS / STARTUP LAUNCH / ';
const pageNames=['04 — Team Identity Cards (3)','05 — Brand Stickers (7)','06 — Product Posters (2)','07 — Company Flyer (Front + Back)'].map(n=>P+n);
const V='#7B3FF2',V2='#4B22B5';
const grad=(a,b)=>({type:'linearGradient',stops:[a,b],from:[0,0],to:[1,1]});
const glowFill=(rgb,a)=>({type:'radialGradient',stops:[`rgba(${rgb}, ${a})`,`rgba(${rgb}, 0)`]});
export const stickerRadius=[130,null,60,200,90,150,110]; // null = circle
const mm=n=>n*72/25.4;
const ops=[],manifest=[];let seq=0,currentPage;
const op=(command,params={},create=false)=>{const as=create?`pm${++seq}`:undefined;ops.push({command,params,...(as?{as}:{})});return as?{$ref:as}:null;};
function newPage(name){currentPage=P+name;return op('page.add',{name:currentPage},true);}

class Cv{
 constructor(name,w,h,index,units,kind='print',transparent=false,bg=c.mBg){
  this.s=w/units;this.w=units;this.h=h/this.s;this.name=name;
  this.id=op('frame.create',{name,x:(index%4)*(w+100),y:Math.floor(index/4)*(h+120),width:w,height:h,props:{fills:transparent?[]:[bg],clip:true}},true);
  manifest.push({name,page:currentPage,width:w,height:h,kind,transparent});
  op('export.add',{ids:[this.id],setting:kind==='print'?{format:'pdf',bleed:'3mm',cropMarks:true,cmyk:true}:{format:'png',size:'1x'}});
 }
 rect(name,x,y,w,h,fill=c.mSurfaceDeep,r=22,stroke=null,sw=1.5){const s=this.s;return op('shape.rectangle',{name,parent:this.id,x:x*s,y:y*s,width:w*s,height:h*s,props:{fills:fill?[fill]:[],cornerRadius:r*s,...(stroke?{strokes:[stroke],strokeWeight:sw*s}:{})}},true);}
 ellipse(name,x,y,w,h,fill=null,stroke=null,sw=1.5){const s=this.s;return op('shape.ellipse',{name,parent:this.id,x:x*s,y:y*s,width:w*s,height:h*s,props:{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:sw*s}:{})}},true);}
 glow(rgb,a,size,x,y){return this.ellipse('Ambient glow',x,y,size,size,glowFill(rgb,a));}
 text(name,text,x,y,w,size=30,fill=c.mInk,bold=false,align='left',ls=null){
  const s=this.s;const props={fontFamily:bold?'Sora':'Inter',fontStyle:bold?'Bold':'Regular',fontSize:size*s,lineHeight:bold?'108%':'142%',letterSpacing:(ls!==null?ls:(bold?-size*.025:0))*s,textAutoResize:'height',textAlign:align,fills:[fill]};
  const id=op('text.create',{name,text,parent:this.id,x:x*s,y:y*s,width:w*s,props},true);op('style.apply',{ids:[id],style:bold?'Heading/H2':'Body/Default'});op('node.set',{id,...props});return id;}
 label(text,x,y,w,col=c.violetSoft,size=20,align='left'){return this.text(`Label / ${text}`,text,x,y,w,size,col,true,align,size*.15);}
 line(name,x,y,w,col=c.border){const s=this.s;return op('shape.line',{name,parent:this.id,x:x*s,y:y*s,width:w*s,props:{strokes:[col],strokeWeight:1.5*s}},true);}
 image(stage,x,y,size){const s=this.s;return op('image.place',{name:`Approved Nardouch / ${stage}`,path:path.join(dir,`../apps/web/public/images/nardouch-${stage}-transparent.png`),parent:this.id,x:x*s,y:y*s,width:size*s,height:size*s,mode:'fit'},true);}
 qr(x,y,size,pad=10){this.rect('QR / quiet zone',x,y,size+pad*2,size+pad*2,'#FFFFFF',14);const s=this.s;op('image.place',{name:'QR / https://noveris.live',path:path.join(dir,'noveris-qr.png'),parent:this.id,x:(x+pad)*s,y:(y+pad)*s,width:size*s,height:size*s,mode:'fit'},true);}
 brand(x,y,size=40,center=false){
  const s=this.s;const id=op('instance.create',{component:321,parent:this.id,x:x*s,y:y*s},true);op('transform.scale',{ids:[id],factor:size/80*s});
  this.text('Brand / Noveris wordmark','Noveris',x+size*1.45,y-size*.12,size*5,size*.95,c.mInk,true);
 }
 chip(text,x,y,w,h,fill,fg,size,stroke=null){this.rect(`Chip / ${text}`,x,y,w,h,fill,h/2,stroke);this.text(`Chip label / ${text}`,text,x,y+(h-size*1.1)/2,w,size,fg,true,'center',0);}
 bar(x,y,w,h,text,size){this.rect('CTA bar',x,y,w,h,grad(V,V2),h/2);this.text('CTA',text,x+h*.5,y+(h-size*1.1)/2,w-h*2,size,c.white,true,'left',-.4);this.ellipse('CTA arrow disc',x+w-h*.85,y+h*.15,h*.7,h*.7,'rgba(255, 255, 255, 0.2)');this.text('CTA arrow','↗',x+w-h*.85,y+h*.15+(h*.7-size*1.3)/2,h*.7,size*1.2,c.white,true,'center',0);}
}

// ---------- 04 Team identity cards ----------
const idPage=newPage(pageNames[0].slice(P.length));
const people=[['MOHAMED HABIB ALLAH BIBANI',c.violetSoft,'CEO','habib.jpeg'],['MOHAMED AZIZ KAMMOUN',c.cyanSoft,'CTO','kammoun.jpeg'],['TASNIM REBHI',c.amber,'HEAD OF PRODUCT','tasnim-studio.png']];
people.forEach(([name,col,title,file],i)=>{
 const a=new Cv(`NOVERIS-ID-TEAM-${i+1}-FRONT`,mm(90),mm(120),i,360);
 a.glow('123, 63, 242',.5,420,-90,-150);a.glow('6, 214, 255',.18,360,60,300);
 a.rect('Brand / edge',0,0,360,8,grad(V,col),0);
 a.brand(28,34,30);a.label('NOVERIS TEAM',180,44,152,col,11,'right');a.line('Header / rule',28,88,304);
 a.ellipse('Photo / halo',60,104,240,240,glowFill(col==='#FFB547'?'255, 181, 71':'169, 135, 255',.4));
 a.ellipse('Photo / ring',77,112,206,206,grad(col,V));
 const s=a.s;const portrait=op('frame.create',{name:`Portrait / ${name}`,parent:a.id,x:85*s,y:120*s,width:190*s,height:190*s,props:{fills:[c.mSurfaceDeep],cornerRadius:95*s,clip:true}},true);
 op('image.place',{name:`Photo / ${name}`,path:path.join(dir,'team-portraits',file),parent:portrait,x:-37*s,y:0,width:263*s,height:263*s,mode:'fill'},true);
 const long=name.length>16;a.text('Name / replace',name,24,long?330:338,312,long?25:30,c.mInk,true,'center');
 a.chip(title,180-(title.length*8.2+44)/2,long?398:392,title.length*8.2+44,34,col,c.night,13);
 a.label('LEARN TOGETHER. GROW FURTHER.',20,450,320,c.mQuiet,9.5,'center');
});
const back=new Cv('NOVERIS-ID-SHARED-BACK',mm(90),mm(120),3,360);
back.glow('123, 63, 242',.5,420,-90,-150);back.glow('6, 214, 255',.2,360,60,260);back.rect('Brand / edge',0,0,360,8,grad(V,'#06D6FF'),0);
back.brand(28,34,30);back.line('Header / rule',28,88,304);
back.text('Brand belief','Learning,\nmore connected.',28,108,304,34,c.mInk,true);
back.ellipse('Mascot / orbit',160,190,190,190,null,c.border,1.5);back.image('learner',160,182,200);
back.rect('Contact panel',24,352,312,104,c.mSurfaceDeep,20,c.border);back.qr(36,364,64,6);
back.text('Contact purpose','noveris.live',124,372,200,18,c.mInk,true);back.text('Scan to explore','Scan to explore Noveris.',124,398,200,11.5,c.mMuted);back.text('Contact / replace','Contact@noveris.live',124,420,200,11.5,c.violetSoft);

// ---------- 05 Stickers ----------
const stPage=newPage(pageNames[1].slice(P.length));
const stickerText=[['Noveris'],['STAY','CURIOUS.'],['LEARN','TOGETHER.'],['KEEP','ASKING WHY.'],['MAKE ROOM','TO LEARN.'],['IDEAS GROW','TOGETHER.'],['THINK. EXPLORE.','UNDERSTAND.']];
const stickerSize=[0,52,52,50,46,46,38],stickerAcc=[c.violetSoft,c.cyanSoft,c.violetLight||'#BC96FF',c.amber,c.cyanSoft,c.pink,c.violetSoft];
const stickerMascot=[null,'explorer','learner','expert','graduate',null,'hero'];
function sticker(a,i,ox=0,oy=0,k=1){
 const x=ox+32*k,y=oy+32*k,w=536*k,h=536*k,r=stickerRadius[i];const acc=stickerAcc[i];
 const shape=(name,xx,yy,ww,hh,fill,stroke=null,sw=1)=>r===null?a.ellipse(name,xx,yy,ww,hh,fill,stroke,sw):a.rect(name,xx,yy,ww,hh,fill,r*k*(ww/w),stroke,sw);
 shape('Sticker / white contour',x,y,w,h,c.white);
 shape('Sticker / brand surface',x+14*k,y+14*k,w-28*k,h-28*k,grad('#241A6B','#0B0E28'));
 a.ellipse('Sticker / glow',ox+110*k,oy+60*k,380*k,380*k,glowFill('169, 135, 255',.45));
 shape('Sticker / inner ring',x+34*k,y+34*k,w-68*k,h-68*k,null,'rgba(255, 255, 255, 0.18)',2*k);
 if(i===0){const s=a.s;const id=op('instance.create',{component:321,parent:a.id,x:(ox+190*k)*s,y:(oy+100*k)*s},true);op('transform.scale',{ids:[id],factor:2.1*k*s});}
 else if(i===5){a.ellipse('Connection / one',ox+160*k,oy+120*k,170*k,170*k,'rgba(169, 135, 255, 0.22)',c.violetSoft,9*k);a.ellipse('Connection / two',ox+270*k,oy+120*k,170*k,170*k,'rgba(101, 228, 255, 0.22)',c.cyanSoft,9*k);a.text('Connection / spark','✦',ox+250*k,oy+172*k,100*k,64*k,c.white,true,'center',0);}
 else a.image(stickerMascot[i],ox+155*k,oy+70*k,290*k);
 const t=stickerText[i];
 if(i===0)a.text('Sticker / phrase','Noveris',ox+72*k,oy+385*k,456*k,70*k,c.mInk,true,'center');
 else{a.text('Sticker / phrase',t[0],ox+72*k,oy+365*k,456*k,stickerSize[i]*k,c.mInk,true,'center');a.text('Sticker / phrase accent',t[1],ox+72*k,oy+365*k+stickerSize[i]*1.12*k,456*k,stickerSize[i]*k,acc,true,'center');}
 const cut=shape('CUT CONTOUR / VENDOR ADAPTATION REQUIRED',x,y,w,h,null,c.pink);op('node.set',{id:cut,visible:false});
}
for(let i=0;i<7;i++){const a=new Cv(`NOVERIS-STICKER-${String(i+1).padStart(2,'0')}`,600,600,i,600,'sticker',true);sticker(a,i);}
const sheet=new Cv('NOVERIS-Sticker-Sheet',1440,1640,7,1440,'reference');
sheet.glow('123, 63, 242',.35,900,700,-300);
sheet.text('Sticker collection title','A little curiosity, everywhere.',64,56,1312,64,c.mInk,true);sheet.label('NOVERIS / BRAND STICKER COLLECTION',64,150,1312,c.violetSoft,22);
for(let i=0;i<7;i++)sticker(sheet,i,60+(i%3)*450,235+Math.floor(i/3)*450,.68);
sheet.text('Production note','Seven individual transparent designs. Hidden source contours and separate magenta SVG guides are provided for vendor adaptation.',550,1270,790,28,c.mMuted);

// ---------- 06 Posters ----------
const poPage=newPage(pageNames[2].slice(P.length));
function poster(name,index,topic){
 const a=new Cv(name,mm(297),mm(420),index,1080);
 a.glow('123, 63, 242',.55,900,420,-300);a.glow('6, 214, 255',.2,900,-300,1000);a.rect('Brand / edge',0,0,170,9,grad(V,'#06D6FF'),0);
 a.brand(64,56,50);a.label(topic,446,78,570,c.violetSoft,21,'right');a.line('Header / rule',64,132,952);
 a.label('LEARN TOGETHER. GROW FURTHER.',64,1488,880,c.mQuiet,18);return a;
}
const p1=poster('NOVERIS-A3-01-BRAND',0,'INTRODUCING NOVERIS');
p1.label('A NEW CHAPTER IN LEARNING',64,188,800,c.violetSoft,24);p1.text('Headline','Learn together.',64,240,952,122,c.mInk,true);p1.text('Headline accent','Grow further.',64,240+122*1.07,952,122,c.violetSoft,true);
p1.text('Product positioning','Your AI-powered peer learning companion.',68,520,560,42,c.mMuted);
p1.ellipse('Brand / quiet orbit',380,610,720,720,null,c.border,2);p1.ellipse('Brand / inner orbit',450,680,580,580,null,'rgba(6, 214, 255, 0.35)',2);p1.image('learner',440,640,620);
['Course material.','Guided practice.','Shared understanding.'].forEach((t,i)=>p1.chip(t,64,880+i*92,400,68,i===2?V:c.mSurfaceDeep,i===2?c.white:c.mInk,28,i===2?null:c.border));
p1.rect('Contact panel',64,1316,952,150,c.mSurfaceDeep,36,c.border);p1.qr(88,1336,90,12);p1.text('Contact','Scan to explore Noveris.',250,1346,740,40,c.mInk,true);p1.text('Contact / placeholder','noveris.live',250,1404,740,32,c.violetSoft,true);
const p2=poster('NOVERIS-A3-02-WORKFLOW',1,'THE PRODUCT EXPERIENCE');
p2.text('Headline','From material',64,200,952,100,c.mInk,true);p2.text('Headline accent','to understanding.',64,200+100*1.07,952,100,c.violetSoft,true);
p2.text('Supporting copy','A connected workflow around what you’re studying.',68,440,960,34,c.mMuted);
[['Your course material','Bring the context you want to learn from.'],['Guidance and practice','Explore explanations and work through ideas.'],['Peer discussion','Ask questions and share your thinking.']].forEach(([t,b],i)=>{const y=560+i*250;p2.rect('Step card',64,y,952,222,i===0?grad('#1E1659','#15183B'):c.mSurfaceDeep,36,c.border);p2.text('Step number',`0${i+1}`,100,y+60,200,110,[c.violetSoft,c.cyan,c.pink][i],true);p2.text('Step title',t,300,y+52,680,50,c.mInk,true);p2.text('Step body',b,300,y+122,700,30,c.mMuted);});
p2.rect('Contact panel',64,1316,952,150,c.mSurfaceDeep,36,c.border);p2.qr(88,1336,90,12);p2.text('Contact','Keep the questions coming.',250,1346,740,40,c.mInk,true);p2.text('Contact / placeholder','noveris.live',250,1404,740,32,c.violetSoft,true);

// ---------- 07 Flyer ----------
const fyPage=newPage(pageNames[3].slice(P.length));
const f=new Cv('NOVERIS-A5-FLYER-FRONT',mm(148),mm(210),0,540);
f.glow('123, 63, 242',.55,520,200,-200);f.glow('6, 214, 255',.2,520,-200,420);f.rect('Brand / edge',0,0,100,6,grad(V,'#06D6FF'),0);
f.brand(32,34,34);f.label('YOUR PEER LEARNING COMPANION',32,100,476,c.violetSoft,13);
f.text('Flyer headline','Learning,\nmore',32,138,476,70,c.mInk,true);f.text('Flyer headline accent','connected.',32,138+70*1.07*2,476,70,c.violetSoft,true);
f.ellipse('Brand / quiet orbit',210,380,320,320,null,c.border,1.5);f.image('learner',210,330,310);
f.text('Product description','Bring course material, guided practice and peer discussion into one learning experience.',32,390,190,18,c.mMuted);
f.rect('CTA panel',32,640,476,96,c.mSurfaceDeep,22,c.border);f.qr(44,652,56,6);f.label('EXPLORE NOVERIS ↗',130,658,370,c.violetSoft,15);f.text('Contact','noveris.live',130,680,370,20,c.mInk,true);f.text('Contact / placeholder','Contact@noveris.live',130,706,370,13,c.mMuted);
f.label('LEARN TOGETHER. GROW FURTHER.',32,746,476,c.mQuiet,9.5);
const fb=new Cv('NOVERIS-A5-FLYER-BACK',mm(148),mm(210),1,540);
fb.glow('123, 63, 242',.5,520,200,-220);fb.glow('6, 214, 255',.18,480,-180,480);fb.rect('Brand / edge',0,0,100,6,grad(V,'#06D6FF'),0);
fb.text('Information headline','Make room',32,34,476,42,c.mInk,true);fb.text('Information headline accent','for understanding.',32,34+42*1.07,476,42,c.violetSoft,true);
[['LEARN WITH GUIDANCE','Ask for a clearer explanation, explore a different example and work through a concept.'],['THINK WITH PEERS','Discuss ideas and questions, with space for individual practice and reflection.'],['EXPLORE VISUALLY','Approach concepts through interactive practice in Visual Learning Lab.'],['FOR LEARNERS & EDUCATORS','Personal learning and reviewed course content, connected by a shared learning foundation.']].forEach(([t,b],i)=>{const y=140+i*112;fb.rect('Feature card',32,y,476,100,c.mSurfaceDeep,18,c.border);fb.ellipse('Feature number disc',46,y+28,44,44,i===3?grad('#06D6FF',V):grad(V,V2));fb.text('Feature number',String(i+1),46,y+38,44,22,c.white,true,'center',0);fb.label(t,106,y+14,390,c.violetSoft,12);fb.text('Product detail / '+t,b,106,y+36,390,14,c.mMuted);});
fb.rect('Contact panel',32,596,476,140,c.mSurfaceDeep,22,c.border);fb.qr(46,610,92,8);fb.label('SCAN TO EXPLORE',166,622,200,c.violetSoft,13);fb.text('Contact','noveris.live',166,644,260,22,c.mInk,true);fb.text('Contact / placeholder','Contact@noveris.live',166,676,260,13,c.mMuted);fb.image('graduate',392,604,128);
fb.label('NOVERIS / LEARN TOGETHER. GROW FURTHER.',32,746,476,c.mQuiet,9.5);

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const snapshot=path.join(dir,'print.before.local.json');
 execFileSync(cli,['convert',target,snapshot],{stdio:'pipe'});
 const before=JSON.parse(fs.readFileSync(snapshot));
 const old=pageNames.map(n=>{const m=Object.values(before.nodes).filter(x=>x.type==='page'&&x.name===n);if(m.length!==1)throw Error(`Expected one page ${n}; found ${m.length}`);return m[0];});
 const order=before.pages||[];const idx=old.map(p=>order.indexOf(p.id));
 const script=[...ops,...old.map(p=>({command:'page.delete',params:{id:p.id}})),...[idPage,stPage,poPage,fyPage].map((p,i)=>({command:'page.move',params:{id:p,index:idx[i]}}))];
 const sp=path.join(dir,'print.script.local.json'),pending=path.join(dir,'print.pending.local.figcraft');
 fs.writeFileSync(sp,JSON.stringify(script));
 execFileSync(cli,['run',sp,'--in',target,'--out',pending],{stdio:'pipe',maxBuffer:30*1024*1024});
 execFileSync(cli,['convert',pending,path.join(dir,'print.after.local.json')],{stdio:'pipe'});
 const after=JSON.parse(fs.readFileSync(path.join(dir,'print.after.local.json')));
 const removed=new Set();const visit=id=>{removed.add(String(id));for(const ch of before.nodes[id].children||[])visit(ch);};old.forEach(p=>visit(p.id));
 for(const [id,node] of Object.entries(before.nodes))if(!removed.has(id)&&JSON.stringify(node)!==JSON.stringify(after.nodes[id]))throw Error(`Unrelated node changed: ${node.name}`);
 fs.copyFileSync(pending,target);
 console.log(`Rebuilt print pages. Preserved ${Object.keys(before.nodes).length-removed.size} unrelated layers. page order idx: ${idx}`);
}
