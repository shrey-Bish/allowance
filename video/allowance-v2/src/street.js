// Pixel street: sprites, shops and draw() lifted from design/stage.js (the same art the app's Agent Cam uses).
var PAL={k:'#1C1B19',c:'#FFFDF8',p:'#F6F1E7',l:'#E6DFD1',m:'#B8AE9C',o:'#D0702C',O:'#A5521C',w:'#FFF4E2',g:'#E2AE2A',G:'#A97B0F',n:'#F2ADA7',N:'#D27E79',b:'#4C6A66',B:'#2F4542',r:'#D2483C',s:'#EFE5D0',q:'#E4ECE6'};
var PX="'Pixelify Sans', monospace";
var SCOUT=[
"................",
".kk......kk.....",
".kok....kok.....",
".kookkkkook.....",
".kooooooook.....",
".kokooookok.....",
".kwwoooowwk.....",
"..kwwkkwwk......",
"...kwwwwk.......",
".kbkoowok..kk...",
"kbbkowwok.kook..",
"kbbkowwokkoook..",
"kbbkoooooooowk..",
".kkkoooooookkk..",
"...kok..kok.....",
"...kk...kk......"];
var PENNY=[
"..kk........kk..",
".knnk......knnk.",
".knnkkkkkkkknnk.",
"knnnnnnkknnnnnnk",
"knnnnnnnnnnnnnnk",
"knnknnnnnnnnknnk",
"knnnnNNNNNNnnnnk",
"knnnnNkNNkNnnnnk",
"knnnnNNNNNNnnnnk",
"knnnnnnnnnnnnnnk",
"kggnkkkkkkkknnnk",
"kGGnkzzzzzzknnnk",
"knnnkzzzzzzknnnk",
"knnnkzzzzzzknnnk",
"knnnkzzzzzzknnnk",
"knnnkkkkkkkknnnk",
".knnnnnnnnnnnnk.",
"..kNNk....kNNk..",
"..kkkk....kkkk.."];
var COIN=[".kkk.","kgggk","kgGgk","kgggk",".kkk."];
var PHONES=[".kkkkk.","k.....k","k.....k","kgk.kgk","kgk.kgk","kkk.kkk"];
var BAG=[".kkk.",".k.k.","kgggk","kgggk","kkkkk"];
var PACK=["kkkkkk","kbbbbk","kbggbk","kbbbbk","kkkkkk"];
var JAR=[".kkkkkkkkkk.",".kmmmmmmmmk.","..kkkkkkkk..",".kqqqqqqqqk.","kqwqqqqqqqqk","kqwqqqqqqqqk","kqqqqggqqqqk","kqqqgGGgqqqk","kqggqggqggqk","kgGGgGGgGGgk",".kkkkkkkkkk."];
function setR(rows,m){var r=rows.slice();for(var k in m)r[+k]=m[k];return r;}
function over(rows,spr,x,y){var r=rows.map(function(s){return s.split('');});spr.forEach(function(line,j){for(var i=0;i<line.length;i++){var c=line[i];if(c!=='.'&&r[y+j]&&x+i<r[y+j].length)r[y+j][x+i]=c;}});return r.map(function(a){return a.join('');});}
function flip(rows){return rows.map(function(s){return s.split('').reverse().join('');});}
function belly(rows,f){f=parseFloat(f);if(isNaN(f))f=0.7;var n=Math.round(Math.max(0,Math.min(1,f))*24),idx=0;var r=rows.map(function(s){return s.split('');});for(var y=14;y>=11;y--)for(var x=5;x<=10;x++){r[y][x]=idx<n?((x+y)%3===0?'G':'g'):'w';idx++;}return r.map(function(a){return a.join('');});}
var WA={14:"..kok....kok....",15:"..kk......kk...."},WB={14:"....kok.kok.....",15:"....kk..kk......"};
var PLEAD={4:".kowoooowok....."},TAP={15:"...kk....kk....."};
var BACKH={4:".kooooooook.....",5:".kooooooook.....",6:".kooooooook.....",7:"..kooooook......",8:"...kkkkkk......."};
var S={
'scout':SCOUT,'scout-walk-a':setR(SCOUT,WA),'scout-walk-b':setR(SCOUT,WB),
'scout-bag':over(SCOUT,BAG,10,10),'scout-bag-a':over(setR(SCOUT,WA),BAG,10,10),'scout-bag-b':over(setR(SCOUT,WB),BAG,10,10),
'scout-back':flip(over(setR(SCOUT,BACKH),PACK,2,9)),
'scout-plead':over(setR(SCOUT,PLEAD),PHONES,3,9),'scout-plead-tap':over(setR(SCOUT,Object.assign({},PLEAD,TAP)),PHONES,3,9),
'scout-sleep':setR(SCOUT,{5:".kOOooooOOk....."}),
'scout-wait':setR(SCOUT,TAP),
'scout-shrug':over(over(setR(SCOUT,{5:".kOkooookOk....."}),["ko","kk"],0,6),["ok","kk"],10,6),
'penny':PENNY,'penny-stern':setR(PENNY,{4:"knkknnnnnnnnkknk"}),
'coin':COIN,'jar':JAR,'bag':BAG,'phones':PHONES};
function get(name,fill){var r=S[name]||SCOUT;if(name.indexOf('penny')===0)r=belly(r,fill==null?0.7:fill);return r;}
function blit(ctx,rows,x,y,s,a){s=s||1;x=Math.round(x);y=Math.round(y);if(a!=null)ctx.globalAlpha=a;for(var j=0;j<rows.length;j++){var line=rows[j];for(var i=0;i<line.length;i++){var c=line[i];if(c==='.')continue;ctx.fillStyle=PAL[c];ctx.fillRect(x+i*s,y+j*s,s,s);}}ctx.globalAlpha=1;}
function rect(ctx,c,x,y,w,hh,a){ctx.fillStyle=PAL[c]||c;if(a!=null)ctx.globalAlpha=a;ctx.fillRect(Math.round(x),Math.round(y),w,hh);ctx.globalAlpha=1;}
var SHOPS=[
{x:8,name:'FreshCart',wall:'c',aw:['g','c'],sign:'k',ink:'#FFFDF8',fs:3.2,door:'b',goods:['o','g','n']},
{x:70,name:'VoltHub',wall:'l',aw:['b','c'],sign:'k',ink:'#FFFDF8',fs:3.2,door:'B',goods:['k','m','b']},
{x:132,name:'MegaDealz247',wall:'n',aw:['r','g'],sign:'g',ink:'#1C1B19',fs:2.25,door:'N',goods:['r','g','r']}];
var GY=86,SY=36,SW=52,SH=50;
function cl(u){return Math.max(0,Math.min(1,u));}
function lp(a,b,u){return a+(b-a)*cl(u);}
function wk(t){return Math.floor(t/0.16)%2?'a':'b';}
function mmss(s){return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function drawShop(ctx,s,i,st,t){
  var x=s.x,y=SY,w=SW;
  rect(ctx,'k',x-2,y-4,w+4,4);rect(ctx,'m',x-1,y-3,w+2,1);
  rect(ctx,'k',x-1,y,w+2,SH);rect(ctx,s.wall,x,y,w,SH);
  rect(ctx,'k',x+4,y+2,w-8,9);rect(ctx,s.sign,x+5,y+3,w-10,7);
  for(var j=0;j<w+2;j+=4){var c=s.aw[(j/4)%2];rect(ctx,c,x-1+j,y+13,4,5);if((j/4)%2===0)rect(ctx,c,x-1+j,y+18,4,1);}
  rect(ctx,'k',x-1,y+12,w+2,1);
  [x+4,x+36].forEach(function(wx,wi){rect(ctx,'k',wx-1,y+23,14,13);rect(ctx,'q',wx,y+24,12,11);rect(ctx,'w',wx+1,y+25,1,4);rect(ctx,'m',wx,y+32,12,1);
    for(var g=0;g<3;g++)rect(ctx,s.goods[(g+wi)%3],wx+2+g*4,y+29,3,3);});
  var sh=(st.shopShake===i?st.shake:0)||0,dx=x+21+sh,dy=y+30;
  rect(ctx,'k',dx-1,dy-1,12,21);
  if(st.doorOpen&&st.doorShop===i){rect(ctx,'k',dx,dy,10,20);rect(ctx,'B',dx+1,dy+1,3,19);}
  else{rect(ctx,s.door,dx,dy,10,20);rect(ctx,'k',dx+2,dy+3,6,1);rect(ctx,'g',dx+7,dy+10,2,2);}
  if(i===2&&Math.floor(t*3)%2){[[x-3,y-7],[x+w+1,y-7],[x+24,y-7]].forEach(function(p){rect(ctx,'g',p[0]+1,p[1],1,3);rect(ctx,'g',p[0],p[1]+1,3,1);});}
}
function draw(ctx,st,t){
  rect(ctx,'s',0,0,192,108);
  [[18,12,16,3],[22,9,8,3],[118,16,18,3],[124,13,9,3],[170,8,12,2]].forEach(function(c){rect(ctx,'c',c[0],c[1],c[2],c[3]);});
  rect(ctx,'l',0,GY,192,11);rect(ctx,'m',0,GY,192,1);rect(ctx,'m',0,GY+11,192,11);
  for(var x=0;x<192;x+=14)rect(ctx,'l',x+2,GY+16,7,1);
  for(var x2=6;x2<192;x2+=10)rect(ctx,'m',x2,GY+5,1,1);
  SHOPS.forEach(function(s,i){drawShop(ctx,s,i,st,t);});
  if(st.xray>0){var s=SHOPS[2],band=SY+st.xray*SH;rect(ctx,'k',s.x,SY,SW,band-SY,0.62);if(st.xray<1)rect(ctx,'c',s.x-1,band,SW+2,1);}
  if(st.penny)blit(ctx,get(st.penny.pose,st.fill),st.penny.x,GY-19);
  if(st.jar){var pop=st.jar.pop,bob=Math.round(Math.sin(t*3));blit(ctx,JAR,st.penny.x+2,GY-19-12-1+bob+Math.round((1-pop)*4),1,pop);}
  st.coins.forEach(function(c){blit(ctx,COIN,c.x,c.y);});
  if(st.scout)blit(ctx,get(st.scout.pose),st.scout.x,GY-16);
}
