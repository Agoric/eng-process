import csv
import sys
from datetime import date, datetime

# Generate a plain text report from the ZenHub and GitHub issue data downloaded and massaged
# by the get_issue_data.py script.  This report contains the following information:
#   * Open issues count
#   * Open story points
#   * Story points by assignee
#   * Number of issues without story points, by assignee
#   * List of all issues assigned to each engineer, ordered by story points
#   * Issues with no assignees
#   * Issues with no story points
#   * Issues with no team (inferred from issue labels)
#   * Velocity by assignee based on closed issues since beginning of release cycle.
#   * Calculation of how many actual days of work each engineer has in order to complete the release work.
# Also, generate a CSV of all issues, by assignee.
class GenReport:
    def __init__(self):
        self.default_issue_story_points = None
        self.estimates_by_team = {}
        self.unestimated_by_team = {}
        self.estimates_by_assignee = {}
        self.unestimated_by_assignee = {}
        self.unassigned_by_team = {}
        self.issues_with_no_assignee = []
        self.issues_with_no_estimate = []
        self.issues_with_no_team = []
        self.issues_with_no_team_or_assignee = []
        self.closed_issues_by_assignee = {}
        self.issues_by_assignee = dict()
        self.open_issues_count = 0
        self.open_story_points = 0

    @staticmethod
    def dict_issues_add(d: dict, key, issue):
        if key in d:
            d[key].append(issue)
        else:
            d[key] = [issue]

    @staticmethod
    def dict_numeric_add(d: dict, key, number):
        if key in d:
            d[key] += int(number)
        else:
            d[key] = int(number)

    @staticmethod
    def display_dict(title: str, d: dict):
        print('\n' + title)
        for key, value in sorted(d.items(), key=lambda item: item[1], reverse=True):
            print(f'{value:3d} {key}')

    def display_issues(self, title: str, raw_issues: [], cols: [str], order_by=None):
        issues = raw_issues
        if order_by:
            issues = sorted(raw_issues, key=lambda i: i[order_by] if i[order_by] else 'unassigned')
        print(f'\n{title}: {len(issues)} {float(100 * len(issues) / self.open_issues_count):.2f}%')
        for issue in issues:
            print('   ', end='')
            for col in cols:
                value = issue[col]
                if (col == 'assignee') and value == '':
                    value = 'unassigned'
                if (col == 'teams') and value == '':
                    value = 'noteam'
                print(f' {value}', end='')
            print()

    def display_issues_by_assignee(self, title: str):
        print('\n' + title)
        for key, value in sorted(self.estimates_by_assignee.items(), key=lambda item: item[1], reverse=True):
            print(f'{value:3d} {key}')
            for issue in sorted(self.issues_by_assignee[key],
                                key=lambda i: int(i['estimate']) if i['estimate'] != '' else 0, reverse=True):
                print(f"    {issue['estimate']} {issue['teams']} {issue['url']} {issue['title']}", end='')
                if issue['pipeline'] in ('In Progress', 'Up Next'):
                    print(f" [{issue['pipeline']}]")
                else:
                    print('')

    def write_issues_by_assignee_csv(self):
        with open('assignee_report.csv', 'w') as report:
            report_writer = csv.writer(report, quotechar='"')
            report_writer.writerow('assignee estimate team url description')
            for key, value in sorted(self.estimates_by_assignee.items(), key=lambda item: item[1], reverse=True):
                for issue in sorted(self.issues_by_assignee[key],
                                    key=lambda i: int(i['estimate']) if i['estimate'] != '' else 0, reverse=True):
                    report_writer.writerow([key, issue['estimate'], issue['teams'], issue['url'], issue['title']])

    def display_velocity_report(self):
        start_date = datetime.strptime(sys.argv[2], '%Y-%m-%d').date()
        working_days = (date.today() - start_date) * 5.0/7.0
        print('\nVelocity by assignee')
        print(f"  Working days completed in this release: {working_days.days}")
        for assignee, issues in sorted(self.closed_issues_by_assignee.items(), key=lambda item: item[0]):
            points_completed = sum([int(issue['estimate'] or 0) for issue in issues])
            points_per_day = points_completed / working_days.days
            days_of_work = (self.estimates_by_assignee.get(assignee, 0) / points_per_day) if points_completed else 0
            print(f"  {(assignee or 'unassigned') + ':':14s} {points_completed:2d} pts done -> "
                  f"{points_per_day:.2f} / day; "
                  f"{self.estimates_by_assignee.get(assignee, 0):3d} pts for MN-1 -> {int(days_of_work):3d} days "
                  f" -> {days_of_work / 21.6:.1f} months")
            for issue in sorted(issues, key=lambda i: i['closed_at'], reverse=True):
                print(f"    {issue['closed_at'].split(' ')[0]} {issue['estimate'] or ' '} {issue['url']} "
                      f"{issue['title']}")

    def process_issue(self, issue):
        if '/pull/' in issue['url']:
            return
        if issue['closed_at']:
            GenReport.dict_issues_add(self.closed_issues_by_assignee, issue['assignee'], issue)
            return
        # Issues that are in the Review/QA pipeline are "almost done", so don't count that as remaining work.
        if issue['pipeline'] == 'Review/QA':
            print(f"skipping Review/QA issue {issue['url']} {issue['title']}")
            return
        # The estimates on epics the sum of their sub pieces, so ignore these.
        if 'epic' in issue['labels'].lower().split(';'):
            return

        self.open_issues_count += 1

        if issue['assignee'] != '':
            GenReport.dict_issues_add(self.issues_by_assignee, issue['assignee'], issue)
            if issue['estimate'] != '':
                GenReport.dict_numeric_add(self.estimates_by_assignee, issue['assignee'], issue['estimate'])
            else:
                GenReport.dict_numeric_add(self.unestimated_by_assignee, issue['assignee'], 1)
        else:
            self.issues_with_no_assignee.append(issue)

        if issue['assignee'] == '':
            if issue['teams'] != '':
                for team in issue['teams'].split(';'):
                    GenReport.dict_numeric_add(self.unassigned_by_team, team, 1)
            else:
                self.issues_with_no_team_or_assignee.append(issue)

        if issue['teams'] != '':
            for team in issue['teams'].split(';'):
                if issue['estimate'] != '':
                    GenReport.dict_numeric_add(self.estimates_by_team, team, issue['estimate'])
                else:
                    GenReport.dict_numeric_add(self.unestimated_by_team, team, 1)
        else:
            self.issues_with_no_team.append(issue)

        if issue['estimate'] == '':
            self.issues_with_no_estimate.append(issue)
            self.open_story_points += self.default_issue_story_points
        else:
            self.open_story_points += float(issue['estimate'])

    def gen_report(self):
        print(f'\nOpen issues count: {self.open_issues_count}')
        print(f'Open story points: {int(self.open_story_points)}')
        GenReport.display_dict("Story points by assignee", self.estimates_by_assignee)

        GenReport.display_dict("Issues with no estimate, by assignee", self.unestimated_by_assignee)

        self.display_issues_by_assignee('Story points per assignee')

        self.write_issues_by_assignee_csv()

        self.display_issues('Issues with no assignee', self.issues_with_no_assignee,
                            'teams pipeline url title'.split(' '), 'teams')
        self.display_issues('Issues with no estimate', self.issues_with_no_estimate,
                            'assignee teams pipeline url title'.split(' '), 'assignee')
        self.display_issues('Issues with no team', self.issues_with_no_team,
                            'assignee pipeline url title'.split(' '))
        self.display_velocity_report()

    def run(self):
        self.default_issue_story_points = float(sys.argv[3])
        with open(sys.argv[1], newline='') as data_file:
            reader = csv.DictReader(data_file)
            for issue in reader:
                self.process_issue(issue)

            self.gen_report()

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print(f'usage: {sys.argv[0]} issues.csv rel-start-date issue-default-pts', file=sys.stderr)
        sys.exit(1)
    GenReport().run()
