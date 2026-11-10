"""Verify every Noveris page, assemble contact sheets and inspect print proofs."""
from pathlib import Path
from PIL import Image,ImageDraw
from pypdf import PdfReader,PdfWriter
import os,json,re,subprocess
root=Path(__file__).resolve().parent
out=root/'exports/noveris-startup'
cli=os.environ.get('FIGCRAFT_CLI',r'C:\Program Files\ArtCraft\FigCraft\figcraft-cli.exe')
assert (root/'design.figcraft').read_bytes() == (root/'design-noveris-live.figcraft').read_bytes(), 'The compatibility file differs from the live design'
subprocess.run([cli,'convert',str(root/'design-noveris-live.figcraft'),str(root/'campaign.document.local.json')],check=True,capture_output=True)
subprocess.run([cli,'convert',str(root/'design.pre-campaign.figcraft'),str(root/'foundations.local.json')],check=True,capture_output=True)
d=json.loads((root/'campaign.document.local.json').read_text(encoding='utf-8'))
base=json.loads((root/'foundations.local.json').read_text(encoding='utf-8'))
m=json.loads((root/'campaign.manifest.json').read_text(encoding='utf-8'))
info=json.loads(subprocess.run([cli,'info',str(root/'design-noveris-live.figcraft'),'--json'],check=True,capture_output=True,text=True).stdout)
assert len(d['pages'])==22 and len(m)==56
assert not info['missingFonts'] and not info['notes']
assert d['styles']==base['styles']
for i in range(321,329):assert d['nodes'][str(i)]==base['nodes'][str(i)],'Approved logo geometry changed'
banned=re.compile(r'\b(ednova|ieee|challenge|mission|quest|finalist|jury|winner|countdown|deadline|xp)\b|game master|level up',re.I)
bad=[];overflow=[]
for n in d['nodes'].values():
 if banned.search((n.get('characters') or '')+' '+n.get('name','')):bad.append(n['name'])
 if n['type']=='text':
  p=d['nodes'][str(n['parent'])];x,y=n.get('transform',[1,0,0,1,0,0])[4:6]
  if p['type']!='page' and (x<-.5 or y<-.5 or x+n['width']>p['width']+2 or y+n['height']>p['height']+2):overflow.append({'id':n['id'],'name':n['name'],'text':n['characters']})
assert not bad,bad
assert not overflow,overflow
for f in m:
 n=next(n for n in d['nodes'].values() if n['type']=='frame' and n['name']==f['name'])
 assert abs(n['width']-f['width'])<.01 and abs(n['height']-f['height'])<.01
 im=Image.open(out/(f['name']+'.png'))
 if f['kind']=='social':assert im.size==(int(f['width']),int(f['height']))
 if f['kind']=='sticker':assert im.mode=='RGBA' and im.getpixel((0,0))[3]==0

def sheet(items,name,cols=4,tw=300,th=450):
 canvas=Image.new('RGB',(cols*tw,((len(items)+cols-1)//cols)*th),'#15183B');draw=ImageDraw.Draw(canvas)
 for i,f in enumerate(items):
  im=Image.open(out/(f['name']+'.png')).convert('RGBA');im.thumbnail((tw-18,th-38))
  x=(i%cols)*tw+(tw-im.width)//2;y=(i//cols)*th+8
  canvas.paste(im,(x,y),im);draw.text(((i%cols)*tw+10,(i//cols+1)*th-23),f['name'],fill='white')
 canvas.save(out/name)
sheet([f for f in m if f['kind']=='foundation'][:6],'REVIEW-01-Foundations.png',3,440,690)
sheet([f for f in m if f['kind']=='foundation'][6:],'REVIEW-02-Templates.png',4,330,560)
sheet([f for f in m if f['name'].startswith('NOVERIS-POST')],'NOVERIS-Launch-Feed-Preview.png',4,300,410)
sheet([f for f in m if f['name'].startswith('NOVERIS-STORY')],'REVIEW-04-Stories.png',4,280,525)
sheet([f for f in m if f['kind']=='print'],'REVIEW-05-Print.png',4,320,470)
sheet([f for f in m if f['kind']=='sticker'],'REVIEW-06-Stickers.png',4,280,310)
sheet([f for f in m if f['kind']=='reference'],'REVIEW-07-System.png',2,600,730)

writer=PdfWriter();checks=[]
for name,size in [('NOVERIS-Team-IDs-Proof.pdf',(90,120)),('NOVERIS-A3-Posters-Proof.pdf',(297,420)),('NOVERIS-A5-Flyer-Proof.pdf',(148,210))]:
 for page in PdfReader(out/name).pages:
  trim=page.trimbox;bleed=page.bleedbox
  actual=(float(trim.width)*25.4/72,float(trim.height)*25.4/72)
  assert all(abs(a-b)<.02 for a,b in zip(actual,size)),actual
  assert abs((float(bleed.width)-float(trim.width))*25.4/72-6)<.02
  fonts=[]
  for fr in page['/Resources'].get('/Font',{}).values():
   font=fr.get_object();desc=font.get('/DescendantFonts');descriptor=(desc[0].get_object() if desc else font).get('/FontDescriptor')
   embedded=bool(descriptor and any(k in descriptor.get_object() for k in ['/FontFile','/FontFile2','/FontFile3']))
   fonts.append({'font':str(font.get('/BaseFont')),'embedded':embedded})
  assert fonts and all(f['embedded'] for f in fonts),fonts
  checks.append({'source':name,'trim_mm':actual,'bleed_mm':3,'fonts':fonts});writer.add_page(page)
with (out/'NOVERIS-Print-Proofs.pdf').open('wb') as stream:writer.write(stream)
report={'pages_reviewed':22,'export_frames':56,'marketing_frames':43,'approved_logo_geometry_preserved':True,'shared_typography_styles_preserved':True,'challenge_references':bad,'text_overflow':overflow,'missing_fonts':info['missingFonts'],'print_pages':len(checks),'print_checks':checks,'status':'Structural checks passed. Visual review of all pages required. Draft print proofs require vendor confirmation.'}
(out/'QA-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='print_checks'},indent=2))
