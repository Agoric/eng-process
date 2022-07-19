import csv
import sys
import time
import urllib.parse
import yaml
from github import Github
from typing import Set
from zenhub import Zenhub

# Get the data from ZenHub and GitHub to generate the reports we need for
# our project planning, that we can't get natively from either platform.
class GetData:
    def __init__(self):
        self.labels_to_teams = dict()
        self.relationships = dict()
        self.repo_full_names_to_ids = dict()
        self.repo_ids_to_full_names = dict()
        self.issues_seen = set()
        self.epic_sub_issues = []
        self.gh_repos = dict()
        self.gh = Github(sys.argv[2], per_page=100)
        self.zh = Zenhub(sys.argv[3])
        self.config = None
        self.issue_writer = None
        self.rel_writer = None

    def load_labels_to_teams(self):
        for team, labels_str in self.config['team_labels'].items():
            labels = urllib.parse.unquote(labels_str.lower()).split(',')
            for label in labels:
                ls = self.labels_to_teams.get(label, None)
                if ls:
                    ls.append(team)
                else:
                    self.labels_to_teams[label] = [team]

    def get_zh_release_id(self, release_name):
        # See https://github.com/ZenHubIO/API#get-release-reports-for-a-repository
        for release in self.zh.get_release_reports(self.repo_full_names_to_ids[self.config['github_primary_repo']]):
            if release['title'] == release_name:
                return release['release_id']
        return None

    def form_fqn(self, repo_id, issue_id):
        return self.repo_ids_to_full_names[repo_id] + '/' + str(issue_id) \
            if repo_id in self.repo_ids_to_full_names else None

    def get_zh_blockages(self, repo_id):
        # See https://github.com/ZenHubIO/API#get-dependencies-for-a-repository
        result = self.zh.get_dependencies(repo_id)
        for dep in result['dependencies']:
            self.rel_writer.writerow([self.form_fqn(dep['blocking']['repo_id'], dep['blocking']['issue_number']),
                                      'blocks',
                                      self.form_fqn(dep['blocked']['repo_id'], dep['blocked']['issue_number'])])

    def get_gh_repos_for_orgs(self):
        for org in self.config['github_orgs']:
            # See: https://pygithub.readthedocs.io/en/latest/github.html#github.MainClass.Github.search_repositories
            for repo in self.gh.search_repositories(query=f'org:{org}'):
                self.repo_ids_to_full_names[repo.id] = repo.full_name
                self.repo_full_names_to_ids[repo.full_name] = repo.id
        # Can't get the forked repos via the GH /search/repositories REST API.
        # Can get them from the /orgs/${ORG}/repos REST API, but that is not supported by the python module.
        for repo_id, full_name in self.config['github_forked_repos'].items():
            self.repo_ids_to_full_names[repo_id] = full_name
            self.repo_full_names_to_ids[full_name] = repo_id

    def get_gh_repo(self, repo_fqn):
        repo = self.gh_repos.get(repo_fqn, None)
        if not repo:
            # See: https://pygithub.readthedocs.io/en/latest/github.html#github.MainClass.Github.get_repo
            repo = self.gh_repos[repo_fqn] = self.gh.get_repo(repo_fqn)
        return repo

    def get_epic_data(self, repo_id, issue_mumber):
        # See: https://github.com/ZenHubIO/API#get-epic-data
        epic_data = self.zh.get_epic_data(repo_id, issue_mumber)
        for issue in epic_data['issues']:
            self.epic_sub_issues.append([self.form_fqn(repo_id, issue_mumber), 'epic',
                                        self.form_fqn(issue['repo_id'], issue['issue_number'])])
        return epic_data['total_epic_estimates']['value']

    def get_owning_teams_for_issue(self, assignee, issue_labels):
        owning_teams: Set[str] = set()
        for issue_label in issue_labels:
            team = self.labels_to_teams.get(issue_label, None)
            if team:
                owning_teams.update(team)
        if len(owning_teams) > 1 and assignee:
            assignee_team = self.config['person_to_team'].get(assignee, None)
            if assignee_team and assignee_team in owning_teams:
                return {assignee_team}
        return owning_teams

    def process_issue(self, repo_id, issue_number):
        fqn = self.form_fqn(repo_id, issue_number)
        if fqn:
            self.issues_seen.add(self.form_fqn(repo_id, issue_number))
        else:
            print(f'Repo not loaded: {repo_id}, add new github_orgs or github_forked_repos entry in config file.')
            return
        if repo_id not in self.gh_repos:
            self.get_zh_blockages(repo_id)
        repo_fqn = self.repo_ids_to_full_names[repo_id]
        gh_repo = self.get_gh_repo(repo_fqn)
        # See https://pygithub.readthedocs.io/en/latest/github_objects/Repository.html#github.Repository.Repository.get_issue
        gh_issue = gh_repo.get_issue(int(issue_number))
        issue_labels = [issue_label.name.lower() for issue_label in gh_issue.labels]
        assignee = gh_issue.assignee.login if gh_issue.assignee else '',
        assignee = assignee[0]
        owning_teams = self.get_owning_teams_for_issue(assignee, issue_labels)

        # Story points are a ZH concept, not native to GH, so we have to get the issue from ZH, too.
        # See https://github.com/ZenHubIO/API#get-issue-data
        zh_issue = self.zh.get_issue_data(repo_id, issue_number)
        issue_estimate = zh_issue['estimate']['value'] if 'estimate' in zh_issue else '',
        issue_estimate = issue_estimate[0]
        if zh_issue['is_epic']:
            issue_estimate = self.get_epic_data(repo_id, issue_number)

        self.issue_writer.writerow([repo_fqn, issue_number,
                                    assignee,
                                    issue_estimate,
                                    zh_issue['pipeline']['name'],
                                    ';'.join(issue_labels),
                                    ';'.join(owning_teams),
                                    gh_issue.created_at,
                                    gh_issue.closed_at,
                                    gh_issue.html_url,
                                    gh_issue.title])

    def run(self):
        with open(sys.argv[1], 'r') as config_file, \
                open(sys.argv[5], 'w', newline='') as issue_file, \
                open(sys.argv[6], 'w', newline='') as rel_file:
            self.config = yaml.load(config_file, Loader=yaml.FullLoader)
            self.get_gh_repos_for_orgs()
            release_id = self.get_zh_release_id(sys.argv[4])
            if not release_id:
                print(f'no such release: {sys.argv[4]}', file=sys.stderr)
                sys.exit(1)
            self.load_labels_to_teams()

            self.issue_writer = csv.writer(issue_file, quotechar='"')
            self.rel_writer = csv.writer(rel_file, quotechar='"')
            self.issue_writer.writerow('repo issue assignee estimate pipeline labels teams '
                                       'created_at closed_at url title'.split(' '))

            self.rel_writer.writerow('from rel to'.split(' '))
            # See: https://github.com/ZenHubIO/API#get-all-the-issues-for-a-release-report
            for count, report_issue in enumerate(self.zh.get_release_report_issues(release_id)):
                self.process_issue(report_issue['repo_id'], report_issue['issue_number'])
                time.sleep(1)  # The ZH Rest API is rate limited to 100 requests / minute
                if count and count % 10 == 0:
                    print(count)

            # Only write Epic sub-issues for issues that are in this release.
            for sub_issue in self.epic_sub_issues:
                if sub_issue[2] in self.issues_seen:
                    self.rel_writer.writerow(sub_issue)
                else:
                    print(f'ignoring epic sub issue {sub_issue[2]} as it is not in target release')

if __name__ == '__main__':
    if len(sys.argv) != 7:
        print(f'usage: {sys.argv[0]} config.yml ghkey zhkey release issues.csv rels.csv', file=sys.stderr)
        sys.exit(1)
    GetData().run()
