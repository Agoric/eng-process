import csv
from datetime import date, datetime
import os
import sys

#
# Generate an SVG file which shows the Epic and blocker relationships between issues, as well as
# clustering the issues by Engineering team.  For each issue, show title of issue, the assignee, and the number
# of estimated story points.
#

NO_TEAM = ""

def get_issue_fqn(issue):
    return issue['repo'] + '/' + issue['issue']

issues_to_node_ids = dict()

def issue_fqn_to_node_id(issue_fqn, alloc=True):
    if issue_fqn not in issues_to_node_ids:
        if alloc:
            issues_to_node_ids[issue_fqn] = len(issues_to_node_ids.keys())
        else:
            return None
    return issues_to_node_ids[issue_fqn]

def write_issue_node(issue, output, indent=4):
    issue_fqn = get_issue_fqn(issue)
    node_id = issue_fqn_to_node_id(issue_fqn)
    shape = None
    estimate = -1 if issue['estimate'] == '' else int(issue['estimate'])
    issue_age = date.today() - datetime.strptime(issue['created_at'].split(' ')[0], '%Y-%m-%d').date()
    peripheries = 1
    if estimate >= 13:
        peripheries = 4
    elif estimate >= 8:
        peripheries = 3
    elif estimate >= 3:
        peripheries = 2
    if estimate == -1:
        estimate = '?'
    assignee = issue["assignee"] if issue["assignee"] else '?'
    title = issue["title"].replace('"', '').replace('{', '')
    output.write(f'{" " * indent}n_{node_id} [label="{title:.30s}\\n{assignee} '
                 f'{estimate} {issue_fqn[issue_fqn.index("/") + 1:]}"')
    if 'epic' in issue['labels']:
        output.write(f'; shape="octagon"; style="filled"; fillcolor="goldenrod1"')
    elif estimate == '?' or assignee == '?':
        output.write(f'; color="darkmagenta"; penwidth="3"')
    if peripheries:
        output.write(f'; peripheries="{peripheries}"')
    if shape:
        output.write(f'; shape="{shape}"')
    fill_color = None
    if 'New Issues' in issue['pipeline']:
        fill_color = 'chartreuse'
    elif issue['pipeline'] == 'In Progress':
        fill_color = 'skyblue'
    elif issue_age.days < 14:
        fill_color = 'aquamarine'
    elif issue_age.days > 365:
        fill_color = 'gray93'
    else:
        fill_color = 'white'
    if fill_color and 'epic' not in issue['labels']:
        output.write(f'; style="filled"; fillcolor="{fill_color}"')
    output.write(f'; URL="{issue["url"]}"; tooltip="{title}"];\n')

def main():
    with open(sys.argv[1], newline='') as issues_file, open(sys.argv[2], newline='') as rels_file, \
            open(sys.argv[3], 'w') as output:

        issues_by_team = dict()
        issues_by_fqn = dict()

        issues_reader = csv.DictReader(issues_file)
        for issue in issues_reader:
            if issue['closed_at']:
                continue
            if '/pull/' in issue['url']:
                continue
            issue['fqn'] = get_issue_fqn(issue)
            # If an issue is has labeled with multiple teams, just take the first ...
            team = issue['teams'].split(';')[0] or 'no-team'
            if team not in issues_by_team:
                issues_by_team[team] = []
            issues_by_team[team].append(issue)
            issues_by_fqn[issue['fqn']] = issue

        # Pre-process the sub issue to epic relationship, we need this to generate proper Epic clusters.
        subs_to_epic = dict()
        blockers = dict()
        rels_reader = csv.DictReader(rels_file)
        for rel in rels_reader:
            if rel['rel'] == 'blocks':
                blockers[rel['from'] + "<-" + rel['to']] = rel
            else:
                print(f'subs_to_epic {rel["to"]} -> {rel["from"]}')
                subs_to_epic[rel['to']] = rel['from']

        cluster_num = 0
        output.write(f'digraph "{sys.argv[3]}" {{\n')
        output.write('  node[shape = "rect"];')

        for team in sorted(issues_by_team.keys()):
            output.write(f'  subgraph cluster_{cluster_num} {{\n')
            output.write(f'    label="{team}";\n')
            output.write(f'    fontsize="30";\n')

            cluster_num += 1

            issues_by_epic = dict()
            non_epic_issues = []
            # First pass, seed the issue_by_epic dict from the Epics (the rels file includes
            # Epic relationships for closed Epics, so can't seed this correctly) from rels.
            for issue in issues_by_team[team]:
                if 'epic' in issue['labels']:
                    print(f'{team} Epic {issue["fqn"]}')
                    issues_by_epic[issue['fqn']] = [issue]

            # Second pass, if we find a sub issue of an Epic that is in this team cluster,
            # then add it.
            for issue in issues_by_team[team]:
                if issue['fqn'] in subs_to_epic:
                    print(f'{team} found sub {issue["fqn"]}')

                if issue['fqn'] in subs_to_epic and subs_to_epic[issue['fqn']] in issues_by_epic:
                    issues_by_epic[subs_to_epic[issue['fqn']]].append(issue)
                else:
                    non_epic_issues.append(issue)

            # Write out the Epics and their sub issues.
            for epic_fqn in issues_by_epic.keys():
                output.write(f'    subgraph cluster_{cluster_num} {{\n')
                output.write(f'      style="filled";\n')
                output.write(f'      fillcolor="cornsilk";\n')
                output.write(f'      label="";\n')
                cluster_num += 1
                for sub_issue in issues_by_epic[epic_fqn]:
                    write_issue_node(sub_issue, output, 6)

                output.write(f'    }}\n')

            for issue in non_epic_issues:
                write_issue_node(issue, output)

            output.write(f'  }}\n')

        for (from_fqn, to_fqn) in subs_to_epic.items():
            from_issue = issues_by_fqn.get(from_fqn, None)
            to_issue = issues_by_fqn.get(to_fqn, None)
            if from_issue and to_issue:
                from_node = issue_fqn_to_node_id(from_issue['fqn'], False)
                to_node = issue_fqn_to_node_id(to_issue['fqn'], False)
          #      if from_node and to_node:
                if from_issue['teams'] != to_issue['teams']:
                    output.write(f'  n_{to_node} -> n_{from_node};\n')

        for blocker in blockers.values():
            from_node = issue_fqn_to_node_id(blocker['from'], False)
            to_node = issue_fqn_to_node_id(blocker['to'], False)
            if from_node and to_node:
                output.write(f'  n_{to_node} -> n_{from_node} [color="red"; constraint="false"];\n')

        output.write('}\n')
    # 'fpd' is part of the graphviz package.  On a Mac: "brew install graphviz".
    os.system(f'fdp -Tsvg -O {sys.argv[3]}')

if __name__ == '__main__':
    main()
