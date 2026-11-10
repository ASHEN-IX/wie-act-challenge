import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
const cli=process.env.FIGCRAFT_CLI || 'figcraft-cli';
const file=path.join(dir,'design-noveris.figcraft'),out=path.join(dir,'exports/noveris-startup');
fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'campaign.manifest.json')));
const only=process.argv[2];
for(const item of manifest){
 if(only&&!item.name.includes(only))continue;
 const scale=item.kind==='sticker'?2:['reference','foundation'].includes(item.kind)?.75:1;
 execFileSync(cli,['export',file,'--page',item.page,'--node',item.name,'--out',path.join(out,`${item.name}.png`),'--scale',String(scale)],{stdio:'pipe'});
 if(item.kind==='foundation'){
  const legacy=['01-Colour','02-Typography','03-Space-surface','04-Layout','05-Logo','06-Components','07-Post-1x1','08-Badge-1x1','09-Story-9x16','10-Link-card','11-Wide-4x5','12-Slide-16x9','13-Badge-set'];
  fs.copyFileSync(path.join(out,`${item.name}.png`),path.join(dir,'exports',legacy[Number(item.name.slice(-2))-1]+'.png'));
 }
 if(item.kind==='sticker'){
  execFileSync(cli,['export',file,'--page',item.page,'--node',item.name,'--out',path.join(out,`${item.name}.svg`)],{stdio:'pipe'});
  const i=Number(item.name.slice(-2))-1;
  const r=[130,null,60,200,90,150,110][i];const shape=r===null?'<circle cx="300" cy="300" r="268"/>':`<rect x="32" y="32" width="536" height="536" rx="${r}"/>`;
  fs.writeFileSync(path.join(out,`${item.name}-CUT-GUIDE.svg`),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><title>Vendor-adaptable cut guide; not a calibrated spot-colour production plate</title><g id="CutContour" fill="none" stroke="#FF00FF" stroke-width="1">${shape}</g></svg>`);
 }
 console.log(`Exported ${item.name}`);
}
for(const [key,name] of [['04 — Team Identity Cards (3)','NOVERIS-Team-IDs-Proof'],['06 — Product Posters (2)','NOVERIS-A3-Posters-Proof'],['07 — Company Flyer (Front + Back)','NOVERIS-A5-Flyer-Proof']]){
 if(only)continue;
 execFileSync(cli,['export',file,'--page',`NOVERIS / STARTUP LAUNCH / ${key}`,'--out',path.join(out,`${name}.pdf`),'--bleed','3mm','--crop-marks','--cmyk'],{stdio:'pipe'});console.log(`Exported ${name}.pdf`);
}
