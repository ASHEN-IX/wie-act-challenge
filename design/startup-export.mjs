import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
const cli=process.env.FIGCRAFT_CLI||'C:/Program Files/ArtCraft/FigCraft/figcraft-cli.exe';
const out=path.join(dir,'exports/noveris-startup');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'startup.manifest.json')));
for(const frame of manifest){execFileSync(cli,['export',path.join(dir,'design-noveris-live.figcraft'),'--page',frame.page,'--node',frame.name,'--out',path.join(out,frame.name+'.png')],{stdio:'pipe'});console.log(`Exported ${frame.name}`);}
