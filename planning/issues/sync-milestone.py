import csv
from github import Github
import sys

'''
We use ZenHub Releases to do our project planning. These Releases are a ZenHub only 
implementation - GitHub has no direct linked concept, although GitHub does support
the concept of Milestones. (Note that ZenHub used to integrate with GitHub Milestones,
but they removed that linkage and the concept of Milestones from ZenHub.)

To provide community visibility into the issues that are in our our major releases,
we should sync our ZenHub Releases to GitHub milestones.  This script does that 
sync for us.
'''
class Sync:
    class RepoData:
        def __init__(self, gh_repo):
            self.gh_repo = gh_repo
            self.target_milestone = None

    def __init__(self, ghkey, target_milestone):
        self.gh = Github(ghkey)
        self.gh_repo_and_milestones = dict()
        self.target_milestone = target_milestone
        self.release_issues = dict()

    def get_gh_repo_and_milestones(self, repo_fqn):
        repo_data = self.gh_repo_and_milestones.get(repo_fqn, None)
        if not repo_data:
            # See: https://pygithub.readthedocs.io/en/latest/github.html#github.MainClass.Github.get_repo
            # and https://docs.github.com/en/rest/reference/repos#get-a-repository
            repo_data = Sync.RepoData(self.gh.get_repo(repo_fqn))
            # See https://pygithub.readthedocs.io/en/latest/github_objects/Repository.html#github.Repository.Repository.get_milestones
            # and https://docs.github.com/en/rest/issues/milestones
            milestones = repo_data.gh_repo.get_milestones()
            for m in milestones:
                if m.title == self.target_milestone:
                    repo_data.target_milestone = m
            if not repo_data.target_milestone:
                print(f'Repo {repo_fqn} does not have label {self.target_milestone}')

            self.gh_repo_and_milestones[repo_fqn] = repo_data

        return repo_data

    def process_issue(self, issue):
        if '/pull/' in issue['url']:
            return

        repo_data = self.get_gh_repo_and_milestones(issue['repo'])
        # If the target milestone is not in the repo, then skip it.  If we want it, we'll manually add
        # the label to the repo, but that will not always be the case.
        if not repo_data.target_milestone:
            return

        # See https://pygithub.readthedocs.io/en/latest/github_objects/Repository.html#github.Repository.Repository.get_issue
        gh_issue = repo_data.gh_repo.get_issue(int(issue["issue"]))
        if gh_issue.milestone and gh_issue.milestone.id == repo_data.target_milestone.id:
            return

        print(f'ADD milestone to issue {issue["issue"]} {gh_issue.html_url}')
        # See https://pygithub.readthedocs.io/en/latest/github_objects/Issue.html#github.Issue.Issue.edit
        gh_issue.edit(milestone=repo_data.target_milestone)

    def add_to_in_scope(self):
        for issue in self.release_issues.values():
            self.process_issue(issue)

    @staticmethod
    def form_fqn(repo_fqn, issue_id):
        return repo_fqn + '/' + str(issue_id)

    def remove_from_out_of_scope(self):
        for repo_data in self.gh_repo_and_milestones.values():
            repo_data = self.get_gh_repo_and_milestones(repo_data.gh_repo.full_name)
            if not repo_data.target_milestone:
                continue
            # See https://pygithub.readthedocs.io/en/latest/github_objects/Repository.html#github.Repository.Repository.get_issues
            for gh_issue in repo_data.gh_repo.get_issues(milestone=repo_data.target_milestone):
                issue_fqn = Sync.form_fqn(repo_data.gh_repo.full_name, gh_issue.number)
                if issue_fqn not in self.release_issues:
                    print(f'REMOVE milestone from issue {gh_issue.html_url}')
                    # See https://pygithub.readthedocs.io/en/latest/github_objects/Issue.html#github.Issue.Issue.edit
                    gh_issue.edit(milestone=None)

    def read_release_issues(self, issues_path):
        with open(issues_path, newline='') as data_file:
            reader = csv.DictReader(data_file)
            for issue in reader:
                self.release_issues[Sync.form_fqn(issue['repo'], issue['issue'])] = issue

    def run(self, issues_path):
        self.read_release_issues(issues_path)
        self.add_to_in_scope()
        self.remove_from_out_of_scope()

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(f'usage: {sys.argv[0]} ghkey issues.csv milestone', file=sys.stderr)
        sys.exit(1)
    Sync(sys.argv[1], sys.argv[3]).run(sys.argv[2])
