const ATT_HEADER = 'CADC_Attributes_File v1.0 , start: NEW , end: END , name_end: := , sep: &end&';

/**
 * Writes Navisworks-readable ATT metadata matching the RVM hierarchy.
 * Parameters: export tree from buildRvmExportModel.
 * Output: text ATT content with NEW/END blocks and scalar properties.
 * Fallback: nullish values are written as N/A so properties remain explicit.
 */
export function writeAtt(exportModel) {
  const lines = [ATT_HEADER];
  writeNode(lines, exportModel.root, 0);
  return `${lines.join('\r\n')}\r\n`;
}

function writeNode(lines, node, depth) {
  const indent = '  '.repeat(depth);
  lines.push(`${indent}NEW ${node.name}`);
  const attributes = node.attributes || {};
  for (const [key, value] of Object.entries(attributes)) {
    lines.push(`${indent}  ${safeKey(key)} := '${safeValue(value)}'`);
  }
  for (const child of node.children || []) {
    writeNode(lines, child, depth + 1);
  }
  lines.push(`${indent}END`);
}

function safeKey(key) {
  return String(key || 'UNNAMED').replace(/[^A-Za-z0-9_]+/g, '_').toUpperCase();
}

function safeValue(value) {
  if (value == null || value === '') return 'N/A';
  return String(value).replace(/\r?\n/g, ' ').replace(/'/g, "''");
}
