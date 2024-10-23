currentDateTime=$(date +"%Y-%m-%dT%H:%M")

for logFile in /var/log/nginx-shared/*.log; do

  # Ensure the log isn't empty
  if [ -s $logFile ]; then

    filename=$(basename "$logFile")
    appName=${filename%%--*}
    appPath="/var/log/nginx-shared/$appName"

    # Make directory for all the reports to live in
    mkdir -p $appPath

    rotatedLog="$logFile--$currentDateTime.log"
    report="$appPath/$filename--$currentDateTime.html"

    if [ -f "$report" ]; then
      echo "$report already exists, skipping"
    else
      echo "Processing $report"

      # Manually rotate the log files
      cp $logFile $rotatedLog
      truncate -s 0 $logFile

      goaccess $rotatedLog -a -o "$report" --log-format=COMBINED

      gzip $rotatedLog
    fi

  else
    echo "File $logFile does not exist or is empty"
  fi

done
