import csv
import os
import sys

NO_TEAM = ""

def get_issue_fqn(issue):
    return issue['repo'] + '/' + issue['issue']

issues_to_node_ids = dict()

def issue_fqn_to_node_id(issue_fqn):
    if issue_fqn not in issues_to_node_ids:
        issues_to_node_ids[issue_fqn] = len(issues_to_node_ids.keys())
    return issues_to_node_ids[issue_fqn]

def main():
    with open(sys.argv[1], newline='') as issues_file, open(sys.argv[2], newline='') as rels_file, \
            open(sys.argv[3], 'w') as output:

        issues_by_team = dict()

        issues_reader = csv.DictReader(issues_file)
        for issue in issues_reader:
            if issue['closed_at']:
                continue
            if '/pull/' in issue['url']:
                continue
            # If an issue is has labeled with multiple teams, just take the first ...
            team = issue['teams'].split(';')[0] or 'no-team'
            if team not in issues_by_team:
                issues_by_team[team] = []
            issues_by_team[team].append(issue)

        cluster_num = 0
        output.write(f'digraph "{sys.argv[3]}" {{\n')
        output.write('  node[shape = "rect"];')

        for team in sorted(issues_by_team.keys()):
            output.write(f'  subgraph cluster_{cluster_num} {{\n')
            output.write(f'    label="{team}";\n')
            for issue in issues_by_team[team]:
                issue_fqn = get_issue_fqn(issue)
                node_id = issue_fqn_to_node_id(issue_fqn)
                shape = None
                estimate = -1 if issue['estimate'] == '' else int(issue['estimate'])
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
                output.write(f'    n_{node_id} [label="{title:.30s}\\n{assignee} '
                             f'{estimate} {issue_fqn[issue_fqn.index("/") + 1:]}"')
                if 'epic' in issue['labels']:
                    output.write(f'; shape="octagon"; style="filled"; fillcolor="goldenrod1"')
                elif estimate == '?':
                    output.write(f'; color="darkmagenta"; penwidth="3"')
                if peripheries:
                    output.write(f'; peripheries="{peripheries}"')
                if shape:
                    output.write(f'; shape="{shape}"')
                output.write(f'; URL="{issue["url"]}"; tooltip="{title}"];\n')
            output.write(f'  }}\n')
            cluster_num += 1

        rels_reader = csv.DictReader(rels_file)
        rels_reported = set()
        for rel in rels_reader:
            if rel['from'] in issues_to_node_ids and rel['to'] in issues_to_node_ids:
                from_node = issue_fqn_to_node_id(rel['from'])
                to_node = issue_fqn_to_node_id(rel['to'])
                if rel['rel'] == 'blocks':
                    # Draw the arrow from the thing that is blocked to the think that is blocking it.
                    rel_out = f'  n_{to_node} -> n_{from_node} [color="red"; constraint="false"];\n'
                else:
                    rel_out = f'  n_{from_node} -> n_{to_node};\n'
                if rel_out not in rels_reported:
                    output.write(rel_out)
                    rels_reported.add(rel_out)

        output.write('}\n')
    os.system(f'fdp -Tsvg -O {sys.argv[3]}')

if __name__ == '__main__':
    main()
