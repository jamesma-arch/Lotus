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
  screen.innerHTML='<div class="intro-grain" aria-hidden="true"></div><div class="intro-halo" aria-hidden="true"></div><div class="intro-content"><div class="intro-logo-wrap"><img class="intro-logo" src="./assets/logo.webp" alt="Lotus House crest"></div><p class="intro-kicker">BANGKOK · ONE NIGHT · SEVEN GUESTS</p><div class="intro-rule" aria-hidden="true"></div><h1>THE LAST TOAST <em>AT</em><span>LOTUS HOUSE</span></h1><p class="intro-line">Raise a glass. Trust nobody.</p><p class="intro-finale">EVERY SECRET HAS ITS PRICE.</p><div class="intro-progress" aria-hidden="true"><span></span></div><div class="intro-actions"><button type="button" id="intro-begin">Begin with sound ♪</button><button type="button" class="intro-quiet" id="intro-silent">Continue silently</button></div><button type="button" class="intro-skip" id="intro-skip" hidden>Skip intro ↗</button></div>';
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
  // Original quiet jazz-noir cue: walking bass, offbeat piano, brushed snare and muted horn.
  const music=async()=>{
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return;
    ctx=new AudioContext();
    if(ctx.state==='suspended')await ctx.resume();
    if(finished){ctx.close().catch(()=>{});return;}
    const t=ctx.currentTime+.03;
    master=ctx.createGain();
    master.gain.setValueAtTime(.0001,t);
    master.gain.linearRampToValueAtTime(.26,t+.45);
    master.gain.setValueAtTime(.26,t+8.5);
    master.gain.exponentialRampToValueAtTime(.0001,t+9.85);
    master.connect(ctx.destination);
    const instrument=(frequency,when,length,loudness,shape='sine',attack=.015,release=.3,filterHz=0)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=shape;
      osc.frequency.setValueAtTime(frequency,t+when);
      if(shape==='sawtooth'&&filterHz){
        const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=filterHz;
        osc.connect(low);low.connect(gain);
      }else osc.connect(gain);
      gain.connect(master);
      gain.gain.setValueAtTime(.0001,t+when);
      gain.gain.linearRampToValueAtTime(loudness,t+when+attack);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001,loudness*.35),t+when+Math.max(attack+.01,length-release));
      gain.gain.exponentialRampToValueAtTime(.0001,t+when+length);
      osc.start(t+when);osc.stop(t+when+length+.02);
    };
    const noiseBuffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.20),ctx.sampleRate);
    const data=noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
    const brush=(when,volume)=>{
      const src=ctx.createBufferSource(),high=ctx.createBiquadFilter(),gain=ctx.createGain();
      src.buffer=noiseBuffer;high.type='highpass';high.frequency.value=2800;
      src.connect(high);high.connect(gain);gain.connect(master);
      gain.gain.setValueAtTime(.0001,t+when);
      gain.gain.linearRampToValueAtTime(volume,t+when+.009);
      gain.gain.exponentialRampToValueAtTime(.0001,t+when+.14);
      src.start(t+when);src.stop(t+when+.16);
    };
    // Tempo ~120 BPM: four bars of syncopated minor-key lounge jazz.
    const chords=[
      [55,[220,261.63,329.63,392]],    // Am7
      [43.65,[174.61,220,261.63,329.63]], // Fmaj7
      [49,[196,246.94,293.66,349.23]],   // G7
      [41.20,[164.81,207.65,246.94,311.13]] // E7
    ];
    const bassPattern=[0,7,12,7];
    chords.forEach(([root,chord],bar)=>{
      const at=bar*2.25;
      for(let beat=0;beat<4;beat++){
        const pitch=root*2**(bassPattern[beat]/12);
        instrument(pitch,at+beat*.5625,.46,.35,'triangle',.012,.28);
        instrument(pitch*.5,at+beat*.5625,.33,.095,'sine',.008,.2);
        brush(at+beat*.5625+.03,beat===1||beat===3?.12:.065);
        if(beat===1||beat===3)brush(at+beat*.5625+.16,.038);
      }
      [0.53,1.4].forEach((offset,idx)=>{
        chord.forEach((hz,j)=>instrument(hz,at+offset,idx?.50:.37,.042+(j===0?.009:0),'triangle',.007,.24));
      });
    });
    // Trumpet-like lead, softened with a low-pass filter.
    [[440,.72,.36],[523.25,1.35,.30],[587.33,1.74,.45],
     [659.25,2.48,.44],[587.33,3.03,.28],[523.25,3.5,.58],
     [493.88,4.8,.32],[523.25,5.25,.35],[587.33,5.72,.40],
     [659.25,6.31,.55],[783.99,7.04,.39],[659.25,7.57,.38],
     [880,8.05,1.25]].forEach(([hz,when,dur])=>{
      instrument(hz,when,dur,.063,'sawtooth',.045,.23,1050);
      instrument(hz*.5,when,dur,.035,'sine',.04,.23);
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
