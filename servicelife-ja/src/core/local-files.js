// Only links created here can navigate to a locally generated document.
const links=new WeakMap();
export function documentLink(link,url){if(!url.startsWith('blob:'+location.origin+'/'))throw new Error('Not a local document');links.set(link,url);link.href=url;return link;}
export const isDocumentLink=link=>links.get(link)===link.getAttribute('href');
