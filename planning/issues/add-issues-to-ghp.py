import json
import requests
import sys

'''
This program takes a GH Organization and V2 Project, and a JSON file listing the issues we want 
to have in that Project.  It determines which of those issues are not already in the Project, and adds them.
This script uses the GitHub GraphQL API documented here: https://docs.github.com/en/graphql
'''
class MissingIssues:
    def __init__(self, github_pat, org_name, proj_name):
        self.github_pat = github_pat
        self.org_name = org_name
        self.proj_name = proj_name
        self.headers = {"Authorization": f'bearer {self.github_pat}'}

    def run_query(self, query):
        request = requests.post('https://api.github.com/graphql', json={'query': query}, headers=self.headers)
        if request.status_code == 200:
            return request.json()
        else:
            raise Exception("Query failed to run by returning code of {}. {}".format(request.status_code, query))

    def lookup_project(self):
        query = f'''
        query {{
          organization(login: "{self.org_name}") {{
            projectsV2(query: "title:{self.proj_name}", first: 10) {{
              nodes {{
                title
                id
              }}
            }}
          }}
        }}
        '''
        return self.run_query(query)['data']['organization']['projectsV2']['nodes'][0]

    def add_issue_to_project(self, project, issue):
        query = f'''
          mutation {{
            addProjectV2ItemById(input: {{projectId: "{project['id']}" contentId: "{issue['id']}"}}) {{
            item {{
              id
            }}
          }}
        }}
        '''
        return self.run_query(query)

    def run(self, issues_json_path):
        project = self.lookup_project()
        with open(issues_json_path) as f:
            issues = json.load(f)
            for issue in issues:
                in_project = False
                if issue['projectsV2']['nodes']:
                    for project in issue['projectsV2']['nodes']:
                        if project['title'] == self.proj_name:
                            in_project = True
                in_project = False # TODO: XXX
                if not in_project:
                    proj_id = self.add_issue_to_project(project, issue)['data']['addProjectV2ItemById']['item']['id']
                    print(f'{issue["id"]} {issue["repository"]["name"]}/{issue["number"]} -> {proj_id}')

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(f'usage: {sys.argv[0]} GHPAT org-name project-name issues.json', file=sys.stderr)
        sys.exit(1)
    MissingIssues(sys.argv[1], sys.argv[2], sys.argv[3]).run(sys.argv[4])
