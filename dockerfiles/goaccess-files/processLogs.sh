currentDateTime=$(date +"%Y-%m-%dT%H:%M")

for logFile in /var/log/nginx-shared/*.log; do

  if [ -s $logFile ]; then

    rotatedLog="$logFile-$currentDateTime.log"
    report="$logFile-$currentDateTime.html"

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
