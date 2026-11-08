'use strict';
/* Анимированные фоны (WebGL). window.BG.set(name, {accent, speed}) */
(() => {
  const COMMON = `
precision highp float;
uniform vec2 R; uniform float T; uniform vec3 A;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v+=a*noise(p); p=m*p; a*=.5; } return v; }
vec3 grade(vec3 c, vec2 uv){ c*=1.-.35*length(uv-.5); c+= (h21(uv*R+T)-.5)*.025; return c; }
`;
  const SHADERS = {
    // переливающаяся жидкость (domain warping)
    liquid: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv*vec2(R.x/R.y,1.)*2.2; float t=T*.12;
  vec2 q=vec2(fbm(p+vec2(0.,t)), fbm(p+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p+3.5*q+vec2(1.7,9.2)+t*1.3), fbm(p+3.5*q+vec2(8.3,2.8)-t*1.1));
  float f=fbm(p+3.5*r);
  vec3 c=mix(vec3(.03,.04,.12), vec3(.22,.12,.55), clamp(f*f*2.,0.,1.));
  c=mix(c, A*.9, clamp(length(q)*.55-.15,0.,1.));
  c=mix(c, vec3(.95,.35,.6), clamp(r.x*r.x*.9-.25,0.,1.)*.55);
  c+=pow(clamp(f-.45,0.,1.),2.)*1.2*mix(vec3(1.),A,.5);
  gl_FragColor=vec4(grade(c*1.05,uv),1.); }`,
    // северное сияние
    aurora: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y; float t=T*.18;
  vec3 c=mix(vec3(.01,.02,.06), vec3(.03,.06,.14), uv.y);
  vec2 sg=floor(gl_FragCoord.xy/2.); float s=h21(sg); c+=step(.9965,s)*(.5+.5*sin(T*2.+s*80.))*vec3(.8,.9,1.)*(uv.y*.8+.2);
  for(int i=0;i<4;i++){ float fi=float(i);
    float wave=.55+.12*fi*.5 + .09*sin(p.x*1.6+t*1.3+fi*1.7) + .07*fbm(vec2(p.x*1.8+t*.7, fi*3.1+t*.2));
    float d=uv.y-wave;
    float curtain=exp(-max(d,0.)*(5.+fi*2.))*smoothstep(-.02,.06,d);
    float rays=.55+.45*fbm(vec2(p.x*14.+fi*7.+t*.8, uv.y*1.5));
    vec3 col=mix(vec3(.15,1.,.6), A, fi/3.); col=mix(col, vec3(.65,.3,1.), smoothstep(.05,.35,d)*.8);
    c+=col*curtain*rays*(.55-fi*.08); }
  c+=A*.06*exp(-uv.y*4.);
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // космос: туманность и звёзды
    nebula: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float t=T*.03;
  float a=t*.5; p=mat2(cos(a),-sin(a),sin(a),cos(a))*p;
  float n1=fbm(p*2.2+vec2(t,-t)), n2=fbm(p*3.5-vec2(t*1.3,t*.7)+n1*1.5);
  vec3 c=vec3(.01,.01,.03);
  c+=vec3(.35,.12,.6)*pow(n1,2.6)*1.6; c+=A*pow(n2,3.)*1.5; c+=vec3(.9,.35,.45)*pow(n1*n2,2.)*1.2;
  for(int l=0;l<3;l++){ float fl=float(l); vec2 g=(p+vec2(t*(1.+fl),0.))*(60.+fl*50.); vec2 id=floor(g); vec2 f=fract(g)-.5;
    float r=h21(id+fl*17.); vec2 o=vec2(h21(id+3.1),h21(id+7.7))-.5; float d=length(f-o*.6);
    float tw=.6+.4*sin(T*(1.5+r*3.)+r*40.); c+=smoothstep(.06,0.,d)*step(.93,r)*tw*(1.2-fl*.3); }
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // стеклянные волны
    waves: `
void main(){ vec2 uv=gl_FragCoord.xy/R; float x=uv.x*R.x/R.y; float t=T*.35;
  vec3 c=mix(vec3(.02,.03,.09), vec3(.06,.04,.16), uv.y);
  for(int i=0;i<6;i++){ float fi=float(i);
    float y=.18+fi*.11 + .05*sin(x*(1.2+fi*.25)+t*(.6+fi*.15)+fi*2.) + .025*sin(x*3.1-t*1.1+fi);
    float d=uv.y-y;
    float body=smoothstep(.0,-.004,d)*exp(d*6.);
    float edge=exp(-abs(d)*140.);
    vec3 col=mix(A, vec3(.65,.35,1.), fi/5.); col=mix(col, vec3(1.,.45,.6), smoothstep(3.,5.,fi)*.5);
    c=mix(c, col*(.18+.05*fi), body*.55); c+=edge*mix(col,vec3(1.),.4)*.55; }
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // светящиеся пузыри (боке)
    bokeh: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=gl_FragCoord.xy/R.y; float asp=R.x/R.y;
  vec3 c=mix(vec3(.02,.02,.06), vec3(.05,.03,.12), uv.y)+A*.05*(1.-uv.y);
  for(int i=0;i<34;i++){ float fi=float(i); float r1=h21(vec2(fi,1.3)), r2=h21(vec2(fi,7.1)), r3=h21(vec2(fi,4.7));
    float sz=.03+r3*.11; float sp=.015+r2*.03;
    vec2 pos=vec2(fract(r1+sin(T*.05+fi)*.05)*asp, fract(r2-T*sp)*1.3-.15);
    pos.x+=sin(T*.3+fi)*.03;
    float d=length(p-pos);
    float disk=smoothstep(sz,sz*.82,d)*.22 + smoothstep(sz*1.02,sz*.95,d)*smoothstep(sz*.85,sz*.97,d)*.25;
    vec3 col=mix(A, mix(vec3(.7,.4,1.), vec3(1.,.5,.6), r1), r2*.8);
    c+=col*disk*(.5+.5*sin(T*.7+fi)); }
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // градиентная сетка в стиле iOS
    mesh: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=uv; p.x*=R.x/R.y; float t=T*.22; float asp=R.x/R.y;
  vec2 P[5]; vec3 C[5];
  P[0]=vec2(.2*asp+.15*sin(t), .25+.15*cos(t*1.3)); C[0]=vec3(.20,.30,1.);
  P[1]=vec2(.8*asp+.12*cos(t*.8), .3+.2*sin(t*.9)); C[1]=vec3(.75,.30,1.);
  P[2]=vec2(.5*asp+.25*sin(t*.6), .8+.12*cos(t*1.1)); C[2]=A;
  P[3]=vec2(.15*asp+.1*cos(t*1.2), .85+.1*sin(t)); C[3]=vec3(1.,.42,.55);
  P[4]=vec2(.85*asp+.1*sin(t*1.4), .85+.1*cos(t*.7)); C[4]=vec3(.10,.75,.80);
  vec3 c=vec3(0.); float w=0.;
  for(int i=0;i<5;i++){ float d=length(p-P[i]); float k=1./(pow(d,2.2)+.02); c+=C[i]*k; w+=k; }
  c/=w; c*=.55+.25*fbm(p*2.+t);
  gl_FragColor=vec4(grade(c*.75,uv),1.); }`,
    // плазменные линии
    silk: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float t=T*.25;
  vec3 c=vec3(.015,.02,.05);
  for(int i=0;i<28;i++){ float fi=float(i)/28.;
    float y=sin(p.x*(2.+fi*1.5)+t+fi*6.28)*(.18+.12*sin(t*.5+fi*3.))+(fi-.5)*.5+.06*fbm(vec2(p.x*2.+t,fi*9.));
    float d=abs(p.y-y);
    vec3 col=mix(A, vec3(.75,.35,1.), fi); col=mix(col, vec3(1.,.5,.55), smoothstep(.6,1.,fi));
    c+=col*.0035/(d+.003)*(.4+.6*sin(fi*12.+t)); }
  c=1.-exp(-c*.9);
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // солнечная система
    solar: `
vec3 planetCol(int i){ if(i==0)return vec3(.62,.58,.55); if(i==1)return vec3(.95,.78,.45); if(i==2)return vec3(.25,.55,1.); if(i==3)return vec3(.95,.42,.25);
  if(i==4)return vec3(.92,.72,.52); if(i==5)return vec3(.95,.85,.6); if(i==6)return vec3(.55,.9,.95); return vec3(.3,.45,1.); }
void planet(int i, vec2 p, vec2 sun, float t, bool front, inout vec3 c){
  float fi=float(i); float r=.17+fi*.115; float w=.9/pow(r*3.,1.5); float a=t*w+fi*2.4;
  float sa=sin(a); if(front != (sa<0.)) return;
  float tilt=.32; vec2 pos=sun+vec2(r*1.25*cos(a), r*sa*tilt);
  float sz=(fi==4.?.055:fi==5.?.046:fi==6.||fi==7.?.033:fi==2.?.026:.019)*(1.-.18*sa);
  vec2 q=p-pos; float l=length(q)/sz;
  bool ringed=(i==5);
  if(ringed){ vec2 rq=vec2(q.x, q.y/.33)/sz; float rl=length(rq);
    float band=smoothstep(1.45,1.55,rl)*smoothstep(2.4,2.2,rl)*(.55+.45*sin(rl*18.));
    if(q.y>0. && l<1.) band=0.; if(q.y<0. || l>1.) c=mix(c, vec3(.9,.8,.6), band*.75); }
  if(l<1.){ vec3 n=vec3(q/sz, sqrt(1.-l*l)); vec3 L=normalize(vec3(sun-pos, .25));
    float dif=max(dot(n,L),0.); float band=1.; if(i==4) band=.8+.2*sin(n.y*22.+fi);
    vec3 col=planetCol(i)*band*(.06+dif*1.1); col+=pow(1.-n.z,3.)*planetCol(i)*.6*dif;
    c=mix(c,col,smoothstep(1.,.9,l)); if(ringed){ vec2 rq=vec2(q.x,q.y/.33)/sz; float rl=length(rq);
      float b2=smoothstep(1.45,1.55,rl)*smoothstep(2.4,2.2,rl)*(.55+.45*sin(rl*18.)); if(q.y<0.) c=mix(c, vec3(.9,.8,.6)*(.4+.6*dif), b2*.75); } }
  else c+=planetCol(i)*.05*exp(-(l-1.)*3.)*float(i==2||i==6);
}
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=gl_FragCoord.xy/R.y; float asp=R.x/R.y; float t=T*.6;
  vec2 sun=vec2(asp*.6,.48);
  vec3 c=vec3(.005,.008,.02)+vec3(.03,.02,.06)*fbm(p*2.+T*.01);
  for(int l=0;l<2;l++){ vec2 g=p*(90.+float(l)*70.); vec2 id=floor(g); float r=h21(id+float(l)*9.); vec2 f=fract(g)-.5;
    c+=smoothstep(.08,0.,length(f))*step(.97,r)*(.5+.5*sin(T*2.+r*50.)); }
  for(int i=0;i<8;i++){ float r=.17+float(i)*.115; vec2 d=p-sun; float e=abs(length(vec2(d.x/1.25,d.y/.32))-r);
    c+=vec3(.5,.6,.9)*.09*smoothstep(.0035,0.,e*R.y*.0025); }
  float belt=length(vec2((p-sun).x/1.25,(p-sun).y/.32)); float ang=atan((p-sun).y/.32,(p-sun).x/1.25);
  vec2 bg=vec2(ang*60.+t*1.5, belt*120.); c+=step(.985,h21(floor(bg)))*smoothstep(.04,0.,abs(belt-.63))*.5;
  for(int i=0;i<8;i++) planet(i,p,sun,t,false,c);
  float sd=length(p-sun); float corona=fbm(vec2(atan(p.y-sun.y,p.x-sun.x)*3.,sd*8.-T*.5));
  vec3 sunc=mix(vec3(1.,.55,.15),vec3(1.,.95,.75),smoothstep(.07,.0,sd));
  c=mix(c, sunc*(1.15+.18*fbm(p*16.+T*.3)), smoothstep(.078,.07,sd));
  c+=vec3(1.,.55,.2)*(.035/(sd+.02))*(.6+.4*corona)*.35 + A*.08*exp(-sd*3.);
  for(int i=0;i<8;i++) planet(i,p,sun,t,true,c);
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // мультивселенная
    multiverse: `
vec3 pal(float x){ return .5+.5*cos(6.2832*(x+vec3(0.,.33,.67))); }
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-.5*R)/R.y; float t=T*.08;
  vec3 c=vec3(.004,.004,.012)+vec3(.04,.02,.07)*fbm(p*1.5+t);
  vec2 sg=floor(gl_FragCoord.xy/1.5); c+=step(.997,h21(sg))*.6;
  for(int l=0;l<3;l++){ float fl=float(l); float sc=2.2+fl*1.7; float ca=cos(t*.3*(fl+1.)), sa=sin(t*.3*(fl+1.));
    vec2 g=mat2(ca,-sa,sa,ca)*p*sc+vec2(t*(1.+fl*.6),t*.4*(fl-1.)); vec2 id0=floor(g);
    for(int j=-1;j<=1;j++) for(int k=-1;k<=1;k++){ vec2 id=id0+vec2(float(j),float(k)); float r=h21(id+fl*31.);
      if(r<.62) continue;
      vec2 ctr=id+.5+(vec2(h21(id+1.7),h21(id+5.3))-.5)*.5; float rad=.18+.22*h21(id+9.1);
      vec2 q=g-ctr; float d=length(q)/rad; if(d>1.6) continue;
      float hue=h21(id+3.3)+.1*sin(T*.05); vec3 col=mix(pal(hue),A,.25);
      float fade=1.-fl*.25;
      if(d<1.){ float an=atan(q.y,q.x); float lr=log(d+.02);
        float arms=pow(.5+.5*sin(an*2.-lr*4.+T*.4*(1.+r)),3.);
        float core=exp(-d*6.);
        vec3 inner=col*(arms*(1.-d)*.9+core*1.6)+vec3(1.)*core*.4;
        inner+=step(.99,h21(floor(q*45./rad)))*.5*(1.-d);
        float rim=pow(d,4.)*.9;
        c=mix(c, inner*.85+col*rim, (.55+.4*smoothstep(.8,1.,d))*fade);
        c+=vec3(1.)*pow(max(0.,1.-length(q/rad-vec2(-.35,.4))*2.2),3.)*.18*fade; }
      else c+=col*.12*exp(-(d-1.)*7.)*fade; } }
  gl_FragColor=vec4(grade(c*1.1,uv),1.); }`,
    // чёрная дыра с аккреционным диском
    blackhole: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=(gl_FragCoord.xy-vec2(.62,.5)*R)/R.y; float t=T*.25;
  float r=length(p); float a=atan(p.y,p.x);
  vec2 lp=p*(1.+.12/(r*r+.02));
  vec3 c=vec3(.004,.004,.012);
  vec2 sg=floor(lp*220.); float sh=h21(sg); c+=step(.992,sh)*(.6+.4*sin(T*2.+sh*90.))*vec3(.85,.9,1.);
  c+=vec3(.12,.06,.2)*fbm(lp*2.+t*.1)*.6;
  vec2 dp=vec2(p.x, p.y*3.2); float dr=length(dp); float da=atan(dp.y,dp.x);
  float ring=smoothstep(.13,.17,dr)*smoothstep(.62,.25,dr);
  float swirl=fbm(vec2(da*3.-t*3.+dr*8., dr*10.-t));
  vec3 hot=mix(vec3(1.,.55,.18), vec3(1.,.92,.75), smoothstep(.35,.15,dr)); hot=mix(hot, A, .25);
  float dopp=.65+.55*cos(da+.3);
  float front=step(0.,p.y)*.0+1.;
  c+=hot*ring*(.35+swirl*1.3)*dopp*1.4;
  float halo=exp(-abs(r-.16)*40.)*.9; c+=hot*halo*(.6+.4*sin(a*2.+t));
  float lens=smoothstep(.11,.108,r); c*=1.-lens;
  c+=vec3(1.,.7,.4)*exp(-abs(r-.112)*160.)*.9;
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // цифровой дождь
    matrix: `
void main(){ vec2 uv=gl_FragCoord.xy/R; float cols=floor(R.x/9.); vec2 g=vec2(floor(uv.x*cols), floor(uv.y*R.y/14.));
  float cid=g.x; float sp=.4+h21(vec2(cid,3.))*1.2; float off=h21(vec2(cid,9.))*50.;
  float head=fract(-(T*sp*.18)-off) * (R.y/14.+20.);
  float d=head-(R.y/14.-g.y);
  float trail=d>0. ? exp(-d*.12) : 0.;
  float glyph=step(.35,h21(g+floor(T*6.*h21(vec2(cid,1.)))));
  vec2 f=fract(vec2(uv.x*cols, uv.y*R.y/14.)); float cell=step(.15,f.x)*step(f.x,.85)*step(.1,f.y)*step(f.y,.9);
  vec3 col=mix(vec3(.1,1.,.45), A, .45);
  vec3 c=col*trail*glyph*cell*.9 + vec3(.85,1.,.9)*step(d,1.2)*step(0.,d)*cell*glyph;
  c+=vec3(.0,.03,.02);
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // подводный мир
    underwater: `
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=gl_FragCoord.xy/R.y; float t=T*.3;
  vec3 deep=vec3(.0,.04,.12), shallow=mix(vec3(.05,.45,.6),A,.35);
  vec3 c=mix(deep, shallow, pow(uv.y,1.6));
  vec2 q=p*3.; float ca=0.;
  for(int i=0;i<3;i++){ q+=vec2(sin(q.y*1.3+t*1.1),cos(q.x*1.2-t*.9))*.35; ca+=abs(sin(q.x+q.y+t)); }
  c+=vec3(.5,.9,1.)*pow(max(0.,1.-ca*.42),6.)*(.25+.6*uv.y);
  float rays=0.; for(int i=0;i<5;i++){ float fi=float(i); float x=p.x*.9+(uv.y-1.)*(.25+fi*.05)+sin(t*.4+fi)*.1+fi*.37; rays+=pow(max(0.,sin(x*7.+fi)),18.); }
  c+=vec3(.6,.95,1.)*rays*.12*pow(uv.y,1.5);
  for(int i=0;i<24;i++){ float fi=float(i); vec2 bp=vec2(fract(h21(vec2(fi,2.))+sin(T*.4+fi)*.02)*R.x/R.y, fract(h21(vec2(fi,5.))+T*(.03+.05*h21(vec2(fi,8.))))*1.2-.1);
    float sz=.004+.01*h21(vec2(fi,7.)); float d=length(p-bp); c+=vec3(.8,.95,1.)*(smoothstep(sz,sz*.6,d)*.25+smoothstep(sz*1.05,sz*.9,d)*smoothstep(sz*.7,sz*.9,d)*.5); }
  c+=vec3(.0,.02,.03)*fbm(p*4.+t);
  gl_FragColor=vec4(grade(c,uv),1.); }`,
    // пиксельный мир с плывущими блоками
    pixel: `
vec3 blockCol(float r, vec2 f, float face){ vec3 c; float n=h21(floor(f*8.)+r*13.);
  if(r<.25){ c=face>1.5 ? vec3(.35,.7,.25) : vec3(.5,.36,.24); if(face<1.5 && f.y>.8) c=vec3(.35,.7,.25); }
  else if(r<.45) c=vec3(.5,.5,.52); else if(r<.6) c=vec3(.62,.45,.28); else if(r<.72) c=vec3(.85,.78,.52);
  else if(r<.84) c=mix(vec3(.3,.85,.85), A, .3); else if(r<.93) c=vec3(.62,.62,.66)+vec3(.0,.15,.2)*step(.82,n); else c=vec3(.9,.3,.25);
  return c*(.82+.25*n); }
void main(){ vec2 uv=gl_FragCoord.xy/R; vec2 p=gl_FragCoord.xy/R.y; float t=T*.05;
  vec3 c=mix(vec3(.30,.55,.95), vec3(.62,.82,1.), uv.y); c=mix(c, vec3(.04,.06,.16), .55);
  c+=A*.08*(1.-uv.y);
  for(int l=0;l<3;l++){ float fl=float(l); float sc=4.+fl*3.; vec2 g=p*sc+vec2(t*(3.+fl*2.)*sc*.25, sin(t*2.+fl)*.3); vec2 id=floor(g); vec2 f=fract(g);
    float r=h21(id+fl*7.); if(r>.18) continue;
    vec2 o=vec2(h21(id+1.),h21(id+2.))*.4; vec2 q=(f-.3-o*.5)/.45;
    float b=.5+.5*sin(T*.6+r*40.); q.y+=b*.08;
    if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){ float face=q.y>.72?2.:1.; vec2 tf=face>1.5?vec2(q.x,(q.y-.72)/.28):vec2(q.x,q.y/.72);
      float shade=face>1.5?1.15:(q.x<.5?.95:.75); vec3 bc=blockCol(fract(r*5.3),tf,face)*shade;
      c=mix(c, bc*(.55+.18*fl), .92); }
  }
  gl_FragColor=vec4(grade(c,uv),1.); }`
  };

  // Качество: scale — доля разрешения окна, fps — предел кадров. 'auto' подстраивается под видеокарту.
  const QUALITY = { high: { scale: .8, fps: 60 }, auto: { scale: .6, fps: 40 }, eco: { scale: .4, fps: 24 } };
  let canvas, gl, prog, raf = 0, uni = {}, accent = [0.35, 0.78, 0.98], speed = 1, cur = '', last = 0, tAcc = 0, prevNow = 0, frozen = 0;
  let quality = 'auto', scale = .6, fps = 40, paused = false, slow = 0, fast = 0, dirty = true;
  function hexToVec(h) { h = (h || '#5AC8FA').replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16) / 255); }
  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'bgcanvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return false;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { dirty = true; last = 0; loop(); }, 120); });
    document.addEventListener('visibilitychange', () => { prevNow = 0; if (!document.hidden) loop(); });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cur = ''; });
    return true;
  }
  function compile(src) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, COMMON + src); gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) { console.error('shader: ' + gl.getShaderInfoLog(fs)); return null; }
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('link: ' + gl.getProgramInfoLog(p)); return null; }
    return p;
  }
  function resize() {
    const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uni.R, w, h); }
    dirty = false;
  }
  function frame(now) {
    raf = 0;
    if (!cur || document.hidden || (paused && !frozen)) return;
    const interval = 1000 / fps;
    if (now - last >= interval - 2) {
      const dt = prevNow ? now - prevNow : interval;
      // авто-качество: если кадры сильно запаздывают — снижаем разрешение, если запас есть — повышаем
      if (quality === 'auto' && !frozen && prevNow) {
        if (dt > interval * 1.6) { slow++; fast = 0; } else if (dt < interval * 1.1) { fast++; slow = 0; }
        if (slow > 20 && scale > .32) { scale = Math.max(.32, scale - .08); slow = 0; dirty = true; }
        if (fast > 400 && scale < .6) { scale = Math.min(.6, scale + .04); fast = 0; dirty = true; }
      }
      tAcc += Math.min(.1, dt / 1000) * speed; prevNow = now; last = now;
      if (dirty) resize();
      gl.uniform1f(uni.T, frozen || (tAcc + 20));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (!frozen) loop();
  }
  function loop() { if (!raf && cur) raf = requestAnimationFrame(frame); }
  // снимок фона для превью в настройках (отдельный маленький контекст)
  let snapCanvas, snapGl;
  function snapshot(name, w, h, acc) {
    if (!SHADERS[name]) return '';
    if (!snapCanvas) {
      snapCanvas = document.createElement('canvas');
      snapGl = snapCanvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
      if (!snapGl) return '';
      const b = snapGl.createBuffer(); snapGl.bindBuffer(snapGl.ARRAY_BUFFER, b);
      snapGl.bufferData(snapGl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), snapGl.STATIC_DRAW);
    }
    const g = snapGl; snapCanvas.width = w; snapCanvas.height = h;
    const vs = g.createShader(g.VERTEX_SHADER); g.shaderSource(vs, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'); g.compileShader(vs);
    const fs = g.createShader(g.FRAGMENT_SHADER); g.shaderSource(fs, COMMON + SHADERS[name]); g.compileShader(fs);
    const pr = g.createProgram(); g.attachShader(pr, vs); g.attachShader(pr, fs); g.linkProgram(pr); g.useProgram(pr);
    const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    const a = hexToVec(acc);
    g.viewport(0, 0, w, h);
    g.uniform2f(g.getUniformLocation(pr, 'R'), w, h); g.uniform1f(g.getUniformLocation(pr, 'T'), 37.0); g.uniform3f(g.getUniformLocation(pr, 'A'), a[0], a[1], a[2]);
    g.drawArrays(g.TRIANGLES, 0, 3);
    const url = snapCanvas.toDataURL('image/jpeg', .85);
    g.deleteProgram(pr); g.deleteShader(vs); g.deleteShader(fs);
    return url;
  }
  window.BG = {
    names: Object.keys(SHADERS),
    snapshot,
    // пауза (окно неактивно / свёрнуто): видеокарта полностью свободна для игры
    pause(v) { if (paused === !!v) return; paused = !!v; prevNow = 0; if (!paused) loop(); },
    set(name, opts = {}) {
      accent = hexToVec(opts.accent);
      speed = opts.speed != null ? opts.speed : 1;
      frozen = opts.still ? 40 + Math.random() * 100 : 0;
      if (opts.quality && QUALITY[opts.quality] && opts.quality !== quality) { quality = opts.quality; scale = QUALITY[quality].scale; fps = QUALITY[quality].fps; dirty = true; }
      const host = document.getElementById('bg');
      if (!SHADERS[name]) { cur = ''; if (canvas && canvas.parentNode) canvas.remove(); return false; }
      if (!canvas && !init()) return false;
      if (name !== cur) {
        const p = compile(SHADERS[name]);
        if (!p) return false;
        if (prog) gl.deleteProgram(prog);
        prog = p;
        gl.useProgram(prog);
        const loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        uni = { R: gl.getUniformLocation(prog, 'R'), T: gl.getUniformLocation(prog, 'T'), A: gl.getUniformLocation(prog, 'A') };
        cur = name; canvas.width = 0; dirty = true;
      }
      gl.uniform3f(uni.A, accent[0], accent[1], accent[2]);
      if (canvas.parentNode !== host) host.insertBefore(canvas, host.firstChild);
      last = 0; prevNow = 0; loop();
      return true;
    }
  };
})();
