import { strToU8, zipSync } from 'fflate'
import { fixtureActivities } from '../test-fixture'
import { handlers } from '../types'

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const text = (address: string, value: string) => `<c r="${address}" t="inlineStr"><is><t>${value.replaceAll('&', '&amp;')}</t></is></c>`
export function fixtureTemplate(assignedOnly = false) {
  const activities = fixtureActivities(), names = ['Progress', ...handlers]
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>`).join('')}<Relationship Id="calc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain" Target="calcChain.xml"/></Relationships>`),
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.calcChain+xml"/></Types>'),
    'xl/calcChain.xml': strToU8(`<calcChain xmlns="${NS}"/>`),
    'xl/styles.xml': strToU8('<styles-preserved/>'),
    'xl/comments1.xml': strToU8('<original-comment/>'),
  }
  names.forEach((_, index) => {
    const list = index ? activities.filter(a => a.wbs !== 'GR&P' && (!assignedOnly || !a.editable || a.handler === names[index])) : activities
    const rows = list.map((a, i) => {
      const r = i + (index ? 5 : 6)
      return `<row r="${r}" ht="20">${text(`A${r}`, a.wbs)}${text(`J${r}`, a.name)}<c r="K${r}" s="0"><v>${index ? a.baseline : a.relativeWeight}</v></c>${index ? `<c r="M${r}" s="0"><v>${a.progress}</v></c>` : `<c r="N${r}"><v>${a.progress}</v></c><c r="S${r}"><v>${a.globalWeight}</v></c>`}</row>`
    }).join('')
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(`<worksheet xmlns="${NS}"><dimension ref="A1:${index ? 'M' : 'U'}20"/><sheetViews><sheetView workbookViewId="0"><pane topLeftCell="B5" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="12"/></cols><sheetData><row r="1">${text('A1', 'Original heading')}</row>${index ? '' : `<row r="5">${text('J5', 'TOTAL')}<c r="K5"><v>1</v></c></row>`}${rows}</sheetData><pageSetup paperSize="9" orientation="portrait"/></worksheet>`)
  })
  return zipSync(files)
}
