const root=document.createElement('div');
root.id='conversionOptionsCompatRoot';
root.style.display='none';
document.body.appendChild(root);

function select(id,values,def){
  let n=document.getElementById(id);
  if(n)return n;
  n=document.createElement('select');
  n.id=id;
  values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;n.appendChild(o);});
  n.value=def;
  root.appendChild(n);
  return n;
}

function checkbox(id,def){
  let n=document.getElementById(id);
  if(n)return n;
  n=document.createElement('input');
  n.type='checkbox';
  n.id=id;
  n.checked=!!def;
  root.appendChild(n);
  return n;
}

function text(id){
  let n=document.getElementById(id);
  if(n)return n;
  n=document.createElement('textarea');
  n.id=id;
  root.appendChild(n);
  return n;
}

const supportMode=select('supportMode',['compare','inputxml-actual','isonote-expected','none'],'compare');
select('singleAxisDecision',['warning','+','-'],'warning');
checkbox('nodeLabels',true);
checkbox('isonoteBoards',true);
checkbox('supportLabels',false);
checkbox('componentText',false);
checkbox('compareColors',true);
checkbox('compactMode',true);
text('isonoteText');
text('lineNoText');

function isChecked(id,def){
  const n=document.getElementById(id);
  return n?!!n.checked:!!def;
}

function syncSupportMode(){
  const actual=isChecked('renderActualSupport',true);
  const expected=isChecked('renderExpectedSupport',true);
  supportMode.value=actual&&expected?'compare':actual?'inputxml-actual':expected?'isonote-expected':'none';
  const show=document.getElementById('showSupportLabel');
  const legacy=document.getElementById('supportLabels');
  if(show&&legacy&&show!==legacy)legacy.checked=!!show.checked;
}

['renderActualSupport','renderExpectedSupport','showSupportLabel','supportLabels'].forEach(id=>document.getElementById(id)?.addEventListener('change',syncSupportMode));
syncSupportMode();
window.__3D_MARKUP_CONVERSION_OPTIONS_COMPAT__={installed:true,supportMode:supportMode.value};
