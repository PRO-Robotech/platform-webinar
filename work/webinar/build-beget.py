from pathlib import Path
import base64
import re

root = Path(__file__).resolve().parent
source = root / 'beget'
brand = root / 'brand'
fonts = (brand / 'beget-official-fonts.css').read_text()

def embed_font(match):
    data = base64.b64encode((brand / match.group(1)).read_bytes()).decode()
    return 'url(data:font/woff2;base64,' + data + ')'

fonts = re.sub(r'url\(\./([^\)]+)\)', embed_font, fonts)
html = (source / 'shell.html').read_text()
for token, name in [
    ('__STYLE__', 'style.css'), ('__SPACE__', 'space.js'), ('__CONTENT__', 'content.js'),
    ('__GRAPHS_A__', 'graphs-a.js'), ('__GRAPHS_B__', 'graphs-b.js'),
    ('__DIAGRAM__', 'diagram.js'), ('__APP__', 'app.js')
]:
    content = (source / name).read_text()
    html = html.replace(token, fonts + content if name == 'style.css' else content)

target = root.parent.parent / 'outputs' / 'platform-beget.html'
target.write_text(html)
print(f'{target}: {len(html.encode())} bytes')
