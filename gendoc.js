const fs = require('fs')

const req = fs.readFileSync('需求文档.md', 'utf-8')
const manual = fs.readFileSync('使用说明.md', 'utf-8')

function escape(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function convert(md) {
  const lines = md.split('\n')
  const out = []
  let inCode = false, inTable = false, inList = false

  for (const line of lines) {
    // code block
    if (line.startsWith('```')) {
      if (inCode) { out.push('</pre>'); inCode = false }
      else { out.push('<pre>'); inCode = true }
      continue
    }
    if (inCode) { out.push(escape(line)); continue }

    // table
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (line.includes('---')) continue
      if (!inTable) { out.push('<table>'); inTable = true }
      const cells = line.split('|').filter(c => c.trim()).map(c => escape(c.trim().replace(/\*\*/g, '')))
      out.push('<tr>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>')
      continue
    }
    if (inTable) { out.push('</table>'); inTable = false }

    // blank line
    if (!line.trim()) {
      if (inList) { out.push('</ul>'); inList = false }
      out.push('<br>')
      continue
    }

    // headings
    if (line.startsWith('# ')) { out.push('<h1>' + escape(line.slice(2)) + '</h1>'); continue }
    if (line.startsWith('## ')) { out.push('<h2>' + escape(line.slice(3)) + '</h2>'); continue }
    if (line.startsWith('### ')) { out.push('<h3>' + escape(line.slice(4)) + '</h3>'); continue }
    if (line.startsWith('#### ')) { out.push('<h4>' + escape(line.slice(5)) + '</h4>'); continue }

    // list items
    if (/^[\s]*[-*]\s/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      const txt = escape(line.replace(/^[\s]*[-*]\s*/, ''))
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
      out.push('<li>' + txt + '</li>')
      continue
    }

    // regular paragraph
    if (inList) { out.push('</ul>'); inList = false }
    const p = escape(line)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
    out.push(p)
  }

  if (inTable) out.push('</table>')
  if (inCode) out.push('</pre>')
  if (inList) out.push('</ul>')

  return out.join('\n')
}

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
body{font-family:SimSun,serif;max-width:820px;margin:0 auto;padding:30px;line-height:1.8;color:#222}
h1{text-align:center;font-size:20pt;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px}
h2{font-size:15pt;border-bottom:1px solid #999;padding-bottom:6px;margin-top:32px;margin-bottom:12px}
h3{font-size:13pt;margin-top:24px;margin-bottom:8px}
h4{font-size:12pt;margin-top:16px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:10pt}
td{border:1px solid #bbb;padding:6px 10px}
ul{margin:4px 0;padding-left:24px}
li{margin:2px 0}
code{background:#f2f2f2;padding:1px 5px;font-size:10pt}
pre{background:#f2f2f2;padding:12px;white-space:pre-wrap;font-size:10pt;border-left:3px solid #ccc}
b{color:#1a1a1a}
</style></head>
<body>
${convert(req)}
<div style="page-break-before:always"></div>
${convert(manual)}
</body></html>`

fs.writeFileSync('合同智能提取工具-V1.6文档.html', html)
console.log('OK: ' + (fs.statSync('合同智能提取工具-V1.6文档.html').size / 1024).toFixed(0) + 'KB')
