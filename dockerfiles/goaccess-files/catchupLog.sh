
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
