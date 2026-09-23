'use strict';
/* Ten-second, spoiler-free opening. Music is synthesized locally; no external audio. */
(() => {
  const SEEN='lotus_intro_seen_v1';
  try { if(sessionStorage.getItem(SEEN)==='1') return; } catch (_) {}
  const screen=document.createElement('div');
  screen.className='lotus-intro';
  screen.setAttribute('role','dialog');
  screen.setAttribute('aria-modal','true');
  screen.setAttribute('aria-label','Lotus House introduction');
  screen.innerHTML='<div class="intro-grain" aria-hidden="true"></div><div class="intro-halo" aria-hidden="true"></div><div class="intro-content"><div class="intro-mark" aria-hidden="true">✧</div><p class="intro-kicker">BANGKOK · ONE NIGHT · SEVEN GUESTS</p><div class="intro-rule" aria-hidden="true"></div><h1>THE LAST TOAST <em>AT</em><span>LOTUS HOUSE</span></h1><p class="intro-line">Raise a glass. Trust nobody.</p><p class="intro-finale">EVERY SECRET HAS ITS PRICE.</p><div class="intro-progress" aria-hidden="true"><span></span></div><div class="intro-actions"><button type="button" id="intro-begin">Begin with sound ♪</button><button type="button" class="intro-quiet" id="intro-silent">Continue silently</button></div><button type="button" class="intro-skip" id="intro-skip" hidden>Skip intro ↗</button></div>';
  document.body.appendChild(screen);
  let ctx=null,master=null,timeout=null,finished=false,playing=false;
  const finish=()=>{
    if(finished)return;
    finished=true;
    if(timeout)clearTimeout(timeout);
    try { sessionStorage.setItem(SEEN,'1'); } catch (_) {}
    if(ctx&&master){
      try { master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.06); } catch (_) {}
      const old=ctx;setTimeout(()=>old.close().catch(()=>{}),500);
    }
    screen.classList.add('intro-exit');
    setTimeout(()=>screen.remove(),500);
  };
  // Quiet, ten-second minor-key cinematic theme.
  const music=async()=>{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return;
    ctx=new AudioContext();
    if(ctx.state==='suspended')await ctx.resume();
    const t=ctx.currentTime+.04;
    master=ctx.createGain();master.gain.setValueAtTime(0,t);
    master.gain.linearRampToValueAtTime(.19,t+.6);
    master.gain.setValueAtTime(.19,t+8.7);
    master.gain.exponentialRampToValueAtTime(.0001,t+9.9);
    master.connect(ctx.destination);
    const note=(hz,at,dur,vol,type='sine')=>{
      const osc=ctx.createOscillator(),env=ctx.createGain();
      osc.type=type;osc.frequency.setValueAtTime(hz,t+at);
      osc.connect(env);env.connect(master);
      env.gain.setValueAtTime(.0001,t+at);
      env.gain.exponentialRampToValueAtTime(Math.max(vol,.001),t+at+.12);
      env.gain.setValueAtTime(Math.max(vol,.001),t+at+Math.max(.13,dur-.55));
      env.gain.exponentialRampToValueAtTime(.0001,t+at+dur);
      osc.start(t+at);osc.stop(t+at+dur+.03);
    };
    [[110,164.81,220],[87.31,130.81,174.61],[73.42,110,146.83],[82.41,123.47,164.81]].forEach((ch,i)=>{
      ch.forEach((hz,j)=>note(hz,i*2.1,2.3,j===0?.26:.14,'triangle'));
      note(ch[0]/2,i*2.1,1.95,.19,'sine');
    });
    [[440,.4],[523.25,1.2],[659.25,2],[698.46,3.1],[659.25,3.85],[523.25,4.65],[493.88,5.45],[659.25,6.4],[783.99,7.25],[880,8.2]].forEach(([hz,at],i)=>{
      note(hz,at,i===9?1.65:.82,i===9?.18:.085,'sine');
      if(i===9)note(hz/2,at,1.65,.11,'triangle');
    });
  };
  const start=(withSound)=>{
    if(playing||finished)return;
    playing=true;
    screen.classList.add('intro-playing');
    screen.querySelector('.intro-actions').hidden=true;
    screen.querySelector('#intro-skip').hidden=false;
    timeout=setTimeout(finish,10000);
    if(withSound)music().catch(()=>{});
  };
  screen.querySelector('#intro-begin').addEventListener('click',()=>start(true));
  screen.querySelector('#intro-silent').addEventListener('click',()=>start(false));
  screen.querySelector('#intro-skip').addEventListener('click',finish);
})();
