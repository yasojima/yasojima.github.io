(() => {
  'use strict';
  const gallery = document.querySelector('#scenes, #scene');
  const pageError = document.querySelector('#page-error');
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  let data;
  try {
    const raw = document.querySelector('#review-data').textContent
      .replace('<!-- REVIEW_DATA_START -->', '').replace('<!-- REVIEW_DATA_END -->', '');
    data = JSON.parse(raw);
    if (!Array.isArray(data.scenes) || !data.scenes.length) throw Error('台本に場面がありません。');
  } catch (error) {
    pageError.hidden = false;
    pageError.textContent = '台本を読み込めません。「一覧を更新.py」で更新してください。' + error.message;
    return;
  }
  const scenes = new Map(data.scenes.map(scene => [scene.id, scene]));
  function link(id, text) { const a = make('a', text); a.href = scenes.has(id) ? '#' + encodeURIComponent(id) : (data.sceneUrls[id] || '/sukimakun/'); return a; }
  const nav = document.querySelector('#scene-nav');
  for (const scene of data.scenes) nav.append(link(scene.id, scene.title));
  const flowList = document.querySelector('#flow-list');
  if (!data.flows.length) flowList.append(make('p', '操作の流れは未設定です。'));
  for (const flow of data.flows) {
    const article = make('article'); article.append(make('h3', flow.title), make('p', flow.explanation));
    const route = make('div', undefined, 'route');
    flow.sceneIds.forEach((id, i) => { if (i) route.append(make('span', '→')); route.append(link(id, scenes.get(id).title)); });
    article.append(route); flowList.append(article);
  }
  function renderScene(scene) {
    const area = make('section', undefined, 'scene');
    area.id = scene.id;
    const titleId = scene.id + '-title';
    area.setAttribute('aria-labelledby', titleId);
    const heading = make('div', undefined, 'scene-heading');
    const h2 = make('h2', scene.title);
    h2.id = titleId;
    const managerReview = scene.approval.state === 'managerReview';
    heading.append(h2, make('span', managerReview ? '管理者PC版の確認' : scene.approval.state, 'status'));
    area.append(heading, make('p', scene.description));
    const pair = make('div', undefined, managerReview ? 'pair manager-review' : 'pair');
    const approved = scene.approval.state === '採用済' && scene.roles.manager.image && scene.roles.staff.image;
    const images = [];

    for (const [key, label] of [['manager', '管理者権限以上'], ['staff', '一般スタッフ']]) {
      const role = scene.roles[key];
      const card = make('article', undefined, 'role'); card.append(make('h3', label));
      const showImage = approved || (managerReview && key === 'manager' && role.image);
      const imageArea = make('div', undefined, showImage ? 'image-area' : 'placeholder');
      if (!showImage) imageArea.append(make('p', managerReview ? '一般スタッフ版は制作・確認待ちです。' : '採用画像はまだありません。\n画像はチャットで確認し、採用後にここへ追加します。'));
      else {
        imageArea.append(make('p', '採用画像の寸法を確認しています。'));
        const img = new Image(); img.className = 'role-image'; img.alt = scene.id + ' ' + scene.title + '｜' + label;
        images.push({ img, role, imageArea });
      }
      card.append(imageArea, make('p', role.note || '', 'role-note'));
      pair.append(card);
    }
    area.append(pair);
    let ready = Promise.resolve();
    if (images.length) {
      const loaded = images.map(async ({ img, role }) => {
        let src = role.image.path;
        if (src.startsWith('data:image/')) {
          src = URL.createObjectURL(await (await fetch(src)).blob());
        }
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(); img.onerror = () => reject(Error('採用画像を読み込めません。'));
          img.src = src;
        });
      });
      ready = Promise.all(loaded).then(() => {
        const dimensions = images.map(({ img }) => [img.naturalWidth, img.naturalHeight]);
        const correct = images.every(({ role }, i) => dimensions[i][0] === role.image.width && dimensions[i][1] === role.image.height)
          && (!approved || (dimensions[0][0] === dimensions[1][0] && dimensions[0][1] === dimensions[1][1]));
        if (!correct) throw Error('原稿寸法が台本と一致しないか、両権限の寸法が揃っていません。画像を変形せず、台本と原稿を確認してください。');
        images.forEach(({ img, role, imageArea }) => {
          const a = make('a', undefined, 'image-link'); a.href = img.src; a.target = '_blank'; a.rel = 'noopener';
          a.style.setProperty('--source-width', role.image.width + 'px'); a.append(img);
          imageArea.replaceChildren(a);
          imageArea.after(make('p', '原稿 ' + role.image.width + ' × ' + role.image.height + ' px｜同率縮小・拡大なし', 'image-caption'));
        });
      }).catch(error => {
        for (const { imageArea } of images) { imageArea.className = 'placeholder'; imageArea.replaceChildren(make('p', error.message, 'error')); }
      });
    }
    const metadata = make('dl', undefined, 'metadata');
    const fields = [['入口・操作', scene.entryAction], ['参照・保存', scene.referenceAndSave], ['取消・失敗・戻り', scene.cancelFailureAndReturn]];
    if (approved || managerReview) {
      fields.push([managerReview ? '確認依頼日' : '採用日', scene.approval.date]);
      if (scene.approval.source) fields.push(['確認の出典', scene.approval.source]);
      if (scene.approval.userWords) fields.push(['本人の発言', scene.approval.userWords]);
    }
    for (const [title, value] of fields) metadata.append(make('dt', title), make('dd', value || '未設定'));
    const details = make('details', undefined, 'scene-details');
    details.append(make('summary', '場面の確認記録'), metadata);
    area.append(details);
    const sequence = make('nav', undefined, 'sequence'); sequence.setAttribute('aria-label', '前後の場面');
    if (scene.previous) sequence.append(link(scene.previous, '← 前の場面'));
    if (scene.next) sequence.append(link(scene.next, '次の場面 ↓'));
    if (sequence.childNodes.length) area.append(sequence);
    gallery.append(area);
    return ready;
  }

  function updateAnchor() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
    const active = scenes.has(id) ? id : data.scenes[0].id;
    pageError.hidden = !id || scenes.has(id);
    pageError.textContent = pageError.hidden ? '' : '指定された場面は台本にありません。';
    for (const a of nav.querySelectorAll('a')) {
      if (a.hash === '#' + encodeURIComponent(active)) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
    return id;
  }

  const ready = data.scenes.map(renderScene);
  const initialTarget = updateAnchor();
  window.addEventListener('hashchange', updateAnchor);
  Promise.all(ready).then(() => {
    if (scenes.has(initialTarget) && location.hash === '#' + encodeURIComponent(initialTarget)) {
      document.getElementById(initialTarget).scrollIntoView();
    }
  });
})();
