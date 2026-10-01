/**
 * Licensing and attribution data.
 * All user-facing strings are in Swedish.
 */

import { esc } from '../util/esc.js';

export const sourceAttribution = {
  bibleName: 'Svenska Kärnbibeln',
  bibleNameLocal: 'Svenska Kärnbibeln — en expanderad översättning',
  provider: 'Svenska Kärnbibeln',
  sourceUrl: 'https://www.karnbibeln.se/',
  licenseName: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  agreementId: '311774',
  contentId: 'fa4317c59f0825e0',
  extractionNotice: 'Utvalda versavsnitt har extraherats från USX 3.0-källfiler. Förklarande tillägg, korsreferenser och alternativa formuleringar inom hakparenteser eller parenteser har tagits bort, liksom fristående kommentarer och inledningar utanför versgränserna. Versernas ordalydelse har bevarats.',
};

export function getAttributionHtml() {
  const a = sourceAttribution;
  return `
    <p>Bibeltext hämtad från <a href="${esc(a.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(a.bibleName)}</a>.</p>
    <p>© ${esc(a.provider)}. Tillgänglig under <a href="${esc(a.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(a.licenseName)}</a>.</p>
    <p><small>${esc(a.extractionNotice)}</small></p>
    <p><small>DBL-avtal ${esc(a.agreementId)}, innehålls-ID ${esc(a.contentId)}.</small></p>
  `;
}
