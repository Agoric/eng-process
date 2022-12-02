import json
import requests
import sys

'''
A program to get this basic information about all OPEN issues in a particular GitHub Organization, across
all of its repositories:
    * Global id
    * Repository name
    * Issue number
    * GitHub V2 Projects it belongs to
    * Labels names
This script uses the GitHub GraphQL API documented here: https://docs.github.com/en/graphql
'''
class IssueRetriever:
    def __init__(self, github_pat, org):
        self.github_pat = github_pat
        self.org = org
        self.headers = {"Authorization": f'bearer {self.github_pat}'}

    def run_query(self, query):
        request = requests.post('https://api.github.com/graphql', json={'query': query}, headers=self.headers)
        if request.status_code == 200:
            return request.json()
        else:
            raise Exception("Query failed to run by returning code of {}. {}".format(request.status_code, query))

    def get_org_repos(self):
        query = f'''
        {{
          organization(login: "{self.org}") {{
            repositories(first: 50, isFork: false) {{
              nodes {{
                name
                id
                isArchived
              }}
            }}
          }}
        }}
        '''
        return self.run_query(query)['data']['organization']['repositories']['nodes']

    def get_repo_issues(self, repo, issues):
        after = ''
        has_next_page = True
        while has_next_page:
            query = f'''
            {{
              viewer {{
                organization(login: "{self.org}") {{
                  id
                  repository(name: "{repo['name']}") {{
                    issues(first: 50, states: OPEN{after}) {{
                      pageInfo {{
                        hasNextPage
                        endCursor
                      }}
                      edges {{
                        node {{
                          id
                          number
                          projectsV2(first: 20) {{
                            nodes {{
                              id
                              title
                            }}
                          }}
                          labels(first: 20) {{
                            nodes {{
                              name
                            }}
                          }}
                          repository {{
                              name
                          }}
                        }}
                      }}
                    }}
                  }}
                }}
              }}
            }}
            '''

            results = self.run_query(query)
            edges = [edge['node'] for edge
                     in results['data']['viewer']['organization']['repository']['issues']['edges']]
            if len(edges):
                issues += edges
                print(f'  got {len(edges)} issues from {repo["name"]}, last = {edges[len(edges) - 1]["number"]}',
                      file=sys.stderr)
            page_info = results['data']['viewer']['organization']['repository']['issues']['pageInfo']
            has_next_page = page_info['hasNextPage']
            if has_next_page:
                after = f', after: "{page_info["endCursor"]}"'
        return issues

    def run(self):
        repos = self.get_org_repos()
        issues = []
        for repo in repos:
            issues = self.get_repo_issues(repo, issues)
            print(f'repo {repo["name"]} has {len(issues)} issues', file=sys.stderr)
        print(json.dumps(issues, indent=2))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f'usage: {sys.argv[0]} GHPAT org', file=sys.stderr)
        sys.exit(1)
    IssueRetriever(sys.argv[1], sys.argv[2]).run()