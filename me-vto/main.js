function main(){
  const canvasFace=document.getElementById('WebARRocksFaceCanvas');
  const canvasThree=document.getElementById('threeCanvas');
  WebARRocksMirror.init({
    isGlasses:false,
    specWebARRocksFace:{NNCPath:'../vendor/webar-rocks-face-819cdbad/neuralNets/NN_HEADPHONESL_2.json',scanSettings:{threshold:0.6}},
    isLightReconstructionEnabled:true,
    landmarksStabilizerSpec:{beta:20,forceFilterNNInputPxRange:[1.5,4]},
    solvePnPObjPointsPositions:{"noseLeft":[21.862150,-0.121031,67.803383],"noseRight":[-20.539499,0.170727,69.944778],"leftEyeExt":[44.507431,34.942841,38.750019],"rightEyeExt":[-44.064968,35.399670,39.362930],"leftEarTop":[89.165428,16.312811,-49.064980],"leftEarBase":[78.738243,-6.044550,-23.177490],"leftEarBottom":[78.786850,-41.321789,-24.603769],"rightEarTop":[-88.488602,17.271400,-48.199409],"rightEarBase":[-78.156998,-5.305619,-22.164619],"rightEarBottom":[-78.945511,-41.255100,-26.536131],"leftTemple":[60.262970,83.790382,-13.540310],"rightTemple":[-60.034760,83.584427,-13.248530],"foreHead":[-1.057755,97.894547,24.654940]},
    solvePnPImgPointsLabels:["foreHead","leftTemple","rightTemple","leftEarTop","rightEarTop","leftEyeExt","rightEyeExt","rightEarBottom","leftEarBottom"],
    canvasFace,canvasThree,width:Math.min(innerHeight,innerWidth),height:innerHeight,
    occluderURL:'../vendor/webar-rocks-face-819cdbad/demos/VTOHat/assets/models3D/occluder.glb',
    modelURL:'./hair.gltf',
    envmapURL:'../vendor/webar-rocks-face-819cdbad/demos/VTOHat/assets/envmaps/venice_sunset_512.hdr',
    taaLevel:0,debugLandmarks:false,debugOccluder:false
  }).then(()=>{const resize=()=>WebARRocksMirror.resize(Math.min(innerWidth,innerHeight),innerHeight);addEventListener('orientationchange',resize);addEventListener('resize',resize)});
}
addEventListener('load',main);
