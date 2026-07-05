import urllib.request
import re

try:
    html = urllib.request.urlopen("https://kncc-excel.vercel.app/").read().decode("utf-8")
    js_path = re.search(r'src="(/assets/index-.*?\.js)"', html).group(1)
    js = urllib.request.urlopen("https://kncc-excel.vercel.app" + js_path).read().decode("utf-8")
    print("kncc_demo_user" in js)
except Exception as e:
    print(e)
