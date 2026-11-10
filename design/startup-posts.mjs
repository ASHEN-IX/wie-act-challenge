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
 class Post{
  constructor(n,topic,light=false){
   this.n=n;this.light=light;this.ink=light?c.lFg:c.mInk;this.muted=light?c.lMutedFg:c.mMuted;this.surface=light?c.lCard:c.mSurfaceDeep;this.accent=light?c.lPrimary:c.violetSoft;
   this.name=`NOVERIS-POST-${String(n).padStart(2,'0')}`;
   this.root=op('frame.create',{name:this.name,x:((n-1)%4)*1200,y:Math.floor((n-1)/4)*1490,width:1080,height:1350,props:{fills:[light?c.lBg:c.mBg],clip:true}},true);
   frames.push({name:this.name,page:startupPage,width:1080,height:1350,kind:'social',transparent:false});
   op('export.add',{ids:[this.root],setting:{format:'png',size:'1x'}});
   this.rect('Brand / edge',64,0,130,7,light?c.lPrimary:c.violet,0);
   const logo=op('instance.create',{component:321,parent:this.root,x:64,y:61},true);op('transform.scale',{ids:[logo],factor:.48});
   this.text('Brand / original wordmark typography','Noveris',132,55,420,41,this.ink,true);
   this.text('Editorial topic',topic.toUpperCase(),646,72,370,17,this.accent,true,'right');
   this.line('Header / rule',64,132,952);
  }
  rect(name,x,y,w,h,fill=this.surface,r=22,stroke=null){return op('shape.rectangle',{name,parent:this.root,x,y,width:w,height:h,props:{fills:fill?[fill]:[],cornerRadius:r,...(stroke?{strokes:[stroke],strokeWeight:1}:{})}},true);}
  ellipse(name,x,y,w,h,fill=null,stroke=null,sw=1){return op('shape.ellipse',{name,parent:this.root,x,y,width:w,height:h,props:{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:sw}:{})}},true);}
  text(name,text,x,y,w,size=30,fill=this.ink,bold=false,align='left'){
   const props={fontFamily:bold?'Sora':'Inter',fontStyle:bold?'Bold':'Regular',fontSize:size,lineHeight:bold?'110%':'145%',letterSpacing:bold?-size*.025:0,textAutoResize:'height',textAlign:align,fills:[fill]};
   const id=op('text.create',{name,text,parent:this.root,x,y,width:w,props},true);op('style.apply',{ids:[id],style:bold?'Heading/H2':'Body/Default'});op('node.set',{id,...props});return id;
  }
  line(name,x,y,w,col=this.light?c.lBorder:c.border){return op('shape.line',{name,parent:this.root,x,y,width:w,props:{strokes:[col],strokeWeight:1}},true);}
  vector(name,p,x,y,w,h,fill=this.accent,stroke=null,sw=3){return op('vector.create',{name,path:p,parent:this.root,x,y,width:w,height:h,props:{fills:fill?[fill]:[],...(stroke?{strokes:[stroke],strokeWeight:sw,strokeCap:'round',strokeJoin:'round'}:{})}},true);}
  title(text,sub='',size=84){this.text('Headline',text,64,208,952,size,this.ink,true);if(sub)this.text('Supporting copy',sub,68,208+text.split('\n').length*size*1.1+32,920,30,this.muted);}
  mascot(stage,x,y,size){op('image.place',{name:`Approved Nardouch / ${stage}`,path:path.join(dir,`../apps/web/public/images/nardouch-${stage}-transparent.png`),parent:this.root,x,y,width:size,height:size,mode:'fit'},true);}
  label(text,x,y,w=900,col=this.accent,size=19){this.text(`Label / ${text}`,text,x,y,w,size,col,true);}
  footer(cta){this.line('Footer / rule',64,1200,952);this.text('Editorial CTA',cta,64,1230,850,25,this.ink,true);this.text('Footer / arrow','↗',948,1220,68,42,this.accent,true,'right');this.label('LEARN TOGETHER. GROW FURTHER.',64,1300,880,this.muted,16);}
  panel(title,body,x,y,w,h,num='',col=this.accent){this.rect(`Panel / ${title}`,x,y,w,h,this.surface,22,this.light?c.lBorder:c.border);if(num)this.label(num,x+28,y+26,w-56,col,20);this.text(`Panel heading / ${title}`,title,x+28,y+(num?(h<200?54:74):30),w-56,32,this.ink,true);if(body)this.text(`Panel body / ${title}`,body,x+28,y+(num?(h<200?105:131):88),w-56,25,this.muted);}
 }

 for(let n=1;n<=count;n++){
  const topic=['Introducing Noveris','The learning problem','Meet Nardouch','From course to practice','Guided understanding','Study Together','Visual Learning Lab','Personal progress','Multilingual learning','For learners and educators','Our product philosophy','Join the conversation'][n-1];
  const a=new Post(n,topic,[3,6,10].includes(n));
  switch(n){
   case 1:
    a.label('A NEW CHAPTER IN LEARNING',64,194);a.text('Launch statement','Learn together.\nGrow further.',64,258,952,102,a.ink,true);
    a.text('Product introduction','Meet Noveris. Your AI-powered\npeer learning companion.',68,525,780,35,a.muted);
    a.ellipse('Brand / quiet orbit',525,676,460,460,null,c.border,2);a.ellipse('Brand / quiet orbit inner',570,721,370,370,null,c.border,1);a.mascot('learner',535,640,480);
    a.text('Brand belief','More understanding.\nMore connection.\nA clearer next step.',64,800,470,38,a.ink,true);a.footer('Follow the Noveris journey.');break;
   case 2:
    a.title('More notes.\nLess clarity?','Learning takes more than collecting information.',88);
    [['PDF','Course materials'],['?','An unanswered question'],['→','A useful next step']].forEach(([v,t],i)=>{const x=64+i*325;a.rect(`Learning friction / ${t}`,x,618,302,345,i===2?c.violet:c.mSurfaceDeep,22,c.border);a.text('Learning friction / symbol',v,x+26,654,250,i===0?65:90,i===2?c.white:c.violetSoft,true);a.text('Learning friction / label',t,x+26,818,250,27,c.mInk,true);});
    a.text('Problem insight','We’re building around the moment\nwhen reading needs to become understanding.',68,1040,900,30,a.muted);a.footer('What gets in the way of your learning?');break;
   case 3:
    a.title('A companion\nfor the moments\nyou get stuck.','Meet Nardouch, the learning companion inside Noveris.',79);
    a.mascot('explorer',590,640,420);a.label('EXPLAIN IT SIMPLY',64,688,520);a.text('Companion / explanation','A clearer explanation.',64,730,570,34,a.ink,true);a.line('Feature divider 1',64,800,480);a.label('TRY ANOTHER ANGLE',64,846,520);a.text('Companion / example','A different example.',64,888,570,34,a.ink,true);a.line('Feature divider 2',64,960,480);a.text('Companion / intent','Guidance that helps you keep thinking.',64,1054,920,30,a.muted);a.footer('Get to know your learning companion.');break;
   case 4:
    a.title('Your course.\nA clearer path.','Turn course material into a guided learning workflow.');
    [['Bring your material','Start with your course documents.'],['Review the content','Check the draft before publication.'],['Learn and practise','Read, ask questions and work through activities.']].forEach(([t,b],i)=>a.panel(t,b,64,572+i*190,952,166,`0${i+1}`));
    a.footer('Explore the course-to-practice workflow.');break;
   case 5:
    a.title('Go beyond\nthe answer.','Good guidance makes room for your own reasoning.',90);
    a.label('AN ILLUSTRATIVE LEARNING FLOW',64,552,952,a.accent,18);
    a.rect('Learner / question',210,622,806,142,c.secondary,22);a.text('Learner / example prompt','“Why does this step work?”',244,665,738,33,a.ink,true);
    a.rect('Tutor / guiding question',64,802,852,220,c.mSurfaceDeep,22,c.border);a.label('NARDOUCH',96,834,780);a.text('Tutor / example response','“Let’s break it down.\nWhat changes if we try a simpler example?”',96,885,780,32,a.ink,true);
    a.text('Learning principle','Hints. Questions. Examples. A way forward.',68,1092,920,29,a.muted);a.footer('Stay curious. Keep asking why.');break;
   case 6:
    a.title('Study together.\nThink for yourself.','Shared discussion. Space for individual understanding.',83);
    a.ellipse('Peer room / boundary',260,562,560,560,null,c.lBorder,2);a.rect('Peer room / center',310,754,460,170,c.lPrimary,28);a.text('Peer room / title','Study Together',330,798,420,40,c.white,true,'center');
    [[170,585,'Ask'],[740,585,'Discuss'],[170,990,'Practise'],[740,990,'Reflect']].forEach(([x,y,t],i)=>{a.ellipse(`Peer / ${t}`,x,y,170,170,c.lCard,c.lBorder,2);a.text(`Peer / ${t}`,t,x+8,y+62,154,24,a.ink,true,'center');});
    a.footer('Bring your questions. Learn with your peers.');break;
   case 7:
    a.title('See the idea.\nExplore the how.','Visual Learning Lab turns concepts into interactive practice.',85);
    a.rect('Visual Lab / illustration',64,580,952,462,c.mSurfaceDeep,22,c.border);a.label('CONCEPT VIEW / ILLUSTRATION',96,616,850,c.violetSoft,18);
    a.line('Graph / horizontal axis',158,936,740,c.mQuiet);a.vector('Graph / curve','M0 180 C90 180 90 110 180 110 C270 110 280 10 400 10',170,730,690,188,null,c.cyan,6);
    [[170,910],[330,860],[495,818],[690,740],[860,730]].forEach(([x,y])=>a.ellipse('Graph / point',x-8,y-8,16,16,c.cyan));
    a.text('Visual Lab / invitation','Change a variable. Observe. Ask another question.',96,980,850,23,a.muted);a.text('Practice context','A space to explore concepts and check understanding.',68,1092,920,29,a.muted);a.footer('Make room for a different way to learn.');break;
   case 8:
    a.title('Small steps.\nVisible progress.','Make time to reflect on what you’re learning.',88);
    a.label('AN EXAMPLE STUDY RHYTHM',64,562,952,a.accent,18);
    [['Read a concept','Start with the course material.'],['Try it yourself','Put the idea into practice.'],['Reflect and revisit','Use feedback to choose your next step.']].forEach(([t,b],i)=>{a.ellipse('Study rhythm / step',68,641+i*158,58,58,null,i===2?c.cyan:c.violetSoft,2);a.text('Study rhythm / index',String(i+1),73,651+i*158,48,29,a.ink,true,'center');a.text('Study rhythm / action',t,166,632+i*158,820,34,a.ink,true);a.text('Study rhythm / explanation',b,166,687+i*158,820,27,a.muted);if(i<2)a.line('Study rhythm / divider',166,757+i*158,820);});
    a.footer('Keep learning, one considered step at a time.');break;
   case 9:
    a.title('Learning speaks\nyour language.','Explore explanations in English, French and Darija.',83);
    a.text('Language / English','Let’s understand it.',64,598,952,58,c.mInk,true);a.line('Language / divider 1',64,709,952);a.text('Language / French','Comprendre, ensemble.',64,770,952,53,c.violetSoft,true);a.line('Language / divider 2',64,881,952);a.text('Language / Darija','Nefhmou m3a baadhna.',64,942,952,52,c.cyanSoft,true);a.text('Language / principle','Different words. Shared curiosity.',68,1100,900,29,a.muted);a.footer('How do you like to learn?');break;
   case 10:
    a.title('For curious minds.\nFor educators.','A shared foundation for personal and classroom learning.',80);
    a.panel('For learners','Your course material.\nGuided practice.\nRoom to ask questions.',64,610,464,440,'PERSONAL LEARNING');a.panel('For educators','Reviewed course content.\nStructured activities.\nA space for peer discussion.',552,610,464,440,'TEACHING & LEARNING');a.footer('Let’s talk about your learning context.');break;
   case 11:
    a.label('WHAT WE’RE BUILDING TOWARD',64,194);a.text('Product philosophy','Technology\nshould bring\nlearning closer.',64,278,952,99,a.ink,true);
    [['01','Clarity','Make complex ideas easier to approach.'],['02','Connection','Keep peers part of the learning process.'],['03','Curiosity','Support questions, exploration and practice.']].forEach(([num,t,b],i)=>{a.label(num,64,725+i*136,100);a.text('Principle / title',t,176,715+i*136,810,37,a.ink,true);a.text('Principle / meaning',b,176,775+i*136,810,26,a.muted);});a.footer('That’s the thinking behind Noveris.');break;
   case 12:
    a.label('THIS IS THE BEGINNING',64,194);a.text('Community invitation','Let’s shape\nbetter learning.',64,278,952,100,a.ink,true);
    a.text('Invitation context','We’re building Noveris around real learning needs.\nYour questions and experiences can help shape the journey.',68,560,920,33,a.muted);
    a.rect('Invitation / question panel',64,790,952,268,c.mSurfaceDeep,28,c.border);a.label('WE’D LOVE TO KNOW',100,832,880);a.text('Invitation / question','What would make your next\nstudy session better?',100,896,880,48,a.ink,true);a.footer('Share your thoughts. Follow what comes next.');break;
  }
 }
 return {ops,frames,page:pg};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const cli=process.env.FIGCRAFT_CLI||'C:/Program Files/ArtCraft/FigCraft/figcraft-cli.exe';
 const target=path.join(dir,'design-noveris-live.figcraft');
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
