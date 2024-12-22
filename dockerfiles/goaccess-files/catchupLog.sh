#!/bin/sh

# This script is a simpler version of the processLogs script
# It loops over log files matching the environment variable $FILE_PREFIX
# which limits it to one app and domain and creates a
# GoAccess report for it with a consistent name so it will be overwritten
# next time this runs.

# The --restore and --persist flags let GoAccess process the logs incrementally
# so it doesn't have to process the whole log file from scratch each time

echo "Starting Catchup for $FILE_PREFIX"
for logFile in /var/log/nginx-shared/$FILE_PREFIX*access.log; do


  filename=$(basename "$logFile")
  appName=${filename%%--*}
  appPath="/var/log/nginx-shared/$appName"
  dbPath="$appPath/$filename-db"

  # Make directory for all the reports to live in, and the GoAccess db
  mkdir -p $appPath
  mkdir -p $dbPath

  report="$appPath/$filename--Live.html"

  echo "Processing catchup $report"

  goaccess $logFile -a -o "$report" --log-format=COMBINED --restore --persist --db-path $dbPath


done
