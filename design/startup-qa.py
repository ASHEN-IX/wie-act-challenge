"""Verify and assemble the professional launch feed without modifying other artwork."""
from pathlib import Path
from PIL import Image, ImageDraw
import json,subprocess,os,re
p=Path(__file__).resolve().parent
out=p/'exports/noveris-startup'
cli=os.environ.get('FIGCRAFT_CLI',r'C:\Program Files\ArtCraft\FigCraft\figcraft-cli.exe')
subprocess.run([cli,'convert',str(p/'design-noveris-live.figcraft'),str(p/'startup.after.local.json')],capture_output=True,check=True)
d=json.loads((p/'startup.after.local.json').read_text(encoding='utf-8'))
m=json.loads((p/'startup.manifest.json').read_text(encoding='utf-8'))
issues=[]
for f in m:
 n=next(n for n in d['nodes'].values() if n['name']==f['name'])
 assert n['width']==1080 and n['height']==1350
 im=Image.open(out/(f['name']+'.png'));assert im.size==(1080,1350)
 def walk(n):
  for i in n.get('children',[]):
   child=d['nodes'][str(i)]
   if child['type']=='text':
    x,y=child.get('transform',[1,0,0,1,0,0])[4:6]
    if x<0 or y<0 or x+child['width']>n['width']+2 or y+child['height']>n['height']+2:issues.append(child['name'])
    assert not re.search(r'\b(ednova|ieee|challenge|finalist|deadline|xp)\b',child.get('characters',''),re.I),child.get('characters')
   walk(child)
 walk(n)
assert not issues,issues
sheet=Image.new('RGB',(1200,1230),'#15183B');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(m):
 im=Image.open(out/(f['name']+'.png')).convert('RGB');im.thumbnail((282,370))
 x=(i%4)*300+(300-im.width)//2;y=(i//4)*410+8
 sheet.paste(im,(x,y));draw.text(((i%4)*300+12,(i//4+1)*410-25),f['name'],fill='white')
sheet.save(out/'NOVERIS-Launch-Feed-Preview.png')
(out/'Feed-QA-report.json').write_text(json.dumps({'posts':12,'size':[1080,1350],'text_overflow':issues,'challenge_promotion_in_feed':False,'status':'Structural checks passed; visual review pending'},indent=2),encoding='utf-8')
print('12 posts passed size, editable-text bounds and challenge-language checks.')
