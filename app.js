const state = { photos: [null, null, null, null], color: '#ffffff', camera: null, cameraPhotos: [null, null, null, null] };
const $ = (id) => document.getElementById(id);
const slots = $('slots'), input = $('fileInput'), message = $('message'), toast = $('toast');
const today = new Date();
const dateText = `${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2,'0')}. ${String(today.getDate()).padStart(2,'0')}`;
$('previewDate').textContent = dateText;

function render() {
  slots.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const slot = document.createElement('button'); slot.type='button'; slot.className='slot'; slot.setAttribute('aria-label', `${i+1}번 사진 ${photo?'변경':'추가'}`);
    slot.innerHTML = photo ? `<img src="${photo.url}" alt="${i+1}번 사진"><span class="slot-num">${i+1}</span><span class="slot-remove" role="button" aria-label="사진 삭제">×</span>` : `<span class="slot-empty"><b>＋</b><small>사진 ${i+1}</small></span>`;
    slot.addEventListener('click', e => { if(e.target.classList.contains('slot-remove')) { e.stopPropagation(); setPhoto(i, null); return; } input.dataset.index=i; input.click(); });
    slots.append(slot);
  });
  $('photoCount').textContent = `${state.photos.filter(Boolean).length} / 4`;
  $('previewFrames').innerHTML = '';
  state.photos.forEach((p,i)=>{ const frame=document.createElement('div');frame.className='preview-frame'; frame.innerHTML=p?`<img src="${p.url}" alt="미리보기 ${i+1}">`:`<div class="frame-empty">${String(i+1).padStart(2,'0')}</div>`; $('previewFrames').append(frame); });
  $('photoStrip').style.background=state.color;
  $('photoStrip').style.color=inkFor(state.color);
  $('downloadBtn').disabled=!state.photos.every(Boolean);
  message.textContent=state.photos.every(Boolean)?'좋아요! 나만의 네컷 사진이 완성됐어요.':'사진 네 장을 채우면 저장할 수 있어요.';
}
function setPhoto(i, photo) { state.photos[i]=photo; render(); }
input.addEventListener('change', e=>{ const files=[...e.target.files]; const start=Number(input.dataset.index||0); files.forEach((file,j)=>{const idx=start+j;if(idx>3||!file.type.startsWith('image/'))return;const url=URL.createObjectURL(file);const im=new Image();im.onload=()=>{setPhoto(idx,{url,image:im});};im.src=url;});input.value=''; });
function inkFor(hex){const v=hex.replace('#','');const channels=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722>.42?'#29271f':'#fffdf5';}
function useColor(color,name){state.color=color;document.querySelectorAll('.swatch').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-checked','false')});$('colorName').textContent=name;render();}
document.querySelectorAll('.swatch').forEach(btn=>btn.addEventListener('click',()=>{btn.classList.add('selected');btn.setAttribute('aria-checked','true');$('hexInput').value=btn.dataset.color.slice(1).toUpperCase();useColor(btn.dataset.color,btn.dataset.name);}));
const hexInput=$('hexInput');
hexInput.addEventListener('input',()=>{const value=hexInput.value.trim().replace(/^#/,'');if(/^[0-9a-fA-F]{6}$/.test(value)){const color='#'+value.toLowerCase();useColor(color,'직접 입력');}else{$('colorName').textContent='6자리 HEX 코드를 입력하세요';}});
hexInput.addEventListener('blur',()=>{const value=hexInput.value.trim().replace(/^#/,'');if(!/^[0-9a-fA-F]{6}$/.test(value)){hexInput.value=state.color.slice(1).toUpperCase();$('colorName').textContent='직접 입력';}});
$('dateToggle').addEventListener('change',()=>{});
function showMessage(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function showPanel(which){const upload=which==='upload';$('uploadPanel').classList.toggle('hidden',!upload);$('cameraPanel').classList.toggle('hidden',upload);$('uploadTab').classList.toggle('active',upload);$('cameraTab').classList.toggle('active',!upload);$('uploadTab').setAttribute('aria-selected',upload);$('cameraTab').setAttribute('aria-selected',!upload);}
$('uploadTab').onclick=()=>showPanel('upload');$('cameraTab').onclick=()=>showPanel('camera');

async function startCamera(){try{state.camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});$('video').srcObject=state.camera;$('video').classList.remove('hidden');$('cameraPlaceholder').classList.add('hidden');$('captureBtn').disabled=false;$('stopCamera').disabled=false;showMessage('카메라가 준비됐어요. 네 장을 촬영해보세요.');}catch(err){showMessage(err.name==='NotAllowedError'?'카메라 권한을 허용해주세요.':'카메라를 사용할 수 없어요. 파일 업로드를 이용해주세요.');}}
function stopCamera(){if(state.camera){state.camera.getTracks().forEach(t=>t.stop());state.camera=null;}$('video').srcObject=null;$('video').classList.add('hidden');$('cameraPlaceholder').classList.remove('hidden');$('captureBtn').disabled=true;$('stopCamera').disabled=true;}
$('startCamera').onclick=startCamera;$('stopCamera').onclick=stopCamera;
$('captureBtn').onclick=()=>{const idx=state.cameraPhotos.findIndex(p=>!p);if(idx<0){showMessage('네 장을 모두 촬영했어요. 삭제 후 다시 찍을 수 있어요.');return;}const video=$('video'),canvas=$('captureCanvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);canvas.toBlob(blob=>{const url=URL.createObjectURL(blob),image=new Image();image.onload=()=>{state.cameraPhotos[idx]={url,image};state.photos[idx]=state.cameraPhotos[idx];render();renderCameraThumbs();$('shotBadge').textContent=`${idx+1} / 4 촬영 완료`;$('shotBadge').classList.remove('hidden');if(idx===3){$('cameraTip').textContent='네 장 촬영 완료! 필요하면 사진을 다시 찍어보세요.';showMessage('네 장 촬영 완료! 사진을 저장할 수 있어요.');}else $('cameraTip').textContent=`${idx+1}장 촬영 완료 · ${4-idx-1}장 더 찍어주세요`;};image.src=url;},'image/jpeg',.94);};
function renderCameraThumbs(){$('cameraThumbs').innerHTML='';state.cameraPhotos.forEach((p,i)=>{const el=document.createElement('div');el.className='camera-thumb';el.innerHTML=p?`<img src="${p.url}" alt="촬영 사진 ${i+1}"><span>${i+1}</span>`:'';el.title=p?'눌러서 다시 촬영':'';if(p)el.onclick=()=>{state.cameraPhotos[i]=null;state.photos[i]=null;render();renderCameraThumbs();$('cameraTip').textContent=`${state.cameraPhotos.filter(Boolean).length}장 촬영 완료 · 빈 프레임을 다시 촬영하세요`;};$('cameraThumbs').append(el);});}

function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawCrop(ctx,img,x,y,w,h){const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale,sx=(img.width-sw)/2,sy=(img.height-sh)/2;ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
$('downloadBtn').onclick=()=>{if(!state.photos.every(Boolean))return;const c=document.createElement('canvas');c.width=600;c.height=1800;const ctx=c.getContext('2d');ctx.fillStyle=state.color;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=inkFor(state.color);ctx.font='700 34px "DM Sans", sans-serif';ctx.fillText('fourcut',37,61);ctx.fillStyle='#c99813';ctx.font='28px sans-serif';ctx.fillText('✳',527,61);const pad=34,gap=18,top=82,frameH=360;state.photos.forEach((p,i)=>drawCrop(ctx,p.image,pad,top+i*(frameH+gap),c.width-2*pad,frameH));ctx.fillStyle=inkFor(state.color);ctx.font='700 18px "DM Sans", sans-serif';ctx.fillText('GOOD',36,1704);ctx.fillText('THINGS',36,1732);ctx.fillText('HAPPEN',36,1760);if($('dateToggle').checked){ctx.font='500 16px "DM Sans", sans-serif';const m=ctx.measureText(dateText).width;ctx.fillText(dateText,c.width-36-m,1756);}c.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`fourcut-${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.jpg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showMessage('네컷 사진을 기기에 저장했어요.');},'image/jpeg',.95);};
$('resetBtn').onclick=()=>{state.photos.forEach(p=>p&&URL.revokeObjectURL(p.url));state.photos=[null,null,null,null];state.cameraPhotos=[null,null,null,null];render();renderCameraThumbs();$('cameraTip').textContent='촬영한 사진은 아래 프레임에 담겨요';$('shotBadge').classList.add('hidden');showMessage('새로운 네컷 사진을 만들어보세요.');};
render();
