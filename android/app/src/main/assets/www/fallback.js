/*
 * Unified 2D Canvas Engine · 合成大西瓜
 * 一个 Canvas 负责：场景、物理水果、HUD、道具栏、商城、开始页与结算页。
 * 不再为水果施加角速度：水果保持正向，只有 Q 弹缩放动画，彻底消除“灵异转圈”。
 */
(() => {
  'use strict';
  const C = document.querySelector('#app-canvas');
  const X = C.getContext('2d');
  const FRUITS = [
    ['葡萄','grape',.052,1,10], ['樱桃','cherry',.070,2,18], ['橘子','orange',.088,4,30],
    ['柠檬','lemon',.106,8,50], ['猕猴桃','kiwi',.126,16,80], ['番茄','tomato',.150,32,125],
    ['桃子','peach',.176,64,190], ['菠萝','pineapple',.206,128,280], ['椰子','coconut',.240,256,400],
    ['半西瓜','halfmelon',.278,512,580], ['大西瓜','watermelon',.320,1024,820]
  ].map(([name,img,r,score,price], level) => ({name,img,r,score,price,level}));
  const I = {};
  FRUITS.forEach(f => { const i=new Image(); i.src=`assets/${f.img}.png`; I[f.img]=i; });

  // 某些 App 内嵌 WebView 可能关闭 DOM Storage；存档失败绝不能阻断游戏启动。
  const store={
    get(key,fallback=0){try{return +(localStorage.getItem(key)||fallback);}catch(_){return fallback;}},
    set(key,value){try{localStorage.setItem(key,String(value));}catch(_){/* 无痕/受限 WebView：仅本次会话保留 */}}
  };
  let W=0,H=0,D=1, stage={x:10,y:116,w:0,h:0}, bodies=[], particles=[], waves=[], buttons=[];
  let screen='start', running=false, score=0, coins=store.get('suika_coins'), best=store.get('suika_best_v3');
  let earned=0, current=0, next=0, aimX=0, canDrop=true, danger=0, hammer=false, combo=0, lastMerge=0, shake=0, pointerDown=false, last=performance.now();
  const ui={ font:'system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif' };

  function resize(){
    D=Math.min(devicePixelRatio||1,3); W=innerWidth; H=innerHeight; C.width=W*D; C.height=H*D; X.setTransform(D,0,0,D,0,0); X.imageSmoothingEnabled=true; X.imageSmoothingQuality='high';
    // 预留道具栏(46px)、图鉴(39px)及间距，避免矮屏幕下 HUD / 道具栏互相覆盖。
    const top=116, toolBar=46, evolution=39, safeGap=14;
    stage={x:10,y:top,w:W-20,h:Math.max(100,H-top-toolBar-evolution-safeGap)}; aimX=W/2;
    bodies.forEach(b=>{b.r=radius(b.level);b.x=Math.max(stage.x+b.r,Math.min(stage.x+stage.w-b.r,b.x));});
  }
  function radius(l){ return FRUITS[l].r*stage.w*.5; }
  function rand(){ const a=[32,28,20,12,8]; let q=Math.random()*100; for(let i=0;i<a.length;i++){q-=a[i];if(q<0)return i;}return 0; }
  function body(l,x,y,merge=false){ return {level:l,x,y,r:radius(l),vx:0,vy:0,sx:merge?1.12:.96,sy:merge?.90:1.04,vsx:0,vsy:0,born:performance.now()}; }
  function reset(){ bodies=[];particles=[];waves=[];score=0;earned=0;combo=0;danger=0;hammer=false;current=rand();next=rand();aimX=W/2;canDrop=true;running=true;screen='game'; }
  function saveCoins(){store.set('suika_coins',coins);}
  function addCoins(n,x,y){ coins+=n;earned+=n;saveCoins(); floatText(x,y,`+${n} 💰`,'#f39c12'); }

  // ------- 物理：稳定、自然的无旋转软碰撞模型 -------
  function physics(dt){
    const gravity=2050*(stage.w/460), floor=stage.y+stage.h;
    const bodyCount=bodies.length;

    // 积分、边界和果冻回弹。缩放范围被限制，眼睛不会再被夸张拉扯。
    for(let i=0;i<bodyCount;i++){
      const b=bodies[i];
      b.vy+=gravity*dt;
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      b.vx*=0.997;
      b.vsx+=(-120*(b.sx-1)-18*b.vsx)*dt;
      b.vsy+=(-120*(b.sy-1)-18*b.vsy)*dt;
      b.sx=Math.max(.93,Math.min(1.10,b.sx+b.vsx*dt));
      b.sy=Math.max(.93,Math.min(1.10,b.sy+b.vsy*dt));

      if(b.x-b.r<stage.x){ b.x=stage.x+b.r; b.vx=Math.abs(b.vx)*.26; b.sx=.96; b.sy=1.04; }
      else if(b.x+b.r>stage.x+stage.w){ b.x=stage.x+stage.w-b.r; b.vx=-Math.abs(b.vx)*.26; b.sx=.96; b.sy=1.04; }
      if(b.y+b.r>floor){
        b.y=floor-b.r;
        if(Math.abs(b.vy)>62){ b.vy=-b.vy*.28; b.sx=1.075; b.sy=.94; }
        else b.vy=0;
        b.vx*=.95;
        if(Math.abs(b.vx)<2) b.vx=0;
      }
    }

    let merging=null;
    // O(n²) 对当前游戏最大物体数（约 35）比空间哈希更快，且零分配、缓存友好。
    for(let i=0;i<bodyCount;i++){
      const a=bodies[i];
      for(let j=i+1;j<bodyCount;j++){
        const b=bodies[j], dx=b.x-a.x, dy=b.y-a.y;
        const distance=Math.hypot(dx,dy)||.001, target=a.r+b.r;
        if(distance>=target) continue;
        if(a.level===b.level && !merging && a.level<FRUITS.length-1) merging=[a,b];

        const nx=dx/distance, ny=dy/distance;
        // 留出极小的软接触余量：不突兀弹开，也不会持续交叠抖动。
        const penetration=Math.max(0,target-distance-.65);
        const ma=a.r*a.r, mb=b.r*b.r, invMass=1/ma+1/mb;
        a.x-=nx*penetration*(mb/(ma+mb)); a.y-=ny*penetration*(mb/(ma+mb));
        b.x+=nx*penetration*(ma/(ma+mb)); b.y+=ny*penetration*(ma/(ma+mb));

        const relativeNormal=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(relativeNormal<0){
          // 高速碰撞才有明显弹性，低速堆叠自然贴合，避免“硬塑料撞击”。
          const restitution=Math.abs(relativeNormal)>100?.34:.07;
          const impulse=-(1+restitution)*relativeNormal/invMass;
          a.vx-=impulse*nx/ma; a.vy-=impulse*ny/ma;
          b.vx+=impulse*nx/mb; b.vy+=impulse*ny/mb;
          if(Math.abs(relativeNormal)>55){ a.sx=b.sx=1.045; a.sy=b.sy=.96; }
        }
      }
    }
    if(merging) merge(merging[0],merging[1]);
  }
  function merge(a,b){
    bodies=bodies.filter(v=>v!==a&&v!==b);const l=a.level+1,x=(a.x+b.x)/2,y=(a.y+b.y)/2,n=body(l,x,y,true);n.vy=-90;bodies.push(n);
    const now=performance.now();combo=now-lastMerge<1500?combo+1:1;lastMerge=now;
    const gain=FRUITS[l].score*(combo>1?combo:1);score+=gain;if(score>best){best=score;store.set('suika_best_v3',best);}
    const coinGain=Math.max(1,Math.ceil(FRUITS[l].score/16))+(combo>1?combo-1:0);addCoins(coinGain,x,y-20);floatText(x,y-n.r,combo>1?`+${gain}  COMBO×${combo}`:`+${gain}`,'#ff4b1f');burst(x,y,l);waves.push({x,y,r:n.r*.45,max:n.r*2.3,a:.8});shake=Math.min(9,shake+2+l*.5);
  }
  function drop(){if(!canDrop||!running)return;const r=radius(current),x=Math.max(stage.x+r,Math.min(stage.x+stage.w-r,aimX));bodies.push(body(current,x,stage.y+r+4));current=next;next=rand();canDrop=false;setTimeout(()=>canDrop=true,340);}
  function burst(x,y,l){
    // 三层特效：果汁圆粒 + 菱形彩纸 + 闪亮星星
    const colors=['#ff7b54','#ffd166','#73d2de','#ff99c8','#9ef01a','#ffffff'];
    for(let k=0;k<16+l*3;k++){const a=Math.random()*6.283,s=75+Math.random()*205;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-75,life:1,c:colors[k%colors.length],z:3+Math.random()*5,type:k%3===0?'diamond':'dot',spin:(Math.random()-.5)*12});}
    for(let k=0;k<3+Math.floor(l/3);k++){const a=Math.random()*6.283, d=12+Math.random()*22;particles.push({x:x+Math.cos(a)*d,y:y+Math.sin(a)*d,vx:Math.cos(a)*45,vy:Math.sin(a)*45-35,life:.85,c:'#fff8bd',z:7+Math.random()*4,type:'star'});}
  }
  function floatText(x,y,t,c){particles.push({text:t,x,y,vy:-48,life:1.2,c,z:0});}
  function hitHammer(x,y){ let target=null,d=1e9; for(const b of bodies){const v=Math.hypot(x-b.x,y-b.y);if(v<b.r&&v<d){target=b;d=v;}}if(target){bodies=bodies.filter(b=>b!==target);burst(target.x,target.y,target.level);waves.push({x:target.x,y:target.y,r:8,max:target.r*2,a:.9});hammer=false;return true;}return false; }
  function doShake(){for(const b of bodies){b.vx+=(Math.random()-.5)*330;b.vy-=80+Math.random()*110;}shake=10;}
  function checkLose(dt){const line=stage.y+stage.h*.17, now=performance.now();let bad=false;for(const b of bodies)if(now-b.born>850&&b.y-b.r<line&&Math.abs(b.vy)<50){bad=true;break;} danger=bad?danger+dt*1000:0;if(danger>1200){running=false;screen='over';}}

  // ------- Canvas UI -------
  function roundedPath(x,y,w,h,r){
    // CanvasRenderingContext2D.roundRect 在部分旧版 Android WebView / Safari 不可用；手动路径确保开始页可点击。
    r=Math.max(0,Math.min(r,w/2,h/2));
    X.beginPath();X.moveTo(x+r,y);X.lineTo(x+w-r,y);X.quadraticCurveTo(x+w,y,x+w,y+r);
    X.lineTo(x+w,y+h-r);X.quadraticCurveTo(x+w,y+h,x+w-r,y+h);X.lineTo(x+r,y+h);
    X.quadraticCurveTo(x,y+h,x,y+h-r);X.lineTo(x,y+r);X.quadraticCurveTo(x,y,x+r,y);X.closePath();
  }
  function rr(x,y,w,h,r,fill,stroke){roundedPath(x,y,w,h,r);if(fill){X.fillStyle=fill;X.fill();}if(stroke){X.strokeStyle=stroke;X.lineWidth=1;X.stroke();}}
  function text(s,x,y,size,color,align='left',weight=700){X.font=`${weight} ${size}px ${ui.font}`;X.fillStyle=color;X.textAlign=align;X.textBaseline='middle';X.fillText(s,x,y);}
  function image(im,x,y,w,h){if(im?.complete)X.drawImage(im,x,y,w,h);}
  function button(id,x,y,w,h,label,fn,kind='normal') { buttons.push({id,x,y,w,h,fn}); const bg=kind==='gold'?'#ffb52e':kind==='danger'?'#ff745f':'rgba(255,255,255,.84)';rr(x,y,w,h,h/2,bg,kind==='gold'?'#db8800':'rgba(213,130,30,.4)');text(label,x+w/2,y+h/2,Math.min(14,h*.45),kind==='gold'?'#773900':'#7b4311','center',800); }
  function drawBackground(){
    const g=X.createLinearGradient(0,0,0,H);g.addColorStop(0,'#fff0bd');g.addColorStop(.52,'#ffd978');g.addColorStop(1,'#ffc05d');X.fillStyle=g;X.fillRect(0,0,W,H);
    const halo=X.createRadialGradient(W*.5,H*.18,5,W*.5,H*.18,W*.65);halo.addColorStop(0,'rgba(255,255,255,.52)');halo.addColorStop(1,'rgba(255,255,255,0)');X.fillStyle=halo;X.fillRect(0,0,W,H);
    for(let x=20;x<W;x+=68)for(let y=12;y<H;y+=68){X.fillStyle='rgba(255,255,255,.16)';X.beginPath();X.arc(x+(y/68%2)*16,y,7,0,6.28);X.fill();}
  }
  function drawHud(){
    const gap=6, bw=(W-28)/3;[['得分',String(score),'#d94a14'],['💰 金币',String(coins),'#c77c00'],['最高',String(best),'#d94a14']].forEach((a,i)=>{const x=10+i*(bw+gap);rr(x,9,bw,47,12,'rgba(255,255,255,.76)','rgba(231,163,54,.55)');text(a[0],x+bw/2,24,10,'#9e5b1a','center');text(a[1],x+bw/2,42,19,a[2],'center',900);});
    rr(10,65,100,38,18,'rgba(255,255,255,.75)','rgba(231,163,54,.5)');text('下一个',20,84,11,'#875014');image(I[FRUITS[next].img],76,69,30,30);
    if(combo>1&&performance.now()-lastMerge<1500){rr(W/2-45,73,90,23,12,'#ff5e4d');text(`COMBO × ${combo}`,W/2,84,11,'#fff','center',900);}
    button('shop',W-116,66,73,34,'🛒 商店',()=>screen='shop','gold');button('sound',W-38,66,28,34,'🔔',()=>{},'normal');
  }
  function drawStage(){
    const {x,y,w,h}=stage;rr(x,y,w,h,20,'rgba(255,255,255,.22)','rgba(197,125,32,.75)');
    const ly=y+h*.17;X.save();X.setLineDash([6,6]);X.strokeStyle=danger?'#ff304f':'rgba(220,65,60,.62)';X.lineWidth=2;X.beginPath();X.moveTo(x,ly);X.lineTo(x+w,ly);X.stroke();X.restore();text('警戒线',x+w-8,ly-8,9,'#e13b38','right');
    X.save();roundedPath(x,y,w,h,20);X.clip();if(shake){X.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);}
    if(running&&canDrop){const r=radius(current),px=Math.max(x+r,Math.min(x+w-r,aimX));X.save();X.setLineDash([5,7]);X.strokeStyle='rgba(255,255,255,.75)';X.beginPath();X.moveTo(px,y+r*2+5);X.lineTo(px,y+h);X.stroke();X.restore();drawFruit(current,px,y+r+5,r,1,1);}
    bodies.forEach(b=>drawFruit(b.level,b.x,b.y,b.r,b.sx,b.sy));
    waves.forEach(v=>{X.strokeStyle=`rgba(255,255,255,${v.a})`;X.lineWidth=3;X.beginPath();X.arc(v.x,v.y,v.r,0,6.28);X.stroke();});
    particles.forEach(p=>{X.globalAlpha=Math.max(0,p.life);if(p.text)text(p.text,p.x,p.y,15,p.c,'center',900);else if(p.type==='star'){X.fillStyle=p.c;X.beginPath();for(let q=0;q<10;q++){const a=-Math.PI/2+q*Math.PI/5, r=q%2?p.z*.42:p.z;const px=p.x+Math.cos(a)*r,py=p.y+Math.sin(a)*r;q?X.lineTo(px,py):X.moveTo(px,py);}X.closePath();X.fill();}else if(p.type==='diamond'){X.save();X.translate(p.x,p.y);X.rotate((p.spin||0)*(1-p.life));X.fillStyle=p.c;X.fillRect(-p.z/2,-p.z/2,p.z,p.z);X.restore();}else{X.fillStyle=p.c;X.beginPath();X.arc(p.x,p.y,p.z*p.life,0,6.28);X.fill();}X.globalAlpha=1;});
    X.restore();
    if(hammer){rr(W/2-115,y+10,230,30,15,'#f95f50');text('🔨 消除模式：点击场上任意水果',W/2,y+25,13,'#fff','center',900);}
  }
  function drawFruit(l,x,y,r,sx=1,sy=1){X.save();X.translate(x,y);X.scale(sx,sy);image(I[FRUITS[l].img],-r,-r,r*2,r*2);X.restore();}
  function drawBottom(){
    const y=stage.y+stage.h+8,h=38, gap=6,w=(W-20-gap*2)/3;
    button('hammer',10,y,w,h,'🔨 碎果锤 50',()=>buyProp('hammer',50),'normal');
    button('shake',10+w+gap,y,w,h,'📳 摇一摇 30',()=>buyProp('shake',30),'normal');
    button('quickshop',10+(w+gap)*2,y,w,h,'🍉 买水果',()=>screen='shop','gold');
  }
  function drawEvolution(){const y=H-19;X.fillStyle='rgba(255,255,255,.48)';X.fillRect(0,H-39,W,39);const step=(W-18)/11;FRUITS.forEach((f,i)=>{image(I[f.img],9+i*step,y-10,20,20);});}
  function drawModal(title,lines,primary){X.fillStyle='rgba(45,20,5,.56)';X.fillRect(0,0,W,H);const w=Math.min(360,W-32),h=title==='🛒 水果商店'?Math.min(560,H-40):260,x=(W-w)/2,y=(H-h)/2;rr(x,y,w,h,24,'#fff9ea','#f4a33d');text(title,x+w/2,y+30,22,'#bd4617','center',900);return {x,y,w,h,primary};}
  function drawStart(){const m=drawModal('🍉 合成大西瓜',[],null);text('滑动瞄准，松手掉落水果',W/2,m.y+80,14,'#754719','center');text('相同水果碰撞即可合成升级！',W/2,m.y+108,14,'#754719','center');text('💰 合成赚金币，购买指定水果和道具',W/2,m.y+136,13,'#a15a17','center',800);button('start',W/2-90,m.y+175,180,48,'开始游戏',reset,'gold');}
  function drawOver(){const m=drawModal('🍉 游戏结束',[],null);text(`本局得分  ${score}`,W/2,m.y+82,18,'#d94a14','center',900);text(`本局金币  +${earned} 💰`,W/2,m.y+112,15,'#c77c00','center',800);text(`历史最高  ${best}`,W/2,m.y+140,14,'#875014','center');button('restart',W/2-90,m.y+178,180,47,'再来一局',reset,'gold');}
  function drawShop(){const m=drawModal('🛒 水果商店',[],null);button('close',m.x+m.w-38,m.y+10,28,27,'×',()=>screen='game');text(`当前金币：${coins} 💰`,m.x+18,m.y+65,14,'#a46113','left',900);text('购买后替换当前待投放水果',m.x+18,m.y+87,11,'#805322','left');
    const cols=3,gap=9,pad=16,cw=(m.w-pad*2-gap*2)/cols,ch=78,startY=m.y+100;
    FRUITS.forEach((f,i)=>{const col=i%cols,row=(i/cols)|0,x=m.x+pad+col*(cw+gap),y=startY+row*(ch+gap);const ok=coins>=f.price;buttons.push({id:'fruit'+i,x,y,w:cw,h:ch,fn:()=>buyFruit(i)});rr(x,y,cw,ch,13,ok?'#fff':'#eee',ok?'#f2b24b':'#c6c6c6');image(I[f.img],x+cw/2-20,y+5,40,40);text(f.name,x+cw/2,y+51,11,'#744514','center',800);rr(x+8,y+60,cw-16,14,7,ok?'#ffad2f':'#aaa');text(`💰 ${f.price}`,x+cw/2,y+67,9,ok?'#703800':'#eee','center',900);});
  }
  function buyFruit(l){const f=FRUITS[l];if(coins<f.price)return;coins-=f.price;saveCoins();current=l;screen='game';}
  function buyProp(type,cost){if(!running||coins<cost)return;coins-=cost;saveCoins();if(type==='hammer'){hammer=!hammer;}else doShake();}
  function render(){buttons=[];drawBackground();if(screen==='game'){drawHud();drawStage();drawBottom();drawEvolution();}else if(screen==='start')drawStart();else if(screen==='over')drawOver();else if(screen==='shop'){drawHud();drawStage();drawBottom();drawEvolution();drawShop();}}
  function update(dt){if(running&&screen==='game'){
      // 常规 4 子步，只有高速下落时升到 6 子步：保持自然碰撞的同时降低移动端 CPU 占用。
      let fastest=0; for(let i=0;i<bodies.length;i++) fastest=Math.max(fastest,Math.abs(bodies[i].vy));
      const steps=fastest>800?6:4;
      for(let i=0;i<steps;i++) physics(dt/steps);
      checkLose(dt);
    }particles.forEach(p=>{p.y+=(p.vy||0)*dt;if(!p.text){p.x+=p.vx*dt;p.vy+=900*dt;}if(p.spin)p.spin*=.985;p.life-=dt*(p.text?.85:1.55);});particles=particles.filter(p=>p.life>0);waves.forEach(w=>{w.r+=(w.max-w.r)*dt*9;w.a-=dt*2.5;});waves=waves.filter(w=>w.a>0);shake=Math.max(0,shake-dt*28);}
  function loop(t){const dt=Math.min(.033,(t-last)/1000);last=t;update(dt);render();requestAnimationFrame(loop);}

  function point(e){const r=C.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  C.addEventListener('pointerdown',e=>{pointerDown=true;const p=point(e);aimX=p.x;try{C.setPointerCapture(e.pointerId);}catch(_){}});
  C.addEventListener('pointercancel',()=>{pointerDown=false;});
  C.addEventListener('lostpointercapture',()=>{pointerDown=false;});
  C.addEventListener('pointermove',e=>{if(pointerDown||e.pointerType==='mouse')aimX=point(e).x;});
  C.addEventListener('pointerup',e=>{const p=point(e);pointerDown=false;const hit=buttons.find(b=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h);if(hit){hit.fn();return;}if(screen==='game'){if(hammer){hitHammer(p.x,p.y);}else if(p.x>=stage.x&&p.x<=stage.x+stage.w&&p.y>=stage.y&&p.y<=stage.y+stage.h)drop();}});
  C.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('resize',resize);document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
  resize();requestAnimationFrame(loop);
})();
