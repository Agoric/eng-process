import json
import os
import requests
import sys

username = sys.argv[2]
token = sys.argv[3]
filename = os.path.basename(sys.argv[1])

content=open(sys.argv[1], 'r').read()
r = requests.post('https://api.github.com/gists',
                  json.dumps({
                      'files': {filename: {"content": content}},
                      'public:': 'true'}),
                  auth=(username, token))

print(r.json()['html_url'])
