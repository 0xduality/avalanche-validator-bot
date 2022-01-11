import json
import requests

data = '{"method": "platform.getCurrentValidators", "params": {}, "jsonrpc": "2.0", "id": 1}'
headers = {'content-type': 'application/json'}
r = requests.post('http://127.0.0.1:9650/ext/P', data=data, headers=headers)
jsn = r.json()
h={o['nodeID']: o['rewardOwner']['addresses'][0] for o in jsn['result']['validators']}
with open('snapshot.json','w') as out:
    json.dump(h, out, indent=True)

