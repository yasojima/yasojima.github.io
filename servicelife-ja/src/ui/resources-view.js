import { el, button, icon, select } from './elements.js';
import { refuseMutation } from '../domain/bookings.js';
import { resourceEditor, itemTypes } from './resource-editor.js';

const definitions = {
  'job-types': {title:'作業の種類',icon:'tags',add:'作業の種類を追加'},
  pricebook: {title:'料金表',icon:'book',add:'品目を追加',search:'項目を検索',filter:[['','すべての種類'],...itemTypes],filterId:'filterType',
    headings:['コード','氏名','種類','標準プラン（ドル）','上位プラン（ドル）','最上位プラン（ドル）','原価（ドル）','粗利率','区画・部屋番号','稼働中'],empty:'登録された項目はありません'},
  inventory: {title:'在庫',icon:'boxes',add:'品目を追加',search:'品名・商品コードで検索',
    headings:['商品管理番号（SKU）','名称','区画・部屋番号','原価','総在庫数','発注点（この数を下回ると補充）','対応状況'],empty:'在庫品はまだ登録されていません'},
  equipment: {title:'機材・備品',icon:'tools',add:'機材を追加',search:'品名・製造番号・バーコード・顧客名で検索',filterId:'filterStatus',
    filter:[['','すべての対応状況'],['active','稼働中'],['needs_service','整備が必要'],['inactive','停止中'],['retired','使用終了']],
    headings:['氏名','お客様','種類','製造番号','対応状況','保証','最終整備日','次の期限'],empty:'登録された設備はありません'}
};
export function resourcesView(snapshot,kind) {
  const config=definitions[kind];if(!config)throw Error('Unknown resource list');
  const dialogs=new Set();let toast;
  const editor=record=>{const modal=resourceEditor(kind,snapshot,record);dialogs.add(modal);modal.addEventListener('close',()=>dialogs.delete(modal),{once:true})};
  const node=el('section',{class:'resources-content '+kind+'-content','data-resource-kind':kind});
  if(kind==='job-types') {
    const cards=el('div',{class:'service-cards'});
    for(const record of snapshot.services){
      const remove=button(icon('trash-alt'),()=>{
        if(!confirm('Delete job type "'+record.name+'"? This cannot be undone.'))return;
        toast?.remove();toast=el('div',{class:'local-toast',role:'status','data-status':'403'},el('span',{text:refuseMutation().message}),button('×',()=>toast.remove(),{'aria-label':'通知を閉じる'}));document.body.append(toast);
      },{class:'service-remove','aria-label':record.label+'を削除'});
      const card=el('article',{class:'service-card','data-service-id':record.id},
        button([el('span',{class:'service-dot'+(record.active?'':' inactive')}),el('span',{},el('strong',{text:record.label}),el('span',{class:'service-caption',text:record.minutes+'分・$'+Number(record.price).toFixed(2)+'・'+(record.active?'提供中':'停止中')}))],()=>editor(record),{class:'service-open','aria-label':record.label+'を編集'}),remove);
      if(/^#[0-9a-f]{6}$/i.test(record.color))card.style.borderLeftColor=record.color;
      cards.append(card);
    }
    node.append(cards);
  } else {
    if(kind==='inventory')node.append(el('div',{class:'inventory-stats'},
      [['total_items','項目'],['total_locations','訪問先'],['low_stock_alerts','在庫わずか'],['total_value','在庫の評価額'],['pending_pos','承認待ちの発注書']].map(([key,label])=>el('div',{},el('span',{text:label}),el('strong',{class:key==='low_stock_alerts'?'stock-alert':'',text:(key==='total_value'?'$':'')+Number(snapshot.inventoryStats[key]).toLocaleString('en-US')})))));
    const filters=el('div',{class:'resource-filters'},el('input',{id:'search',type:'search',placeholder:config.search,'aria-label':config.search}));
    if(config.filter)filters.append(select(config.filter[0][1],config.filter.map(([value,label])=>({value,label})),'',()=>{},{id:config.filterId}));
    // These reviewed collections are empty. Search and type/status filters keep
    // the same empty result; the build refuses newly added records until their
    // row actions have been migrated, instead of quietly dropping those rows.
    node.append(filters,el('div',{class:'table-scroll'},el('table',{class:'resource-table'},el('thead',{},el('tr',{},config.headings.map(label=>el('th',{text:label})))),
      el('tbody',{},el('tr',{},el('td',{colspan:config.headings.length,class:'empty',text:config.empty}))))));
  }
  return {node,title:config.title,titleIcon:config.icon,addLabel:config.add,add(){editor(null)},mount(){},dispose(){for(const modal of dialogs)modal.close();toast?.remove()}};
}
