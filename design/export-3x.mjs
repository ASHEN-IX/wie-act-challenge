import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
const cli=process.env.FIGCRAFT_CLI||'figcraft-cli';
const output=path.join(dir,'exports-3x');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'campaign.manifest.json')));
function folder(item){
 if(item.kind==='foundation')return '01-Fondations-et-modeles';
 if(item.name.startsWith('NOVERIS-POST'))return '02-Publications';
 if(item.name.startsWith('NOVERIS-STORY'))return '03-Stories';
 if(item.name.startsWith('NOVERIS-ID'))return '04-Badges-equipe';
 if(item.name.startsWith('NOVERIS-STICKER')||item.name==='NOVERIS-Sticker-Sheet')return '05-Stickers';
 if(item.name.startsWith('NOVERIS-A3'))return '06-Affiches-A3';
 if(item.name.startsWith('NOVERIS-A5'))return '07-Flyer-A5';
 return '08-Identite-et-guides';
}
const only=process.argv[2];
for(const item of manifest){
 if(only&&!folder(item).startsWith(only))continue;
 const dest=path.join(output,folder(item));fs.mkdirSync(dest,{recursive:true});
 execFileSync(cli,['export',path.join(dir,'design-noveris.figcraft'),'--page',item.page,'--node',item.name,'--out',path.join(dest,item.name+'@3x.png'),'--scale','3'],{stdio:'pipe'});
 console.log(item.name);
}
if(!only)fs.writeFileSync(path.join(output,'inventaire.json'),JSON.stringify(manifest.map(item=>({...item,export:path.posix.join(folder(item),item.name+'@3x.png'),scale:3})),null,2));
console.log(`${manifest.length} exports PNG à 3× : ${output}`);
