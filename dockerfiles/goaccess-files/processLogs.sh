currentDateTime=$(date +"%Y-%m-%dT%H:%M")

echo "Checking logs to process"
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

  fi

done


# Loop through the gzipped log files and delete ones past the log retention time
if [ "$LOG_RETENTION_DAYS" -gt 0 ]; then
  echo "Checking log retention"
  currentTimestamp=$(date +%s)

  for tarFile in /var/log/nginx-shared/*.gz; do
    if [ -f "$tarFile" ]; then
      fileTimestamp=$(stat -c %Y "$tarFile")
      retentionTimestamp=$((currentTimestamp - LOG_RETENTION_DAYS * 24 * 60 * 60))

      if [ "$fileTimestamp" -lt "$retentionTimestamp" ]; then
        echo "$tarFile past retention, deleting"
        rm "$tarFile"
      fi
    fi
  done

  # Now remove the reports that are past retention time
  for folder in /var/log/nginx-shared/*; do
    if [ -d "$folder" ]; then
      for htmlFile in "$folder"/*.html; do
        if [ -f "$htmlFile" ]; then
          # Get the file's modification time in seconds since the epoch
          fileTimestamp=$(stat -c %Y "$htmlFile")
          retentionTimestamp=$((currentTimestamp - LOG_RETENTION_DAYS * 24 * 60 * 60))

          if [ "$fileTimestamp" -lt "$retentionTimestamp" ]; then
            echo "$htmlFile past retention, deleting"
            rm "$htmlFile"
          fi
        fi
      done
    fi
  done
fi

echo "Done"