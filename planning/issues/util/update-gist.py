import json
import os
import requests
import sys

filename = os.path.basename(sys.argv[1])
gist_id = os.path.basename(sys.argv[2])
username = sys.argv[3]
token = sys.argv[4]

content=open(sys.argv[1], 'r').read()
r = requests.patch(f'https://api.github.com/gists/{gist_id}',
                  json.dumps({
                      'files': {filename: {"content": content}},
                      'public:': 'true'}),
                  auth=(username, token))

print(r.json()['html_url'])
