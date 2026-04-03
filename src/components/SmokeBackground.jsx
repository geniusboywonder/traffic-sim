import { useEffect, useRef } from 'react';

const fragmentShaderSource = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 u_color;

#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)

float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.),u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;for(int i=0;i<5;i++){t+=a*noise(p);p*=mat2(1,-1.2,.2,1.2)*2.;a*=.5;}return t;}

void main(){
  vec2 uv=(FC-.5*R)/R.y;
  vec3 col=vec3(1);
  uv.x+=.25;
  uv*=vec2(2,1);
  float n=fbm(uv*.28-vec2(T*.01,0));
  n=noise(uv*3.+n*2.);
  col.r-=fbm(uv+vec2(0,T*.015)+n);
  col.g-=fbm(uv*1.003+vec2(0,T*.015)+n+.003);
  col.b-=fbm(uv*1.006+vec2(0,T*.015)+n+.006);
  col=mix(col, u_color, dot(col,vec3(.21,.71,.07)));
  col=mix(vec3(.08),col,min(time*.1,1.));
  col=clamp(col,.08,1.);
  O=vec4(col,1);
}`;

class Renderer {
  constructor(canvas, fragmentSource) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2');
    this.color = [0.5, 0.5, 0.5];
    this.vertexSrc = '#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}';
    this.vertices = [-1, 1, -1, -1, 1, 1, 1, -1];
    this._setup(fragmentSource);
    this._init();
  }

  updateColor(c) { this.color = c; }

  updateScale() {
    const dpr = Math.max(1, window.devicePixelRatio);
    this.canvas.width  = this.canvas.offsetWidth  * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  _compile(shader, src) {
    const gl = this.gl;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
  }

  reset() {
    const { gl, program, vs, fs } = this;
    if (!program) return;
    if (vs) { gl.detachShader(program, vs); gl.deleteShader(vs); }
    if (fs) { gl.detachShader(program, fs); gl.deleteShader(fs); }
    gl.deleteProgram(program);
    this.program = null;
  }

  _setup(fragmentSource) {
    const gl = this.gl;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    const prog = gl.createProgram();
    if (!this.vs || !this.fs || !prog) return;
    this._compile(this.vs, this.vertexSrc);
    this._compile(this.fs, fragmentSource);
    this.program = prog;
    gl.attachShader(prog, this.vs);
    gl.attachShader(prog, this.fs);
    gl.linkProgram(prog);
  }

  _init() {
    const { gl, program: prog } = this;
    if (!prog) return;
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    prog.uResolution = gl.getUniformLocation(prog, 'resolution');
    prog.uTime       = gl.getUniformLocation(prog, 'time');
    prog.uColor      = gl.getUniformLocation(prog, 'u_color');
  }

  render(now = 0) {
    const { gl, program: prog, buffer, canvas } = this;
    if (!prog || !gl.isProgram(prog)) return;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(prog.uResolution, canvas.width, canvas.height);
    gl.uniform1f(prog.uTime, now * 1e-3);
    gl.uniform3fv(prog.uColor, this.color);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16) / 255, parseInt(r[2], 16) / 255, parseInt(r[3], 16) / 255] : null;
}

export function SmokeBackground({ smokeColor = '#96B89A' }) {
  const canvasRef   = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new Renderer(canvasRef.current, fragmentShaderSource);
    rendererRef.current = renderer;
    const onResize = () => renderer.updateScale();
    onResize();
    window.addEventListener('resize', onResize);
    let rafId;
    const loop = (now) => { renderer.render(now); rafId = requestAnimationFrame(loop); };
    loop(0);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
      renderer.reset();
    };
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;
    const rgb = hexToRgb(smokeColor);
    if (rgb) rendererRef.current.updateColor(rgb);
  }, [smokeColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
