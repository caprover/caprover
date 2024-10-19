
for file in /var/www/logs/*.log; do
  report=${file%.log}.html

  if [ -f $report ]; then
    echo "$report already exists, skipping"
  else
    echo "Processing $report"
    goaccess $file -a -o $report --log-format=COMBINED
  fi

done
