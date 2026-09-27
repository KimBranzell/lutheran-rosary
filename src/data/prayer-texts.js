/**
 * Prayer texts — exact Swedish wording from the content worksheet.
 * All strings are authored content; no runtime generation.
 *
 * Long prayers (Trosbekännelsen, Fader Vår) are split into paragraphs with a
 * blank line ("\n\n"); `.prayer-card__body` renders them with
 * `white-space: pre-line`.
 */

export const korsetsTecken = {
  title: 'Korsets tecken',
  body: 'I Faderns och Sonens och den Helige Andens namn. Amen.',
  // Semantic marker for the decorative cross shown with the sign of the cross.
  // The view renders it as an inline SVG (not a font glyph) so it looks the
  // same on every platform; it is `aria-hidden`.
  symbol: 'cross',
};

export const trosbekannelsen = {
  title: 'Trosbekännelsen',
  body: [
    'Vi tror på Gud Fader allsmäktig, himmelens och jordens skapare.',
    'Vi tror ock på Jesus Kristus, hans enfödde Son, vår Herre, vilken är avlad av den helige Ande, född av jungfrun Maria, pinad under Pontius Pilatus, korsfäst, död och begraven, nederstigen till dödsriket, på tredje dagen uppstånden igen ifrån de döda, uppstigen till himmelen, sittande på allsmäktig Gud Faders högra sida, därifrån igenkommande till att döma levande och döda.',
    'Vi tror ock på den helige Ande, en helig, allmännelig kyrka, de heligas samfund, syndernas förlåtelse, de dödas uppståndelse och ett evigt liv.',
  ].join('\n\n'),
};

export const faderVar = {
  title: 'Fader Vår',
  body: [
    'Fader Vår, som är i himmelen.',
    'Helgat varde ditt namn. Tillkomme ditt rike. Ske din vilja, såsom i himmelen så ock på jorden.',
    'Vårt dagliga bröd giv oss idag, och förlåt oss våra skulder, såsom ock vi förlåta dem oss skyldiga äro, och inled oss icke i frestelse utan fräls oss ifrån ondo.',
    'Ty riket är ditt och makten och härligheten i evighet. Amen.',
  ].join('\n\n'),
};

export const araVare = {
  title: 'Ära vare',
  body: 'Ära vare Fadern och Sonen och den Helige Ande. Såsom det var av begynnelsen, nu är och skall vara, från evighet till evighet. Amen.',
};

export const fatimaboen = {
  title: 'Fatimabönen',
  body: 'O min Jesus, förlåt oss våra synder, bevara oss från helvetets eld. Led alla själar till himmelen, särskilt dem som behöver din barmhärtighet allra mest. Amen.',
};

export const aveMaria = {
  title: 'Martin Luthers Ave Maria',
  full: 'Var hälsad, Maria, full av nåd. Herren är med dig. Välsignad är du bland kvinnor, och välsignad är din livsfrukt, Jesus.',
  short: 'Var hälsad, Maria, full av nåd. Herren är med dig.',
};

// The Jesus Prayer is prayed in full on every bead (owner request); there is no
// shortened form.
export const jesuboen = {
  title: 'Jesusbönen',
  full: 'Herre Jesus Kristus, Guds son, förbarma dig över mig, syndare.',
  short: 'Herre Jesus Kristus, Guds son, förbarma dig över mig, syndare.',
};

export const closingAveMaria = {
  title: 'Ave Maria',
  body: 'Var hälsad, Maria, full av nåd. Herren är med dig. Välsignad är du bland kvinnor, och välsignad är din livsfrukt, Jesus.',
};

/**
 * Closing Magnificat — a shortened rendering supplied verbatim by the owner
 * (rather than the full extracted Luke 1:46–55 passage).
 */
export const magnificat = {
  title: 'Magnificat',
  body: 'Min själ upphöjer Herren, och min ande jublade över Gud, min Frälsare! För han har sett sin tjänarinnas låga status. Se, från denna stund ska alla släkten kalla mig välsignad. För den Mäktige har gjort stora ting för mig, och heligt är hans namn. Hans barmhärtighet är över dem som fruktar honom från släkte till släkte.',
  reference: 'Lukasevangeliet 1:46-55',
};
