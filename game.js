/* Unified WebGL Game Engine: PixiJS 7 (renderer/UI) + Matter.js 0.20 (physics).
 * Android WebView 优先走 WebGL；所有 UI 与特效为 Pixi DisplayObject，无 DOM 游戏界面。
 */
(() => {
'use strict';
const {Engine, World, Bodies, Body, Events, Composite} = Matter;
const F=[['葡萄','grape',.052,1,10],['樱桃','cherry',.070,2,18],['橘子','orange',.088,4,30],['柠檬','lemon',.106,8,50],['猕猴桃','kiwi',.126,16,80],['番茄','tomato',.150,32,125],['桃子','peach',.176,64,190],['菠萝','pineapple',.206,128,280],['椰子','coconut',.240,256,400],['半西瓜','halfmelon',.278,512,580],['大西瓜','watermelon',.320,1024,820]].map(([n,img,r,score,price],level)=>({n,img,r,score,price,level}));
const A=new PIXI.Application({view:document.querySelector('#app-canvas'),resizeTo:window,backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio||1,2),powerPreference:'high-performance'});
A.renderer.events.autoPreventDefault=true;
// GPU 上下文被系统回收（后台恢复、驱动重置）时，自动降级到 Canvas 而不是显示空白画面。
A.view.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  if (window.__startCanvasFallback) window.__startCanvasFallback('WebGL context lost');
}, false);
const E=Engine.create({gravity:{x:0,y:1,scale:.00105},enableSleeping:true}), ballByBody=new Map(), root=new PIXI.Container(), scene=new PIXI.Container(), ui=new PIXI.Container(), fx=new PIXI.Container();
A.stage.addChild(root);root.addChild(scene,fx,ui);
const store={get(k,d=0){try{return +(localStorage.getItem(k)||d)}catch(_){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(_){}}};
let W=0,H=0, basket, balls=[], wall=[], score=0,coins=store.get('suika_coins'),best=store.get('suika_best_v4'),earned=0,current=0,next=0,running=false,mode='start',hammer=false,danger=0,lastMerge=0,combo=0,dropReady=true;
const texture={};F.forEach(f=>texture[f.img]=PIXI.Texture.from(`assets/${f.img}.png`));
function R(l){return F[l].r*basket.w*.5} function rnd(){let w=[32,28,20,12,8],r=Math.random()*100;for(let i=0;i<w.length;i++)if((r-=w[i])<0)return i;return 0}
function txt(s,size=14,color=0x734012){return new PIXI.Text(s,{fontFamily:'Arial,"PingFang SC",sans-serif',fontSize:size,fontWeight:'700',fill:color,align:'center'})}
function box(x,y,w,h,c=0xffffff,a=.78,r=14){let g=new PIXI.Graphics();g.lineStyle(1.4,0xe3a543,.62);g.beginFill(c,a);g.drawRoundedRect(x,y,w,h,r);g.endFill();return g}
function addButton(label,x,y,w,h,action,gold=false){let c=new PIXI.Container();c.addChild(box(0,0,w,h,gold?0xffb52e:0xffffff,gold?1:.82));let t=txt(label,Math.min(14,h*.42),gold?0x743600:0x754314);t.anchor.set(.5);t.position.set(w/2,h/2);c.addChild(t);c.position.set(x,y);c.eventMode='static';c.cursor='pointer';c.on('pointertap',ev=>{ev.stopPropagation();action();});c.on('pointerdown',ev=>{ev.stopPropagation();c.scale.set(.94);});c.on('pointerup',()=>c.scale.set(1));ui.addChild(c);return c}
function clear(c){c.removeChildren().forEach(v=>v.destroy({children:true}))}
function layout(){W=A.renderer.screen.width; H=A.renderer.screen.height;basket={x:10,y:112,w:W-20,h:Math.max(120,H-112-106)};buildWalls();renderUI();}
function buildWalls(){World.remove(E.world,wall); const x=basket.x,y=basket.y,w=basket.w,h=basket.h,T=60;
 wall=[Bodies.rectangle(x-T/2,y+h/2,T,h,{isStatic:true}),Bodies.rectangle(x+w+T/2,y+h/2,T,h,{isStatic:true}),Bodies.rectangle(x+w/2,y+h+T/2,w+T,T,{isStatic:true})];World.add(E.world,wall);
 for(const b of balls){const r=R(b.level);b.r=r;Body.scale(b.body,r/b.lastR,r/b.lastR);b.lastR=r;Body.setPosition(b.body,{x:Math.max(x+r,Math.min(x+w-r,b.body.position.x)),y:Math.min(y+h-r,b.body.position.y)});}}
function newBall(level,x,y,merged=false){let r=R(level), body=Bodies.circle(x,y,r,{restitution:.42,friction:.12,frictionAir:.012,inertia:Infinity,sleepThreshold:35,slop:.15,label:`fruit:${level}`});let sprite=new PIXI.Sprite(texture[F[level].img]);sprite.anchor.set(.5);sprite.width=sprite.height=r*2;scene.addChild(sprite);let b={level,body,sprite,r,lastR:r,born:performance.now(),pulse:merged?.45:.14};balls.push(b);ballByBody.set(body,b);World.add(E.world,body);return b}
function reset(){ballByBody.clear();for(const b of balls){World.remove(E.world,b.body);b.sprite.destroy()}balls=[];clear(scene);clear(fx);score=earned=combo=danger=0;hammer=false;current=rnd();next=rnd();running=true;mode='game';renderUI()}
function drop(x){if(!running||!dropReady)return;let r=R(current);newBall(current,Math.max(basket.x+r,Math.min(basket.x+basket.w-r,x)),basket.y+r+5);current=next;next=rnd();dropReady=false;setTimeout(()=>dropReady=true,330);renderUI()}
function merge(a,b){if(!a||!b||!balls.includes(a)||!balls.includes(b)||a.level!==b.level||a.level===10)return;let l=a.level+1,p={x:(a.body.position.x+b.body.position.x)/2,y:(a.body.position.y+b.body.position.y)/2};destroyBall(a);destroyBall(b);let n=newBall(l,p.x,p.y,true);Body.setVelocity(n.body,{x:0,y:-1.4});let now=performance.now();combo=now-lastMerge<1500?combo+1:1;lastMerge=now;let gain=F[l].score*Math.max(1,combo);score+=gain;let c=Math.max(1,Math.ceil(F[l].score/16))+Math.max(0,combo-1);coins+=c;earned+=c;store.set('suika_coins',coins);if(score>best){best=score;store.set('suika_best_v4',best)}pop(p.x,p.y,l);float(p.x,p.y-R(l),`+${gain}`,0xff512b);float(p.x,p.y+10,`+${c} 💰`,0xf0a000);renderUI()}
function destroyBall(b){
  // 合成回调可能遇到已处理的碰撞对；幂等销毁避免重复移除导致 Sprite 消失。
  const index=balls.indexOf(b); if(index<0) return;
  ballByBody.delete(b.body); World.remove(E.world,b.body);
  if(b.sprite.parent) b.sprite.parent.removeChild(b.sprite);
  b.sprite.destroy(); balls.splice(index,1);
}
Events.on(E,'collisionStart',e=>{for(const pair of e.pairs){let a=ballByBody.get(pair.bodyA),b=ballByBody.get(pair.bodyB);if(a&&b&&a.level===b.level)merge(a,b);}});
function pop(x,y,l){let ring=new PIXI.Graphics();ring.lineStyle(3,0xffffff,.8);ring.drawCircle(0,0,8);ring.position.set(x,y);fx.addChild(ring);let particles=[];for(let i=0;i<16+l*2;i++){let g=new PIXI.Graphics();g.beginFill([0xff765c,0xffd166,0x8be0e8,0xffa9c8,0xffffff][i%5]);g.drawCircle(0,0,3+Math.random()*3);g.endFill();g.position.set(x,y);fx.addChild(g);let q=Math.random()*6.28,s=80+Math.random()*160;particles.push({g,vx:Math.cos(q)*s,vy:Math.sin(q)*s-50,life:1})}A.ticker.add(function step(d){let dt=d/60;ring.scale.set(ring.scale.x+dt*.18);ring.alpha-=dt*.055;particles.forEach(p=>{p.g.x+=p.vx*dt;p.g.y+=p.vy*dt;p.vy+=700*dt;p.life-=dt*.035;p.g.alpha=Math.max(0,p.life)});if(ring.alpha<=0){A.ticker.remove(step);ring.destroy();particles.forEach(p=>p.g.destroy())}})}
function float(x,y,s,c){let t=txt(s,16,c);t.anchor.set(.5);t.position.set(x,y);fx.addChild(t);A.ticker.add(function f(d){t.y-=d*.7;t.alpha-=d*.018;if(t.alpha<=0){A.ticker.remove(f);t.destroy()}})}
function renderUI(){clear(ui);if(mode==='start'){modal('🍉 合成大西瓜',['滑动瞄准，松手投放水果','相同水果相撞将会合成升级','💰 合成赚金币，商城购买指定水果'],['开始游戏',()=>reset()]);return} if(mode==='over'){modal('🍉 游戏结束',[`本局得分：${score}`,`本局金币：+${earned} 💰`,`历史最高：${best}`],['再来一局',()=>reset()]);return}
 let bw=(W-28)/3;[['得分',score,0xd94a14],['💰 金币',coins,0xc87d00],['最高',best,0xd94a14]].forEach((v,i)=>{ui.addChild(box(10+i*(bw+4),8,bw,45));let a=txt(v[0],10,0x9d5c19);a.anchor.set(.5);a.position.set(10+i*(bw+4)+bw/2,21);ui.addChild(a);let b=txt(String(v[1]),18,v[2]);b.anchor.set(.5);b.position.set(10+i*(bw+4)+bw/2,39);ui.addChild(b)});
 let n=box(10,62,104,38);ui.addChild(n);let nt=txt('下一个',11);nt.position.set(18,75);ui.addChild(nt);let ni=new PIXI.Sprite(texture[F[next].img]);ni.anchor.set(.5);ni.position.set(94,81);ni.width=ni.height=30;ui.addChild(ni);addButton('🛒 商店',W-112,65,70,31,()=>{mode='shop';renderUI()},true);addButton('🔔',W-37,65,27,31,()=>{},false);
 let frame=box(basket.x,basket.y,basket.w,basket.h,0xffffff,.20,20);ui.addChild(frame);let line=new PIXI.Graphics();line.lineStyle(2,danger?0xff244a:0xe64c46,.7);line.moveTo(basket.x,basket.y+basket.h*.17);line.lineTo(basket.x+basket.w,basket.y+basket.h*.17);ui.addChild(line);
 let py=basket.y+basket.h+8,w=(W-32)/3;addButton('🔨 碎果锤 50',10,py,w,36,()=>useHammer());addButton('📳 摇一摇 30',16+w,py,w,36,()=>useShake());addButton('🍉 买水果',22+w*2,py,w,36,()=>{mode='shop';renderUI()},true);
 let ey=H-29;F.forEach((f,i)=>{let s=new PIXI.Sprite(texture[f.img]);s.anchor.set(.5);s.position.set(12+i*(W-24)/10,ey);s.width=s.height=22;ui.addChild(s)});
 if(mode==='shop')shop();}
function modal(title,lines,button){let veil=new PIXI.Graphics();veil.beginFill(0x2d1405,.58);veil.drawRect(0,0,W,H);veil.endFill();ui.addChild(veil);let w=Math.min(350,W-30),h=255,x=(W-w)/2,y=(H-h)/2;ui.addChild(box(x,y,w,h,0xfffaed,1,23));let t=txt(title,22,0xbd4617);t.anchor.set(.5);t.position.set(W/2,y+33);ui.addChild(t);lines.forEach((s,i)=>{let q=txt(s,14,0x764819);q.anchor.set(.5);q.position.set(W/2,y+83+i*29);ui.addChild(q)});addButton(button[0],W/2-88,y+183,176,45,button[1],true)}
function shop(){let veil=new PIXI.Graphics();veil.beginFill(0x2d1405,.62);veil.drawRect(0,0,W,H);veil.endFill();ui.addChild(veil);let w=Math.min(365,W-20),h=Math.min(H-22,585),x=(W-w)/2,y=(H-h)/2;ui.addChild(box(x,y,w,h,0xfffaed,1,22));let title=txt('🛒 水果商店',21,0xbd4617);title.anchor.set(.5);title.position.set(W/2,y+26);ui.addChild(title);addButton('×',x+w-37,y+10,27,25,()=>{mode='game';renderUI()});let c=txt(`当前金币：${coins} 💰`,13,0xa36212);c.position.set(x+16,y+57);ui.addChild(c);let cw=(w-40)/3,ch=78;F.forEach((f,i)=>{let col=i%3,row=(i/3)|0,ix=x+14+col*(cw+6),iy=y+80+row*(ch+6),ok=coins>=f.price;let card=box(ix,iy,cw,ch,ok?0xffffff:0xeeeeee,1,12);ui.addChild(card);let im=new PIXI.Sprite(texture[f.img]);im.anchor.set(.5);im.position.set(ix+cw/2,iy+24);im.width=im.height=39;im.alpha=ok?1:.45;ui.addChild(im);let nm=txt(f.n,10);nm.anchor.set(.5);nm.position.set(ix+cw/2,iy+50);ui.addChild(nm);addButton(`💰${f.price}`,ix+7,iy+59,cw-14,14,()=>{if(coins>=f.price){coins-=f.price;store.set('suika_coins',coins);current=i;mode='game';renderUI()}},ok)});}
function useHammer(){if(!running||coins<50)return;coins-=50;store.set('suika_coins',coins);hammer=true;renderUI()}
function useShake(){if(!running||coins<30)return;coins-=30;store.set('suika_coins',coins);balls.forEach(b=>Body.setVelocity(b.body,{x:(Math.random()-.5)*4,y:-2-Math.random()*2}));renderUI()}
A.stage.eventMode='static';A.stage.hitArea=A.screen;A.stage.on('pointermove',e=>{aimX=e.global.x});A.stage.on('pointertap',e=>{if(mode!=='game'||!running)return;let p=e.global;if(p.x<basket.x||p.x>basket.x+basket.w||p.y<basket.y||p.y>basket.y+basket.h)return;if(hammer){let hit=balls.find(b=>Math.hypot(b.body.position.x-p.x,b.body.position.y-p.y)<b.r);if(hit){pop(hit.body.position.x,hit.body.position.y,hit.level);destroyBall(hit);hammer=false;renderUI()}}else drop(p.x)});
A.ticker.maxFPS=60;A.ticker.add(()=>{if(!running||mode!=='game')return;Engine.update(E,1000/60);for(const b of balls){let p=b.body.position;b.sprite.position.set(p.x,p.y);b.sprite.width=b.sprite.height=b.r*2*(1+b.pulse);b.pulse*=.88}let ly=basket.y+basket.h*.17;let bad=balls.some(b=>performance.now()-b.born>850&&b.body.position.y-b.r<ly&&Math.abs(b.body.velocity.y)<1);danger=bad?danger+16:0;if(danger>1200){running=false;mode='over';renderUI()}});
window.addEventListener('resize',layout);layout();renderUI();
})();
