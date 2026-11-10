/** Professional Noveris launch feed; preserves the established brand assets. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {color as c} from './tokens.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
export const startupPage='NOVERIS / STARTUP LAUNCH / Feed Posts (12)';

export function generateStartupPosts({count=12}={}){
 const ops=[],frames=[];let seq=0;
 const op=(command,params={},create=false)=>{const as=create?`startup${++seq}`:undefined;ops.push({command,params,...(as?{as}:{})});return as?{$ref:as}:null;};
 const pg=op('page.add',{name:startupPage},true);
 const V='#7B3FF2',V2='#A987FF',P='#6B32D9';
 const grad=(a,b)=>({type:'linearGradient',stops:[a,b],from:[0,0],to:[1,1]});
 const glowFill=(rgb,a)=>({type:'radialGradient',stops:[`rgba(${rgb}, ${a})`,`rgba(${rgb}, 0)`]});
 class Post{
  constructor(n,topic,light=false){
   this.n=n;this.light=light;this.ink=light?c.lFg:c.mInk;this.muted=light?c.lMutedFg:c.mMuted;this.surface=light?c.lCard:c.mSurfaceDeep;this.accent=light?c.lPrimary:c.violetSoft;this.line_=light?c.lBorder:c.border;
   this.name=`NOVERIS-POST-${String(n).padStart(2,'0')}`;
   this.root=op('frame.create',{name:this.name,x:((n-1)%4)*1200,y:Math.floor((n-1)/4)*1490,width:1080,height:1350,props:{fills:[light?c.lBg:c.mBg],clip:true}},true);
   frames.push({name:this.name,page:startupPage,width:1080,height:1350,kind:'social',transparent:false});
   op('export.add',{ids:[this.root],setting:{format:'png',size:'1x'}});
   this.glow(light?'107, 50, 217':'123, 63, 242',light?.20:.55,560,-260,-240);
   this.glow(light?'6, 214, 255':'6, 214, 255',light?.14:.20,700,-380,1000);
   this.rect('Brand / edge',64,0,170,9,grad(V,'#06D6FF'),0);
   const logo=op('instance.create',{component:321,parent:this.root,x:64,y:61},true);op('transform.scale',{ids:[logo],factor:.55});
   this.text('Brand / original wordmark typography','Noveris',140,54,420,44,this.ink,true);
   this.text('Editorial topic',topic.toUpperCase(),546,70,470,21,this.accent,true,'right',3);
   this.line('Header / rule',64,132,952);
  }
  glow(rgb,a,size,x,y){const id=op('shape.ellipse',{name:'Ambient glow',parent:this.root,x:x<0?(1080+x-size*0+ -0):x,y,width:size,height:size,props:{fills:[glowFill(rgb,a)]}},true);return id;}
  rect(name,x,y,w,h,fill=this.surface,r=24,stroke=null,sw=1.5){return op('shape.rectangle',{name,parent:this.root,x,y,width:w,height:h,props:{fills:fill?[fill]:[],cornerRadius:r,...(stroke?{strokes:[stroke],strokeWeight:sw}:{})}},true);}
  ellipse(name,x,y,w,h,fill=null,stroke=null,sw=1){return op('shape.ellipse',{name,parent:this.root,x,y,width:w,height:h,props:{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:sw}:{})}},true);}
  text(name,text,x,y,w,size=30,fill=this.ink,bold=false,align='left',ls=null){
   const props={fontFamily:bold?'Sora':'Inter',fontStyle:bold?'Bold':'Regular',fontSize:size,lineHeight:bold?'108%':'142%',letterSpacing:ls!==null?ls:(bold?-size*.025:0),textAutoResize:'height',textAlign:align,fills:[fill]};
   const id=op('text.create',{name,text,parent:this.root,x,y,width:w,props},true);op('style.apply',{ids:[id],style:bold?'Heading/H2':'Body/Default'});op('node.set',{id,...props});return id;
  }
  line(name,x,y,w,col=this.line_){return op('shape.line',{name,parent:this.root,x,y,width:w,props:{strokes:[col],strokeWeight:1.5}},true);}
  vector(name,p,x,y,w,h,fill=this.accent,stroke=null,sw=3){return op('vector.create',{name,path:p,parent:this.root,x,y,width:w,height:h,props:{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:sw,strokeCap:'round',strokeJoin:'round'}:{})}},true);}
  // Headline: one text per line so the final line can carry the accent colour.
  title(lines,size,y=190,accentLast=true){lines.forEach((t,i)=>this.text('Headline',t,64,y+i*size*1.07,952,size,accentLast&&i===lines.length-1?this.accent:this.ink,true));return y+lines.length*size*1.07;}
  sub(text,y,w=900,size=38){this.text('Supporting copy',text,68,y,w,size,this.muted);}
  mascot(stage,x,y,size){op('image.place',{name:`Approved Nardouch / ${stage}`,path:path.join(dir,`../apps/web/public/images/nardouch-${stage}-transparent.png`),parent:this.root,x,y,width:size,height:size,mode:'fit'},true);}
  label(text,x,y,w=900,col=this.accent,size=24){this.text(`Label / ${text}`,text,x,y,w,size,col,true,'left',3);}
  chip(text,x,y,w,h=60,fill=this.surface,fg=this.ink,size=26,stroke=this.line_){this.rect(`Chip / ${text}`,x,y,w,h,fill,h/2,stroke);this.text(`Chip label / ${text}`,text,x,y+(h-size*1.1)/2,w,size,fg,true,'center',0);}
  footer(cta){this.rect('Footer / CTA bar',64,1186,952,84,grad(V,P),42);this.text('Editorial CTA',cta,100,1186+(84-30*1.08)/2,780,30,c.white,true,'left',-.4);this.ellipse('Footer / arrow disc',930,1196,64,64,'rgba(255, 255, 255, 0.2)');this.text('Footer / arrow','↗',930,1204,64,40,c.white,true,'center',0);this.label('LEARN TOGETHER. GROW FURTHER.',64,1298,880,this.muted,18);}
 }

 for(let n=1;n<=count;n++){
  const topic=['Introducing Noveris','The learning problem','Meet Nardouch','From course to practice','Guided understanding','Study Together','Visual Learning Lab','Personal progress','Multilingual learning','For learners and educators','Our product philosophy','Join the conversation'][n-1];
  const a=new Post(n,topic,[3,6,10].includes(n));
  switch(n){
   case 1:{
    a.label('A NEW CHAPTER IN LEARNING',64,188);a.title(['Learn together.','Grow further.'],118,240);
    a.sub('Meet Noveris.\nYour AI-powered peer\nlearning companion.',520,540,40);
    a.ellipse('Brand / quiet orbit',390,520,700,700,null,c.border,2);a.ellipse('Brand / quiet orbit inner',460,590,560,560,null,'rgba(6, 214, 255, 0.35)',2);a.mascot('learner',455,560,600);
    ['More understanding.','More connection.','A clearer next step.'].forEach((t,i)=>a.chip(t,64,830+i*86,380,64,i===2?V:c.mSurfaceDeep,i===2?c.white:c.mInk,27,i===2?null:c.border));
    a.footer('Follow the Noveris journey.');break;}
   case 2:{
    a.title(['More notes.','Less clarity?'],124);a.sub('Learning takes more than collecting information.',480,900,38);
    [['PDF','Course materials'],['?','An unanswered question'],['→','A useful next step']].forEach(([v,t],i)=>{const x=64+i*325;a.rect(`Learning friction / ${t}`,x,640,302,390,i===2?grad(V,'#4B22B5'):c.mSurfaceDeep,28,i===2?null:c.border);a.text('Learning friction / symbol',v,x+28,676,250,i===0?100:140,i===2?c.white:c.violetSoft,true);a.text('Learning friction / label',t,x+28,860,250,36,c.mInk,true);});
    a.text('Problem insight','We’re building around the moment when reading needs to become understanding.',68,1062,940,32,a.muted);a.footer('What gets in the way of your learning?');break;}
   case 3:{
    a.title(['A companion','for the moments','you get stuck.'],100);a.sub('Meet Nardouch, the learning\ncompanion inside Noveris.',545,900,36);
    a.glow('107, 50, 217',.28,620,500,640);a.mascot('explorer',540,650,520);
    [['EXPLAIN IT SIMPLY','A clearer explanation.'],['TRY ANOTHER ANGLE','A different example.'],['KEEP THINKING','A question that helps.']].forEach(([l,t],i)=>{const y=690+i*165;a.label(l,64,y,470,a.accent,22);a.text('Companion / feature',t,64,y+40,470,40,a.ink,true);if(i<2)a.line('Feature divider',64,y+140,440);});
    a.footer('Get to know your learning companion.');break;}
   case 4:{
    a.title(['Your course.','A clearer path.'],112);a.sub('Turn course material into\na guided learning workflow.',455,900,38);
    [['Bring your material','Start with your course documents.'],['Review the content','Check the draft before publication.'],['Learn and practise','Read, ask questions and work through activities.']].forEach(([t,b],i)=>{const y=610+i*172;a.rect(`Step / ${t}`,64,y,952,150,i===0?grad('#1E1659','#15183B'):c.mSurfaceDeep,28,c.border);a.text('Step / number',`0${i+1}`,96,y+34,110,76,i===2?c.cyan:c.violetSoft,true);a.text('Step / title',t,222,y+30,760,42,a.ink,true);a.text('Step / body',b,222,y+86,760,28,a.muted);});
    a.footer('Explore the course-to-practice workflow.');break;}
   case 5:{
    a.title(['Go beyond','the answer.'],120);a.sub('Good guidance makes room\nfor your own reasoning.',475,900,38);
    a.label('AN ILLUSTRATIVE LEARNING FLOW',64,628,952,a.accent,22);
    a.rect('Learner / question',160,680,856,150,grad(V,'#4B22B5'),32);a.text('Learner / example prompt','“Why does this step work?”',200,730,780,42,c.white,true);
    a.rect('Tutor / guiding question',64,860,860,215,c.mSurfaceDeep,32,c.cyan,2);a.label('NARDOUCH',100,890,780,c.cyan,22);a.text('Tutor / example response','“Let’s break it down. What changes if we try a simpler example?”',100,934,790,36,a.ink,true);
    [['Hints',64,150],['Questions',230,210],['Examples',456,200],['A way forward',672,290]].forEach(([t,x,w])=>a.chip(t,x,1098,w,56,c.mSurfaceDeep,c.violetSoft,24,c.border));
    a.footer('Stay curious. Keep asking why.');break;}
   case 6:{
    a.title(['Study together.','Think for','yourself.'],104);a.sub('Shared discussion. Space for\nindividual understanding.',545,900,36);
    a.ellipse('Peer room / boundary',310,700,460,460,V+'1F',c.lBorder,2);a.rect('Peer room / center',360,855,360,150,grad(V,'#4B22B5'),36);a.text('Peer room / title','Study\nTogether',360,883,360,44,c.white,true,'center');
    [[96,700,'Ask'],[834,700,'Discuss'],[96,985,'Practise'],[834,985,'Reflect']].forEach(([x,y,t])=>{a.ellipse(`Peer / ${t}`,x,y,150,150,c.lCard,V2,3);a.text(`Peer / ${t}`,t,x,y+55,150,28,a.ink,true,'center',0);});
    a.footer('Bring your questions. Learn with your peers.');break;}
   case 7:{
    a.title(['See the idea.','Explore the how.'],98);a.sub('Concepts become interactive practice.',405,900,36);
    a.rect('Visual Lab / illustration',64,520,952,540,c.mSurfaceDeep,32,c.border);a.label('CONCEPT VIEW / ILLUSTRATION',100,556,850,c.violetSoft,20);
    [660,740,820,900].forEach(y=>a.line('Graph / grid',100,y,880,'rgba(178, 147, 255, 0.12)'));a.line('Graph / horizontal axis',100,940,880,c.mQuiet);
    a.glow('6, 214, 255',.28,420,360,640);
    a.vector('Graph / curve','M0 230 C150 230 180 140 330 130 C500 115 560 30 800 0',130,700,800,230,null,c.cyan,9);
    [[130,930,18],[930,700,18]].forEach(([x,y,r])=>a.ellipse('Graph / point',x-r/2,y-r/2,r,r,c.cyan));a.ellipse('Graph / focus ring',460-28,830-28,56,56,'rgba(6, 214, 255, 0.18)',c.cyan,3);a.ellipse('Graph / focus point',460-12,830-12,24,24,c.white);
    a.text('Visual Lab / variable','VARIABLE',100,972,200,20,c.violetSoft,true,'left',3);a.rect('Slider / track',100,1022,780,8,c.border,4);a.rect('Slider / value',100,1022,430,8,c.violet,4);a.ellipse('Slider / knob',512,1010,32,32,c.white);
    a.footer('Make room for a different way to learn.');break;}
   case 8:{
    a.title(['Small steps.','Visible','progress.'],112);a.sub('Make time to reflect on what you’re learning.',570,900,36);
    a.label('AN EXAMPLE STUDY RHYTHM',64,650,952,a.accent,22);
    [['Read a concept','Start with the course material.'],['Try it yourself','Put the idea into practice.'],['Reflect and revisit','Use feedback to choose your next step.']].forEach(([t,b],i)=>{const y=696+i*152;a.rect('Study rhythm / card',64,y,952,134,c.mSurfaceDeep,28,c.border);a.ellipse('Study rhythm / step',92,y+27,80,80,i===2?grad('#06D6FF','#7B3FF2'):grad(V,'#4B22B5'));a.text('Study rhythm / index',String(i+1),92,y+43,80,44,c.white,true,'center',0);a.text('Study rhythm / action',t,200,y+22,780,40,a.ink,true);a.text('Study rhythm / explanation',b,200,y+74,780,28,a.muted);});
    a.footer('Keep learning, one considered step at a time.');break;}
   case 9:{
    a.title(['Learning speaks','your language.'],96);a.sub('Explore explanations in English, French and Darija.',405,900,36);
    [['EN','Let’s understand it.',c.mInk,V],['FR','Comprendre, ensemble.',c.violetSoft,'#4B22B5'],['DAR','Nefhmou m3a baadhna.',c.cyanSoft,'#0A7C99']].forEach(([tag,t,col,bg],i)=>{const y=560+i*196;a.rect('Language / card',64,y,952,170,c.mSurfaceDeep,32,c.border);a.rect('Language / tag',96,y+45,110,80,bg,22);a.text('Language / tag label',tag,96,y+67,110,32,c.white,true,'center',1);a.text('Language / phrase',t,236,y+58,760,54,col,true);});
    a.footer('How do you like to learn?');break;}
   case 10:{
    a.title(['For curious minds.','For educators.'],84);a.sub('A shared foundation for personal\nand classroom learning.',380,900,36);
    [['PERSONAL LEARNING','For learners',['Your course material.','Guided practice.','Room to ask questions.'],false],['TEACHING & LEARNING','For educators',['Reviewed course content.','Structured activities.','Peer discussion space.'],true]].forEach(([l,t,items,hi],i)=>{const x=64+i*488;a.rect(`Audience / ${t}`,x,540,464,610,hi?grad(V,'#4B22B5'):c.lCard,36,hi?null:c.lBorder);a.label(l,x+36,580,400,hi?'#D9C8FF':a.accent,19);a.text('Audience / title',t,x+36,630,400,52,hi?c.white:a.ink,true);a.line('Audience / rule',x+36,720,392,hi?'rgba(255, 255, 255, 0.3)':c.lBorder);items.forEach((it,j)=>{a.ellipse('Audience / dot',x+36,780+j*108,16,16,hi?c.cyanSoft:V);a.text('Audience / item',it,x+68,764+j*108,370,34,hi?c.white:a.ink,true);});});
    a.footer('Let’s talk about your learning context.');break;}
   case 11:{
    a.label('WHAT WE’RE BUILDING TOWARD',64,188);a.title(['Technology','should bring','learning closer.'],98,240);
    [['01','Clarity','Make complex ideas easier to approach.'],['02','Connection','Keep peers part of the learning process.'],['03','Curiosity','Support questions, exploration and practice.']].forEach(([num,t,b],i)=>{const y=640+i*178;a.text('Principle / number',num,64,y,130,76,[c.violetSoft,c.cyan,c.pink][i],true);a.text('Principle / title',t,210,y-4,780,56,a.ink,true);a.text('Principle / meaning',b,210,y+68,780,30,a.muted);if(i<2)a.line('Principle / divider',64,y+148,952);});
    a.footer('That’s the thinking behind Noveris.');break;}
   case 12:{
    a.label('THIS IS THE BEGINNING',64,188);a.title(['Let’s shape','better learning.'],104,240);
    a.sub('We’re building Noveris around real learning needs. Your questions and experiences can help shape the journey.',500,900,34);
    a.rect('Invitation / question panel',64,700,952,420,grad(V,'#3A1A99'),40);a.label('WE’D LOVE TO KNOW',104,774,500,'#D9C8FF',22);a.text('Invitation / question','What would make your next study session better?',104,826,540,52,c.white,true);a.mascot('graduate',660,730,350);
    a.footer('Share your thoughts. Follow what comes next.');break;}
  }
 }
 return {ops,frames,page:pg};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const cli=process.env.FIGCRAFT_CLI||'figcraft-cli';
 const target=path.join(dir,'design-noveris.figcraft');
 const snapshot=path.join(dir,'startup.before.local.json');
 execFileSync(cli,['convert',target,snapshot],{stdio:'pipe'});
 const before=JSON.parse(fs.readFileSync(snapshot));
 const old=Object.values(before.nodes).filter(n=>n.type==='page'&&(n.name===startupPage||n.name==='EDNOVA / MARKETING CAMPAIGN / 02 — Social Media Posts (12)'));
 if(old.length!==1)throw Error(`Expected one feed page; found ${old.length}`);
 const campaign=generateStartupPosts();
 const ops=[...campaign.ops,{command:'page.delete',params:{id:old[0].id}},{command:'page.move',params:{id:campaign.page,index:14}},{command:'page.select',params:{id:campaign.page}}];
 const script=path.join(dir,'startup.script.local.json'),pending=path.join(dir,'startup.pending.figcraft');
 fs.writeFileSync(script,JSON.stringify(ops));
 fs.writeFileSync(path.join(dir,'startup.manifest.json'),JSON.stringify(campaign.frames,null,2));
 execFileSync(cli,['run',script,'--in',target,'--out',pending],{stdio:'pipe',maxBuffer:10*1024*1024});
 execFileSync(cli,['convert',pending,path.join(dir,'startup.after.local.json')],{stdio:'pipe'});
 const after=JSON.parse(fs.readFileSync(path.join(dir,'startup.after.local.json')));
 const removed=new Set();const visit=id=>{removed.add(String(id));for(const child of before.nodes[id].children||[])visit(child);};visit(old[0].id);
 for(const [id,node] of Object.entries(before.nodes))if(!removed.has(id)&&JSON.stringify(node)!==JSON.stringify(after.nodes[id]))throw Error(`Unrelated node changed: ${node.name}`);
 fs.copyFileSync(pending,target);
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'campaign.manifest.json'))).filter(f=>!f.name.startsWith('EDNOVA-POST')&&!f.name.startsWith('NOVERIS-POST'));
 manifest.push(...campaign.frames);fs.writeFileSync(path.join(dir,'campaign.manifest.json'),JSON.stringify(manifest,null,2));
 console.log(`Updated 12 startup posts. Preserved ${Object.keys(before.nodes).length-removed.size} unrelated layers.`);
}
