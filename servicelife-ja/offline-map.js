function installReferenceMap(map) {
  const Grid=L.GridLayer.extend({createTile(){const tile=document.createElement('canvas');tile.width=tile.height=256;const c=tile.getContext('2d');c.fillStyle='#f3f6f4';c.fillRect(0,0,256,256);c.strokeStyle='#dce5df';c.lineWidth=1;for(let i=0;i<=256;i+=64){c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(256,i);c.stroke()}return tile;}});
  new Grid({maxZoom:19}).addTo(map);
  map.attributionControl?.setPrefix(false);
  map.attributionControl?.addAttribution('訪問位置・ルートの確認図');
  map.getContainer().dataset.networkMode='local-only';
}
