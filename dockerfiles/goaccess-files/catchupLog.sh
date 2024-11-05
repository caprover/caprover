#!/bin/sh

# This script is a much simpler version of the processLogs script
# It simply loops over the up to date nginx log files and creates a
# GoAccess report for it with a consistent name so it will be overwritten
# next time this runs.

# The --restore and --persist flags let GoAccess process the logs incrementally
# so it doesn't have to process the whole log file from scratch each time

for logFile in /var/log/nginx-shared/*.log; do

  # Ensure the log isn't empty
  if [ -s $logFile ]; then

    filename=$(basename "$logFile")
    appName=${filename%%--*}
    appPath="/var/log/nginx-shared/$appName"

    report="$appPath/$filename--Current.html"

    echo "Processing catchup $report"

    goaccess $logFile -a -o "$report" --log-format=COMBINED --restore --persist

  fi

done
