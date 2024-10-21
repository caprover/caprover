currentDateTime=$(date +"%Y-%m-%dT%H:%M")

for folder in /var/www/logs/*; do
  if [ -d "$folder" ]; then
    logFile="access.log"

    if [ -s "$folder/$logFile" ]; then
      rotatedLog="$folder/$currentDateTime.log"
      report="$folder/$currentDateTime.html"

      if [ -f "$report" ]; then
        echo "$report already exists, skipping"
      else
        echo "Processing $report"

        # Manually rotate the log files
        cp "$folder/$logFile" $rotatedLog
        truncate -s 0 "$folder/$logFile"

        goaccess $rotatedLog -a -o "$report" --log-format=COMBINED

        gzip $rotatedLog
      fi

    else
      echo "File $folder/$logFile does not exist or is empty"
    fi


  fi
done
