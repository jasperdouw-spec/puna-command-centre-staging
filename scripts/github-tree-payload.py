"""Export a bounded UTF-8 source-only tree delta for the connected GitHub tool."""
import json,subprocess,sys
base='0430dd786abf55c605b75e1c8d37bc0906fe3ed9'
paths=subprocess.check_output(['git','diff','--name-only',base,'HEAD'],text=True).splitlines()
result=[]
for path in paths[int(sys.argv[1]):int(sys.argv[1])+8]:
 raw=subprocess.check_output(['git','show','HEAD:'+path])
 result.append({'path':path,'mode':'100644','type':'blob','content':raw.decode('utf-8')})
print(json.dumps(result,ensure_ascii=True))
