import { el } from './elements.js';

// Quill is an independently licensed editor. Application state and preview
// construction are ours; no captured page programs or templates are executed.
let registered=false;
function prepareEditor() {
  if(registered)return;
  const Link=globalThis.Quill.import('formats/link');
  class LocalLink extends Link {
    static sanitize(){return '#';}
    static create(value){const node=super.create(value);node.removeAttribute('target');return node;}
  }
  globalThis.Quill.register(LocalLink,true);
  registered=true;
}

// Copy only presentation nodes from the editor model. No HTML string is parsed,
// and no source URL, style, handler, embedded object, or arbitrary attribute is
// carried into the preview. Link destinations remain inert in this demo.
export function copyPresentation(source,target) {
  const allowed=new Set(['P','H1','H2','H3','STRONG','EM','U','OL','UL','LI','BR','A']);
  const copy=node=>{
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent);
    if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
    if(node.tagName==='SPAN'&&node.className==='ql-ui')return el('span',{class:'ql-ui',contenteditable:'false'});
    if(!allowed.has(node.tagName))return document.createTextNode(node.textContent||'');
    const next=el(node.tagName.toLowerCase());
    if(node.tagName==='A'){next.setAttribute('href','#');next.setAttribute('rel','noopener noreferrer');}
    if(node.tagName==='LI'&&['bullet','ordered'].includes(node.getAttribute('data-list')))next.setAttribute('data-list',node.getAttribute('data-list'));
    for(const child of node.childNodes)next.append(copy(child));
    return next;
  };
  target.replaceChildren(...Array.from(source.childNodes,copy));
}

export function richTextEditor(container,preview) {
  prepareEditor();
  const editor=new globalThis.Quill(container,{
    theme:'snow',placeholder:'Document the treatment steps for this job type...',
    formats:['header','bold','italic','underline','list','link'],
    modules:{toolbar:[[{header:[1,2,3,false]}],['bold','italic','underline'],[{list:'ordered'},{list:'bullet'}],['link'],['clean']]}
  });
  const changed=()=>copyPresentation(editor.root,preview);
  editor.on('text-change',changed);
  return{dispose(){editor.off('text-change',changed);editor.disable();}};
}
