/** RFC-4180-style CSV parsing shared by dataset loading and rating imports. Mirrors the original checker's behaviour. */

export type CsvRecord = Record<string, string>;

export function parseCSV(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('Unexpected quote in CSV.');
      quoted = true;
    } else if (c === ',') {
      row.push(cell); cell = ''; closed = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(x => x !== '')) result.push(row);
      row = []; cell = ''; closed = false;
    } else {
      if (closed) throw new Error('Unexpected characters after a quoted field.');
      cell += c;
    }
  }
  if (quoted) throw new Error('Unclosed quote in CSV.');
  if (cell || row.length || closed) {
    row.push(cell);
    if (row.some(x => x !== '')) result.push(row);
  }
  return result;
}

export function csvRecords(text: string): { headers: string[]; rows: CsvRecord[] } {
  const matrix = parseCSV(text);
  if (matrix.length < 2) throw new Error('The CSV has no vocabulary rows.');
  const headers = matrix.shift() as string[];
  if (new Set(headers).size !== headers.length || headers.some(h => !h)) throw new Error('Empty or duplicate CSV column names.');
  const rows = matrix.map((row, i) => {
    if (row.length !== headers.length) throw new Error(`Row ${i + 2} has the wrong number of fields.`);
    return Object.fromEntries(headers.map((h, j) => [h, row[j]])) as CsvRecord;
  });
  return { headers, rows };
}

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution when exported files are opened in Excel.
  if (/^[\t\r\n ]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
