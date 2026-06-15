#!/bin/bash
# Group contracts by employee IDs from CSV, 5 employees per batch

SRC="c:/Users/Zora/Desktop/coding/contract/contracts/download"
DST="c:/Users/Zora/Desktop/coding/contract/contracts"
CSV="c:/Users/Zora/Desktop/coding/contract/员工序号表.csv"
TMP_CSV="${CSV}.tmp"

# Read employee IDs from CSV (skip header, col 2)
emp_ids=()
while IFS=',' read -r seq emp_id rest; do
  [[ "$seq" == "序号" ]] && continue
  [[ -z "$emp_id" ]] && continue
  emp_ids+=("$emp_id")
done < "$CSV"

total=${#emp_ids[@]}
echo "CSV 员工数: $total"
echo "预计分组: $(( (total + 4) / 5 ))"

# Write new CSV header
echo "序号,员工编号,文件数,批次" > "$TMP_CSV"

seq=1
for ((i=0; i<total; i+=5)); do
  start_num=$((i + 1))
  end_num=$((i + 5))
  [ $end_num -gt $total ] && end_num=$total

  batch_dir="${DST}/${start_num}-${end_num}"
  mkdir -p "$batch_dir"

  echo -n "[${start_num}-${end_num}] "
  for ((j=i; j<end_num; j++)); do
    emp_id="${emp_ids[$j]}"
    count=$(ls "$SRC/${emp_id}__"*.pdf 2>/dev/null | wc -l)
    cp "$SRC/${emp_id}__"*.pdf "$batch_dir/" 2>/dev/null
    echo "$seq,$emp_id,$count,${start_num}-${end_num}" >> "$TMP_CSV"
    echo -n "$emp_id($count) "
    seq=$((seq + 1))
  done
  echo ""
done

mv "$TMP_CSV" "$CSV"

echo ""
echo "=== 完成 ==="
echo "分组目录: $(ls -d "$DST"/*-[0-9]*/ 2>/dev/null | wc -l)"
echo "CSV 行数: $(wc -l < "$CSV")"
head -6 "$CSV"
