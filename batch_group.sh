#!/bin/bash
# Group contract PDFs by employee ID, 5 employees per batch
# Directory naming: 1-5, 6-10, 11-15, ...

SRC="c:/Users/Zora/Desktop/coding/contract/contracts/download"
DST="c:/Users/Zora/Desktop/coding/contract/contracts"

cd "$SRC" || exit 1

# 1. Collect all unique employee IDs (part before first __)
declare -A emp_map
for f in *.pdf; do
  emp_id="${f%%__*}"
  emp_map["$emp_id"]=1
done

# 2. Sort employee IDs ascending
sorted_ids=($(printf '%s\n' "${!emp_map[@]}" | sort))

total_emps=${#sorted_ids[@]}
echo "Total unique employees: $total_emps"

# 3. Group into batches of 5 and copy files
for ((i=0; i<total_emps; i+=5)); do
  # 1-based range for directory name
  start_num=$((i + 1))
  end_num=$((i + 5))
  if [ $end_num -gt $total_emps ]; then
    end_num=$total_emps
  fi

  batch_dir="${DST}/${start_num}-${end_num}"
  mkdir -p "$batch_dir"

  echo -n "[${start_num}-${end_num}] ${sorted_ids[$i]} .. ${sorted_ids[$((end_num-1))]} — "
  count=0
  for ((j=i; j<end_num; j++)); do
    emp_id="${sorted_ids[$j]}"
    cp "$SRC/${emp_id}__"*.pdf "$batch_dir/" 2>/dev/null
    file_count=$(ls "$batch_dir/${emp_id}__"*.pdf 2>/dev/null | wc -l)
    count=$((count + file_count))
  done
  echo "$count files copied"
done

echo ""
echo "Done!"
ls -d "$DST"/*/ 2>/dev/null | wc -l | xargs echo "Total directories created:"
ls -d "$DST"/*/ 2>/dev/null | grep -v download | sort -V
