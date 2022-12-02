#!/bin/bash

GITHUB_USER=YOUR_GITHUB_USER_ID_HERE
GITHUB_AUTH=YOUR_GITHUB_ACCESS_TOKEN_HERE 
ZENHUB_AUTH=YOUR_ZENHUB_ACCESS_TOKEN_HERE 

# The first time you run this, or add a new release to track, after a clean run you need to create
# the gist in GitHub for the report and visualization, which will in future be updated by the script.  E.g.:
#    folly 508 % python3 post-gist.py data/vaults-issue-report.txt $GITHUB_USER $GITHUB_AUTH
#    https://gist.github.com/5926478709a85ee2671d9126d020ba13
#    folly 509 % python3 post-gist.py data/vaults-vis.dot.svg $GITHUB_USER $GITHUB_AUTH
#    https://gist.github.com/ae6e1545b92ee5dfa595930df4a5f633
# The output is the id of the gist, use this to set REPORT_GIST and VIZ_GIST below.

cd /home/nick/proj/agoric/eng-process/planning/issues

mkdir -p data

run()
{
	##############################################################################
	# Get issue data for release
	##############################################################################

	python3 get_issue_data.py config.yml $GITHUB_AUTH \
	  $ZENHUB_AUTH "$REL" data/${PREFIX}-issues.csv data/${PREFIX}-rels.csv

	if [ $? -ne 0 ]; then
		echo "aborting because get_issue_data.p failed!"
		exit 1
	fi

	##############################################################################
	# Sync release -> milestone data for release
	##############################################################################

	if [ "$SYNC" = true ]; then
		python3 sync_milestone.py $GITHUB_AUTH data/${PREFIX}-issues.csv "$REL" ;
	fi

	##############################################################################
	# Generate issue report
	##############################################################################

	python3 gen_report.py data/${PREFIX}-issues.csv 2022-01-19 2.4 > data/${PREFIX}-issue-report.txt
 	if [ "$REPORT_GIST" != "none" ]; then
		python3 update-gist.py data/${PREFIX}-issue-report.txt $REPORT_GIST \
		  $GITHUB_USER $GITHUB_AUTH
 	fi

    # Quick per-user velocity report.
	grep 'pts for MN' data/${PREFIX}-issue-report.txt   | sort -rn +13 | sed 's/^ *//'

	##############################################################################
	# Generate issue viz
	##############################################################################

	python3 viz_issues.py data/${PREFIX}-issues.csv data/${PREFIX}-rels.csv data/${PREFIX}-vis.dot
 	if [ "$VIZ_GIST" != "none" ]; then
		python3 update-gist.py data/${PREFIX}-vis.dot.svg $VIZ_GIST $GITHUB_USER $GITHUB_AUTH
 	fi
}

REL="Mainnet 1 RC0"
PREFIX="mn1"
REPORT_GIST=none    # See above for out to create the gist in GitHub
VIZ_GIST=none       # See above for out to create the gist in GitHub
SYNC=false
# The Mainnet 1 RC0 ZH "Release" has so many issues that this takes a long time
# (order 10+ minutes) because of ZenHub's API access request limits.
# Uncomment this if you want the report for the MN-1 issues.
# run               

REL="Vaults RC0"
PREFIX="vaults"
REPORT_GIST=none    # See above for out to create the gist in GitHub
VIZ_GIST=none       # See above for out to create the gist in GitHub
SYNC=false
run
