export function el(tag, options = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value ?? '';
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'value') node.value = value ?? '';
    else if (key === 'checked' || key === 'disabled' || key === 'hidden') node[key] = !!value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
export const icon = name => el('i', { class: 'fas fa-' + name, 'aria-hidden': 'true' });
export const button = (text, action, options = {}) => el('button', { type: 'button', onclick: action, ...options }, text);
export function select(label, choices, value, change, attributes = {}) {
  const node = el('select', { 'aria-label': label, onchange: event => change(event.target.value), ...attributes },
    choices.map(item => el('option', { value: item.value }, item.label)));
  node.value = value ?? '';
  return node;
}
export function dialog(title, body, footer = []) {
  const node = el('dialog', { class: 'dialog', 'aria-label': title });
  const close = () => node.close();
  node.append(el('header', {}, el('h2', { text: title }), button('×', close, { class: 'close', 'aria-label': '閉じる' })),
    el('div', { class: 'dialog-body' }, body), el('footer', {}, footer, button('閉じる', close)));
  node.addEventListener('close', () => node.remove(), { once: true });
  node.addEventListener('click', event => {
    if (event.target !== node) return;
    const r = node.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });
  document.body.append(node); node.showModal();
  return node;
}
export function notice(message) { return dialog('確認用デモ', el('p', { text: message })); }
